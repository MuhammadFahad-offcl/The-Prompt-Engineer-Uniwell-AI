import json
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.db.models import JournalEntry, PlanAdjustment, Task, WellbeingCheckIn
from app.services import ai_service
from app.services.mindbalance.wellbeing_analysis import analyse
from app.services.plan_service import reset_rate_limits
from tests.conftest import FROZEN_NOW, h, make_profile
from tests.helpers import MockProvider, install, plan_json, setup_demo_user

CHECK = {"mood": "neutral", "stress": 5, "energy": 6, "mental_condition": "calm", "academic_pressure": "moderate"}


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()
    yield
    ai_service.set_provider_override(None)


@pytest.mark.parametrize("kw,state", [
    (dict(mood="neutral", stress=9, energy=2, condition="overwhelmed", pressure="high"), "recovery_recommended"),
    (dict(mood="very_low", stress=4, energy=3, condition="calm", pressure="low"), "recovery_recommended"),
    (dict(mood="neutral", stress=7, energy=6, condition="calm", pressure="very_high"), "overloaded"),
    (dict(mood="good", stress=5, energy=6, condition="anxious", pressure="low"), "elevated_stress"),
    (dict(mood="good", stress=4, energy=3, condition="calm", pressure="low"), "low_energy"),
    (dict(mood="good", stress=3, energy=7, condition="calm", pressure="moderate"), "balanced"),
])
def test_state_rules(kw, state):
    r = analyse(**kw)
    assert r.state == state and r.reasons
    assert not any(w in " ".join(r.reasons).lower() for w in ("depress", "disorder", "diagnos"))


def test_checkin_validation_and_recommendations(client):
    uid = make_profile(client)
    for bad in ({**CHECK, "stress": 0}, {**CHECK, "energy": 11}, {**CHECK, "mood": "great"},
                {**CHECK, "mental_condition": "sad"}, {**CHECK, "academic_pressure": "extreme"}):
        assert client.post("/api/mindbalance/checkins", json=bad, headers=h(uid)).status_code == 422
    r = client.post("/api/mindbalance/checkins", headers=h(uid),
                    json={**CHECK, "stress": 9, "energy": 2, "mental_condition": "anxious"}).json()
    assert r["checkin"]["state"] == "recovery_recommended" and r["safety"] is None
    assert r["recommendations"][0]["activity"] == "grounding"  # anxious → grounding first
    summary = client.get(f"/api/mindbalance/{uid}/summary", headers=h(uid)).json()
    assert summary["latest_checkin"]["stress"] == 9 and summary["rules"]


def test_note_is_encrypted_at_rest_and_owner_only(client, db_session):
    uid = make_profile(client)
    client.post("/api/mindbalance/checkins", headers=h(uid), json={**CHECK, "note": "group project tension"})
    row = db_session.scalar(select(WellbeingCheckIn).where(WellbeingCheckIn.user_id == uid))
    assert row.note_encrypted and "group project" not in row.note_encrypted
    other = make_profile(client)
    assert client.get(f"/api/mindbalance/checkins/{uid}", headers=h(other)).status_code == 403
    assert client.get(f"/api/mindbalance/checkins/{uid}", headers=h(uid)).json()[0]["note"] == "group project tension"


def test_danger_note_returns_safety_not_recommendations(client):
    uid = make_profile(client)
    r = client.post("/api/mindbalance/checkins", headers=h(uid), json={**CHECK, "note": "I want to end my life"}).json()
    assert r["safety"] and r["recommendations"] == []
    assert "not an emergency service" in r["safety"]["not_emergency_service"]
    assert not any(ch.isdigit() for ch in json.dumps(r["safety"]["actions"], ensure_ascii=False))


def test_recovery_session_flow_and_feedback(client):
    uid = make_profile(client)
    s = client.post("/api/mindbalance/sessions", headers=h(uid),
                    json={"activity": "breathing", "variant": "2min", "pre_stress": 8, "pre_energy": 3}).json()
    done = client.post(f"/api/mindbalance/sessions/{s['id']}/finish", headers=h(uid),
                       json={"status": "completed", "post_stress": 6, "post_energy": 4, "helpful": "yes"}).json()
    assert done["status"] == "completed" and done["post_stress"] == 6
    assert client.post(f"/api/mindbalance/sessions/{s['id']}/finish", headers=h(uid), json={}).status_code == 409
    other = make_profile(client)
    assert client.post(f"/api/mindbalance/sessions/{s['id']}/finish", headers=h(other), json={}).status_code == 404
    assert client.post("/api/mindbalance/sessions", headers=h(uid), json={"activity": "dance"}).status_code == 422


