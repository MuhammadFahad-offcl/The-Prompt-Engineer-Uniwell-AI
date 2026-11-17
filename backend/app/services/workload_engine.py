"""Academic Pressure Radar — transparent, deterministic workload maths.

This estimates academic TIME pressure only. It is not a stress, burnout or mental-health score.

    workload_ratio = due_soon_minutes / max(available_minutes, 1)
    < 0.75 → manageable · 0.75–1.00 → tight · > 1.00 → over_capacity

The thresholds are product heuristics, not validated clinical cut-offs.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.clock import ensure_aware_utc, get_zone
from app.db.models import Task

MANAGEABLE_BELOW = 0.75
TIGHT_UP_TO = 1.00

BUCKET_ORDER = {"overdue": 0, "today": 1, "next_48h": 2, "later": 3}
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

RULE_TEXT = (
    "Workload ratio = minutes of pending work due within the next 48 hours (including overdue) "
    "÷ your available study minutes today. Below 0.75 = manageable, 0.75–1.00 = tight, above "
    "1.00 = over capacity. Completed tasks are excluded. These are planning heuristics, not "
    "clinical thresholds."
)


@dataclass(frozen=True)
class RankedTask:
    task: Task
    rank: int
    bucket: str
    deadline_utc: datetime
    reason: str


def classify_ratio(ratio: float | None) -> str:
    if ratio is None:
        return "unknown"
    if ratio < MANAGEABLE_BELOW:
        return "manageable"
    if ratio <= TIGHT_UP_TO:
        return "tight"
    return "over_capacity"


def bucket_for(deadline_utc: datetime, now_utc: datetime, tz_name: str) -> str:
    zone = get_zone(tz_name)
    if deadline_utc < now_utc:
        return "overdue"
    if deadline_utc.astimezone(zone).date() == now_utc.astimezone(zone).date():
        return "today"
    if deadline_utc <= now_utc + timedelta(hours=48):
        return "next_48h"
    return "later"


def _reason(bucket: str, deadline_utc: datetime, task: Task, tz_name: str) -> str:
    local = deadline_utc.astimezone(get_zone(tz_name))
    when = local.strftime("%a %d %b, %H:%M")
    base = {
        "overdue": f"Overdue (was due {when}) — most urgent",
        "today": f"Due today at {local.strftime('%H:%M')}",
        "next_48h": f"Due within 48 hours ({when})",
        "later": f"Due later ({when})",
    }[bucket]
    return f"{base}; your priority: {task.priority}; about {task.estimated_minutes} min."


def rank_pending_tasks(tasks: list[Task], now_utc: datetime, tz_name: str) -> list[RankedTask]:
    """Deterministic order: urgency bucket → nearest deadline → student priority → shorter
    task first (easier to fit) → creation time → id (final tie-break)."""
    pending = [t for t in tasks if t.status != "completed"]
    keyed = []
    for t in pending:
        d = ensure_aware_utc(t.deadline)
        b = bucket_for(d, now_utc, tz_name)
        key = (
            BUCKET_ORDER[b],
            d,
            PRIORITY_ORDER.get(t.priority, 1),
            t.estimated_minutes,
            ensure_aware_utc(t.created_at),
            t.id,
        )
        keyed.append((key, t, b, d))
    keyed.sort(key=lambda x: x[0])
    return [
        RankedTask(task=t, rank=i + 1, bucket=b, deadline_utc=d, reason=_reason(b, d, t, tz_name))
        for i, (_k, t, b, d) in enumerate(keyed)
    ]


def compute_radar(
    tasks: list[Task],
    available_minutes: int | None,
    available_source: str | None,
    now_utc: datetime,
    tz_name: str,
) -> dict:
    ranked = rank_pending_tasks(tasks, now_utc, tz_name)
    sums = {k: 0 for k in BUCKET_ORDER}
    for r in ranked:
        sums[r.bucket] += r.task.estimated_minutes
    due_soon = sums["overdue"] + sums["today"] + sums["next_48h"]

    ratio = None if not available_minutes else round(due_soon / max(available_minutes, 1), 2)
    status = classify_ratio(ratio)

    if ratio is None:
        explanation = (
            f"{due_soon} min of pending work is due within 48 hours. Add today's available study "
            "time in your check-in to compare it with your time."
        )
    elif due_soon == 0:
        explanation = (
            f"Nothing is due within 48 hours, and you have {available_minutes} min available — "
            "a good day to get ahead or rest."
        )
    else:
        explanation = (
            f"{due_soon} min of pending work is due within 48 hours (including overdue) and you "
            f"have {available_minutes} min available today: {due_soon} ÷ {available_minutes} = "
            f"{ratio:.2f} → {status.replace('_', ' ')}."
        )
        if status == "over_capacity":
            explanation += " Not everything can fit today, so the plan should prioritise and defer — not make you work longer."

    local_date = now_utc.astimezone(get_zone(tz_name)).date()
    return {
        "local_date": local_date.isoformat(),
        "available_minutes": available_minutes,
        "available_source": available_source,
        "overdue_minutes": sums["overdue"],
        "due_today_minutes": sums["today"],
        "later_48h_minutes": sums["next_48h"],
        "due_soon_minutes": due_soon,
        "beyond_48h_minutes": sums["later"],
        "pending_count": len(ranked),
        "completed_count": sum(1 for t in tasks if t.status == "completed"),
        "overdue_count": sum(1 for r in ranked if r.bucket == "overdue"),
        "workload_ratio": ratio,
        "status": status,
        "explanation": explanation,
        "rule": RULE_TEXT,
        "ranked_tasks": [
            {
                "task_id": r.task.id,
                "title": r.task.title,
                "rank": r.rank,
                "deadline": r.deadline_utc.isoformat().replace("+00:00", "Z"),
                "estimated_minutes": r.task.estimated_minutes,
                "priority": r.task.priority,
                "bucket": r.bucket,
                "reason": r.reason,
            }
            for r in ranked
        ],
    }
