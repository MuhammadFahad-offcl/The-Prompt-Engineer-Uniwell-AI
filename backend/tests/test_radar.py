from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Task
from app.services.workload_engine import classify_ratio, compute_radar, rank_pending_tasks
from tests.conftest import FROZEN_NOW, h, make_profile

TZ = "Asia/Karachi"  # FROZEN_NOW = 17 Nov 2026 10:00 local


def task(id, minutes, deadline, priority="medium", status="pending", created=None):
    return Task(
        id=id, user_id="u", title=id, task_type="assignment", deadline=deadline.replace(tzinfo=None),
        estimated_minutes=minutes, priority=priority, status=status,
        created_at=(created or FROZEN_NOW).replace(tzinfo=None),
    )


@pytest.mark.parametrize(
    "ratio,label",
    [(None, "unknown"), (0.0, "manageable"), (0.74, "manageable"), (0.75, "tight"), (1.0, "tight"),
     (1.01, "over_capacity"), (2.5, "over_capacity")],
)
def test_ratio_thresholds(ratio, label):
    assert classify_ratio(ratio) == label


def demo_tasks():
    return [
        task("dbms", 90, FROZEN_NOW + timedelta(hours=8), "high"),       # today 18:00 local
        task("quiz", 60, FROZEN_NOW + timedelta(hours=30), "medium"),    # tomorrow
        task("dsa", 30, FROZEN_NOW + timedelta(hours=10), "medium"),     # later today
        task("thesis", 240, FROZEN_NOW + timedelta(days=9), "high"),     # beyond 48h
    ]


def test_demo_scenario_totals_and_over_capacity():
    r = compute_radar(demo_tasks(), 120, "checkin", FROZEN_NOW, TZ)
    assert r["due_today_minutes"] == 120          # dbms 90 + dsa 30
    assert r["later_48h_minutes"] == 60           # quiz
    assert r["due_soon_minutes"] == 180
    assert r["beyond_48h_minutes"] == 240         # not counted in the ratio
    assert r["workload_ratio"] == 1.5
    assert r["status"] == "over_capacity"
    assert "180 ÷ 120" in r["explanation"]


def test_completed_tasks_are_excluded():
    tasks = demo_tasks()
    tasks[0].status = "completed"
    r = compute_radar(tasks, 120, "checkin", FROZEN_NOW, TZ)
    assert r["due_soon_minutes"] == 90
    assert r["status"] == "tight"
    assert r["completed_count"] == 1
    assert "dbms" not in [t["task_id"] for t in r["ranked_tasks"]]


def test_status_changes_with_available_time():
    assert compute_radar(demo_tasks(), 300, "checkin", FROZEN_NOW, TZ)["status"] == "manageable"
    assert compute_radar(demo_tasks(), 180, "checkin", FROZEN_NOW, TZ)["status"] == "tight"
    assert compute_radar(demo_tasks(), None, None, FROZEN_NOW, TZ)["status"] == "unknown"


def test_overdue_counts_and_ranks_first():
    tasks = demo_tasks() + [task("late", 20, FROZEN_NOW - timedelta(hours=3), "low")]
    r = compute_radar(tasks, 120, "checkin", FROZEN_NOW, TZ)
    assert r["overdue_minutes"] == 20 and r["overdue_count"] == 1
    assert r["ranked_tasks"][0]["task_id"] == "late"
    assert [t["task_id"] for t in r["ranked_tasks"]] == ["late", "dbms", "dsa", "quiz", "thesis"]


def test_priority_and_duration_tie_breaks_are_deterministic():
    same = FROZEN_NOW + timedelta(hours=5)
    tasks = [
        task("b-low", 30, same, "low"),
        task("a-high-long", 90, same, "high"),
        task("c-high-short", 20, same, "high"),
        task("d-high-short-later-created", 20, same, "high", created=FROZEN_NOW + timedelta(minutes=1)),
    ]
    order = [r.task.id for r in rank_pending_tasks(tasks, FROZEN_NOW, TZ)]
    assert order == ["c-high-short", "d-high-short-later-created", "a-high-long", "b-low"]
    # Same input in a different order → same output
    assert [r.task.id for r in rank_pending_tasks(list(reversed(tasks)), FROZEN_NOW, TZ)] == order


def test_radar_endpoint_uses_todays_checkin(client):
    uid = make_profile(client)
    hdr = h(uid)
    for title, minutes, hours in (("DBMS", 90, 8), ("Quiz", 60, 30), ("DSA", 30, 10)):
        deadline = (FROZEN_NOW + timedelta(hours=hours)).isoformat()
        client.post("/api/tasks", json={"title": title, "deadline": deadline, "estimated_minutes": minutes}, headers=hdr)
    r = client.get(f"/api/radar/{uid}", headers=hdr).json()
    assert r["status"] == "unknown" and r["available_minutes"] is None

    client.post("/api/checkins", json={"mood_score": 3, "sleep_quality": "okay", "workload_score": 5,
                                        "energy_score": 2, "available_minutes": 120}, headers=hdr)
    r = client.get(f"/api/radar/{uid}", headers=hdr).json()
    assert r["available_source"] == "checkin"
    assert r["due_soon_minutes"] == 180 and r["status"] == "over_capacity"
