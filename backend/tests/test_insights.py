import re
from datetime import date, timedelta

from app.db.models import CheckIn
from tests.conftest import h, make_profile


def add_checkins(db, uid, n, sleep="poor"):
    today = date(2026, 11, 17)
    for i in range(n):
        db.add(CheckIn(user_id=uid, local_date=today - timedelta(days=i), mood_score=3, sleep_quality=sleep,
                       workload_score=4, energy_score=2, available_minutes=90))
    db.commit()


def test_insights_empty_state_below_threshold(client, db_session):
    uid = make_profile(client)
    add_checkins(db_session, uid, 2)
    r = client.get(f"/api/insights/{uid}", headers=h(uid)).json()
    assert r["checkins_7d"] == 2
    assert r["statements"] == []
    assert len(r["days"]) == 7
    assert r["feedback_summary"] is None


def test_insights_are_descriptive_with_sample_size(client, db_session):
    uid = make_profile(client)
    add_checkins(db_session, uid, 5)
    r = client.get(f"/api/insights/{uid}", headers=h(uid)).json()
    assert r["checkins_7d"] == 5
    assert r["statements"] and all(s["sample_size"] >= 3 for s in r["statements"])
    text = " ".join(s["text"] for s in r["statements"]).lower()
    assert "last 5 check-ins" in text
    assert not re.search(r"because|caus|diagnos|depress|anxiety|burnout|risk", text)
    assert r["days"][-1]["local_date"] == "2026-11-17" and r["days"][-1]["sleep_value"] == 1


def test_insights_ownership(client):
    a, b = make_profile(client), make_profile(client)
    assert client.get(f"/api/insights/{a}", headers=h(b)).status_code == 403