def test_journal_encrypted_private_and_deletable(client, db_session):
    uid = make_profile(client)
    body = {"bothering": "Too many deadlines", "in_control": "Starting early", "outside_control": "Quiz date",
            "small_action": "Open the brief"}
    entry = client.post("/api/mindbalance/journal", headers=h(uid), json=body).json()["entry"]
    row = db_session.scalar(select(JournalEntry).where(JournalEntry.id == entry["id"]))
    assert "deadlines" not in row.bothering_enc and "brief" not in (row.small_action_enc or "")
    assert client.get(f"/api/mindbalance/journal/{uid}", headers=h(uid)).json()[0]["small_action"] == "Open the brief"
    other = make_profile(client)
    assert client.get(f"/api/mindbalance/journal/{uid}", headers=h(other)).status_code == 403
    assert client.delete(f"/api/mindbalance/journal/{entry['id']}", headers=h(other)).status_code == 404
    assert client.delete(f"/api/mindbalance/journal/{entry['id']}", headers=h(uid)).json() == {"deleted": True}
    assert client.post("/api/mindbalance/journal", headers=h(uid), json={"bothering": "   "}).status_code == 422


def test_insights_empty_state_then_observations(client, db_session):
    uid = make_profile(client)
    empty = client.get(f"/api/mindbalance/insights/{uid}", headers=h(uid)).json()
    assert empty["days_with_checkins"] == 0 and empty["observations"] == []
    today = date(2026, 11, 17)
    for i, (s, e) in enumerate([(4, 7), (5, 6), (6, 5), (7, 4), (8, 3)]):
        db_session.add(WellbeingCheckIn(user_id=uid, local_date=today - timedelta(days=4 - i), mood="neutral", stress=s,
                                        energy=e, mental_condition="calm", academic_pressure="moderate",
                                        state="balanced", state_reasons=[], kind="daily"))
    db_session.commit()
    data = client.get(f"/api/mindbalance/insights/{uid}", headers=h(uid)).json()
    assert data["days_with_checkins"] == 5 and data["consistency_pct"] == 36
    texts = " ".join(o["text"] for o in data["observations"])
    assert "increased over your last three check-in days" in texts
    assert "not a cause" in texts
    assert all(o["sample_size"] >= 3 for o in data["observations"])


def test_adjustment_requires_confirmation_then_feeds_plan(client, db_session):
    uid, ids = setup_demo_user(client, energy=4)
    client.post("/api/tasks", headers=h(uid), json={"title": "ML quiz", "deadline": (FROZEN_NOW + timedelta(days=3)).isoformat(),
                                                   "estimated_minutes": 60, "priority": "medium"})
    assert client.post("/api/mindbalance/adjustments/propose", headers=h(uid)).status_code == 409
    client.post("/api/mindbalance/checkins", headers=h(uid),
                json={**CHECK, "stress": 9, "energy": 2, "academic_pressure": "very_high"})
    prop = client.post("/api/mindbalance/adjustments/propose", headers=h(uid)).json()["adjustment"]
    types = {c["type"] for c in prop["changes"]}
    assert {"recovery_first", "lighter_sessions", "focus", "split_task", "defer_task"} <= types
    # Nothing changed yet: tasks untouched until confirmation.
    assert db_session.scalar(select(Task).where(Task.id == ids["dbms"])).title == "DBMS assignment"

    accept = [c["id"] for c in prop["changes"] if c["type"] in ("lighter_sessions", "split_task", "defer_task")]
    res = client.post(f"/api/mindbalance/adjustments/{prop['id']}/decide", headers=h(uid), json={"accepted_change_ids": accept}).json()
    assert res["adjustment"]["status"] == "applied" and res["applied"]
    db_session.expire_all()
    steps = db_session.scalars(select(Task).where(Task.user_id == uid, Task.title.like("DBMS assignment — step%"))).all()
    assert len(steps) >= 2 and sum(t.estimated_minutes for t in steps) == 90  # same total, same deadline
    assert client.post(f"/api/mindbalance/adjustments/{prop['id']}/decide", headers=h(uid), json={}).status_code == 409

    mock = install(MockProvider([lambda m: plan_json({**ids, "dbms": steps[0].id}, block=15)]))
    plan = client.post("/api/plans/generate", json={"user_id": uid}, headers=h(uid)).json()["plan"]["plan"]
    assert plan["constraints"]["session_minutes"] == 15
    ctx = json.loads(mock.calls[0][1][0].content.split("<context_json>\n")[1].split("\n</context_json>")[0])
    assert ctx["wellbeing_today"]["stress_1_to_10"] == 9
    deferred = {c["task_id"] for c in prop["changes"] if c["type"] == "defer_task"}
    assert not deferred & {t["task_id"] for t in ctx["candidate_tasks"]}
    assert "note" not in json.dumps(ctx["wellbeing_today"])


def test_balanced_state_proposes_nothing(client):
    uid, _ = setup_demo_user(client)
    client.post("/api/mindbalance/checkins", headers=h(uid), json={**CHECK, "stress": 3, "energy": 8})
    r = client.post("/api/mindbalance/adjustments/propose", headers=h(uid)).json()
    assert r["adjustment"] is None and "no schedule changes" in r["summary"]


def test_delete_all_data_includes_mindbalance(client, db_session):
    uid = make_profile(client)
    client.post("/api/mindbalance/checkins", headers=h(uid), json=CHECK)
    client.post("/api/mindbalance/journal", headers=h(uid), json={"bothering": "x y z"})
    client.delete(f"/api/user/{uid}/data", headers=h(uid))
    db_session.expire_all()
    for model in (WellbeingCheckIn, JournalEntry, PlanAdjustment):
        assert db_session.scalars(select(model).where(model.user_id == uid)).all() == []
