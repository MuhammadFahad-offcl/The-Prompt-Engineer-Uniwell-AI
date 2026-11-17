from sqlalchemy import func, select

from app.db.models import AdaptationEvent, CheckIn, Feedback, Plan, PlanItem, ProductEvent, Resource, Task, User
from app.services import ai_service
from app.services.plan_service import reset_rate_limits
from tests.conftest import h, make_profile, new_uid
from tests.helpers import MockProvider, install


def seed(client, uid, scenario="overloaded"):
    r = client.post("/api/demo/seed", json={"user_id": uid, "scenario": scenario, "timezone": "Asia/Karachi"}, headers=h(uid))
    assert r.status_code == 200, r.text
    return r.json()


def count(db, model, uid):
    col = model.id if model is User else model.user_id
    return db.scalar(select(func.count()).select_from(model).where(col == uid))


def test_seed_overloaded_matches_prd_demo(client):
    uid = new_uid()
    res = seed(client, uid)
    assert res["label"] == "Demo data — synthetic example"
    assert res["profile"]["is_synthetic"] is True
    radar = client.get(f"/api/radar/{uid}", headers=h(uid)).json()
    assert radar["due_soon_minutes"] == 180 and radar["available_minutes"] == 120
    assert radar["status"] == "over_capacity"
    tasks = client.get(f"/api/tasks/{uid}", headers=h(uid)).json()
    assert all(t["is_synthetic"] for t in tasks)
    plans = client.get(f"/api/plans/{uid}", headers=h(uid)).json()
    assert plans["items"][0]["provider"] == "synthetic-seed" and plans["items"][0]["is_synthetic"]
    assert plans["adaptation_events"] and all(e["is_synthetic"] for e in plans["adaptation_events"])
    # Seeded feedback went through the real rules: 30-minute blocks → 25
    assert res["profile"]["effective_session_minutes"] == 25
    insights = client.get(f"/api/insights/{uid}", headers=h(uid)).json()
    assert insights["checkins_7d"] == 7 and insights["synthetic_records_present"]


def test_seed_manageable_scenario(client):
    uid = new_uid()
    seed(client, uid, "manageable")
    assert client.get(f"/api/radar/{uid}", headers=h(uid)).json()["status"] == "manageable"


def test_seed_is_repeatable(client, db_session):
    uid = new_uid()
    first = seed(client, uid)
    second = seed(client, uid)
    assert first["counts"] == second["counts"]
    assert count(db_session, Task, uid) == first["counts"]["tasks"]
    assert count(db_session, CheckIn, uid) == first["counts"]["checkins"]
    assert count(db_session, Plan, uid) == 1


def test_seed_cannot_target_another_user(client):
    victim = make_profile(client)
    attacker = make_profile(client)
    r = client.post("/api/demo/seed", json={"user_id": victim, "scenario": "overloaded"}, headers=h(attacker))
    assert r.status_code == 403


def test_seeded_history_feeds_first_live_plan(client):
    reset_rate_limits()
    uid = new_uid()
    seed(client, uid)
    ids = {t["title"]: t["id"] for t in client.get(f"/api/tasks/{uid}", headers=h(uid)).json()}
    plan = {
        "title": "Plan", "supportive_message": "Hi.", "workload_summary": "Busy.",
        "items": [
            {"type": "study", "task_id": ids["DBMS assignment"], "title": "DBMS", "duration_minutes": 25,
             "instructions": "Start Q1.", "reason": "Due first."},
            {"type": "wellbeing", "task_id": None, "title": "Pause", "duration_minutes": 3,
             "instructions": "Breathe gently if comfortable.", "reason": "Reset.", "activity_type": "breathing_pause"},
        ],
        "study_tip": "Tip.", "affirmation": "Kind.", "why_this_plan": "Why.", "fallback_plan": "Fallback.",
        "deferred_tasks": [], "missing_info": [],
    }
    install(MockProvider([plan]))
    try:
        r = client.post("/api/plans/generate", json={"user_id": uid}, headers=h(uid))
    finally:
        ai_service.set_provider_override(None)
    content = r.json()["plan"]["plan"]
    assert any("25-minute study blocks (was 30)" in e for e in content["adaptation_explanations"])
    assert content["constraints"]["session_minutes"] == 25 and content["constraints"]["max_study_tasks"] == 1


def test_delete_user_data_removes_every_record(client, db_session):
    uid = new_uid()
    seed(client, uid)
    bystander = new_uid()
    seed(client, bystander, "manageable")
    plan_ids = [p.id for p in db_session.scalars(select(Plan).where(Plan.user_id == uid))]

    r = client.delete(f"/api/user/{uid}/data", headers=h(uid))
    assert r.status_code == 200 and r.json()["deleted"] is True

    db_session.expire_all()
    for model in (User, CheckIn, Task, Plan, Feedback, AdaptationEvent, ProductEvent):
        assert count(db_session, model, uid) == 0, model.__name__
    assert db_session.scalar(select(func.count()).select_from(PlanItem).where(PlanItem.plan_id.in_(plan_ids))) == 0
    # Other users and the shared resource catalogue are untouched.
    assert count(db_session, Task, bystander) == 4
    assert db_session.scalar(select(func.count()).select_from(Resource)) == 4
    assert client.get(f"/api/profile/{uid}", headers=h(uid)).status_code == 404


def test_delete_requires_ownership(client):
    a, b = make_profile(client), make_profile(client)
    assert client.delete(f"/api/user/{a}/data", headers=h(b)).status_code == 403
    assert client.get(f"/api/profile/{a}", headers=h(a)).status_code == 200


def test_resources_are_metadata_only_with_rights_notes(client):
    res = client.get("/api/resources").json()
    assert len(res) == 4
    for r in res:
        assert r["url"].startswith("https://www.who.int/") or r["url"].startswith("https://www.nhs.uk/")
        assert r["rights_note"] and r["reviewed"] is False and r["last_checked_at"]
        assert len(r["summary"]) < 300  # short original summary, not copied content
    who = next(r for r in res if r["publisher"].startswith("World Health"))
    assert "CC BY-NC-SA 3.0 IGO" in who["rights_note"] and "Urdu" in who["language"]


def test_analytics_events_carry_no_sensitive_values(client, db_session):
    uid = make_profile(client)
    client.post("/api/checkins", json={"mood_score": 1, "sleep_quality": "poor", "workload_score": 5,
                                       "available_minutes": 60}, headers=h(uid))
    events = db_session.scalars(select(ProductEvent).where(ProductEvent.user_id == uid)).all()
    assert {e.event_name for e in events} >= {"onboarding_completed", "checkin_saved"}
    assert all(not e.metadata_json or set(e.metadata_json) <= {"provider", "error_code", "scenario", "item_type", "latency_ms", "retry_used"} for e in events)
