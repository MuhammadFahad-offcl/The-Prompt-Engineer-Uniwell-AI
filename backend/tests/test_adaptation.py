import json

import pytest

from app.core import clock
from app.services import ai_service
from app.services.adaptation_engine import AdaptState, FeedbackSignal, apply_feedback_rules
from app.services.plan_service import reset_rate_limits
from tests.conftest import FROZEN_NOW, h, make_profile
from tests.helpers import MockProvider, install, plan_json, setup_demo_user

from datetime import timedelta


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()
    yield
    ai_service.set_provider_override(None)


BASE = AdaptState(preferred_session_minutes=30, adapted_session_minutes=None, max_tasks_override=None,
                  buffer_minutes=5, keep_breaks=True, noncompletion_streak=0)


def signal(**kw):
    defaults = dict(completion_status="partially", manageable=3, helpful=3, reason_code=None, breaks_helpful=None,
                    items_completed=1, items_total=4, plan_session_minutes=30, plan_study_tasks=2)
    defaults.update(kw)
    return FeedbackSignal(**defaults)


# ---- Pure rule tests --------------------------------------------------------------------
def test_low_manageability_shortens_sessions_and_reduces_tasks():
    out = apply_feedback_rules(BASE, signal(manageable=2, reason_code="sessions_too_long"))
    assert out.state.adapted_session_minutes == 25
    assert out.state.max_tasks_override == 1
    assert out.state.buffer_minutes == 10
    rules = [c.rule for c in out.changes]
    assert "shorten_sessions" in rules and "reduce_task_count" in rules
    assert any("25-minute study blocks (was 30)" in c.reason for c in out.changes)


def test_long_sessions_step_down_by_ten_with_floor():
    s = AdaptState(**{**BASE.__dict__, "preferred_session_minutes": 45})
    out = apply_feedback_rules(s, signal(reason_code="sessions_too_long", plan_session_minutes=45))
    assert out.state.adapted_session_minutes == 35
    floor = AdaptState(**{**BASE.__dict__, "preferred_session_minutes": 15})
    out = apply_feedback_rules(floor, signal(manageable=1, plan_session_minutes=15))
    assert out.state.adapted_session_minutes is None  # never below 15
    assert "session_at_minimum" in [c.rule for c in out.changes]


def test_manageable_and_completed_preserves_session_and_does_not_increase_load():
    out = apply_feedback_rules(BASE, signal(completion_status="yes", manageable=5, helpful=5,
                                            reason_code="plan_was_helpful", items_completed=4))
    assert out.state.effective_session == 30
    assert out.state.max_tasks_override is None
    assert out.state.buffer_minutes == 5
    assert [c.rule for c in out.changes] == ["preserve_success"]


def test_breaks_helpful_preserves_breaks():
    s = AdaptState(**{**BASE.__dict__, "keep_breaks": False})
    out = apply_feedback_rules(s, signal(breaks_helpful=True))
    assert out.state.keep_breaks is True


def test_unexpected_event_is_not_penalised():
    out = apply_feedback_rules(BASE, signal(completion_status="no", manageable=3, reason_code="unexpected_event"))
    assert out.state.effective_session == 30 and out.state.max_tasks_override is None
    assert "no_penalty_unexpected_event" in [c.rule for c in out.changes]


def test_not_enough_time_adds_buffer():
    out = apply_feedback_rules(BASE, signal(reason_code="not_enough_time"))
    assert out.state.buffer_minutes == 10


def test_repeated_noncompletion_asks_about_availability_without_judgement():
    first = apply_feedback_rules(BASE, signal(completion_status="no"))
    assert not first.ask_availability
    second = apply_feedback_rules(first.state, signal(completion_status="no"))
    assert second.ask_availability
    text = " ".join(c.reason for c in second.changes).lower()
    assert "not a failure" in text and "lazy" not in text


def test_different_feedback_produces_different_constraints():
    hard = apply_feedback_rules(BASE, signal(manageable=1, reason_code="too_many_tasks"))
    easy = apply_feedback_rules(BASE, signal(completion_status="yes", manageable=5, items_completed=4))
    assert (hard.state.effective_session, hard.state.max_tasks_override, hard.state.buffer_minutes) != (
        easy.state.effective_session, easy.state.max_tasks_override, easy.state.buffer_minutes)


# ---- End-to-end loop: plan → feedback → next plan context --------------------------------
def _context_of(call) -> dict:
    prompt = call[1][0].content
    return json.loads(prompt.split("<context_json>\n")[1].split("\n</context_json>")[0])


def run_loop(client, feedback_body):
    uid, ids = setup_demo_user(client, energy=4)  # normal energy: session 30, up to 3 tasks
    mock = install(MockProvider([lambda m: plan_json(ids, block=30), lambda m: plan_json(ids, block=20)]))
    first = client.post("/api/plans/generate", json={"user_id": uid}, headers=h(uid)).json()["plan"]
    assert first["plan"]["constraints"]["session_minutes"] == 30

    clock.freeze_now(FROZEN_NOW + timedelta(hours=2))
    r = client.post("/api/feedback", headers=h(uid), json={"plan_id": first["id"], **feedback_body})
    assert r.status_code == 200, r.text
    clock.freeze_now(FROZEN_NOW + timedelta(hours=3))
    second = client.post("/api/plans/generate", json={"user_id": uid}, headers=h(uid)).json()["plan"]
    return uid, first, r.json(), second, _context_of(mock.calls[1])


def test_scenario_A_too_demanding_feedback_shortens_next_plan(client):
    uid, first, fb, second, ctx = run_loop(client, {
        "completion_status": "partially", "manageable_rating": 2, "helpfulness_rating": 3,
        "reason_code": "sessions_too_long", "breaks_helpful": True})
    assert fb["next_constraints_preview"]["session_minutes"] == 25
    c2 = second["plan"]["constraints"]
    assert c2["session_minutes"] == 25 and c2["max_study_tasks"] == 1 and c2["buffer_minutes"] == 10
    # The next AI request carries the adaptation, and the student sees why.
    assert ctx["constraints"]["session_minutes"] == 25
    assert any("25-minute study blocks (was 30)" in n for n in ctx["adaptation_notes"])
    assert any("25-minute study blocks (was 30)" in e for e in second["plan"]["adaptation_explanations"])
    assert ctx["recent_feedback"][0]["manageable_1_to_5"] == 2
    # Feedback that worsens the plan never sends more than one task to the student next time.
    assert len({i["task_id"] for i in second["items"] if i["item_type"] == "study"}) == 1


def test_scenario_B_successful_feedback_keeps_constraints(client):
    uid, first, fb, second, ctx = run_loop(client, {
        "completion_status": "yes", "manageable_rating": 5, "helpfulness_rating": 5,
        "reason_code": "plan_was_helpful"})
    c2 = second["plan"]["constraints"]
    assert c2["session_minutes"] == 30 and c2["max_study_tasks"] == 3 and c2["buffer_minutes"] == 5
    assert [e["rule_applied"] for e in fb["adaptation_events"]] == ["preserve_success"]


def test_feedback_once_per_plan_and_ownership(client):
    uid, ids = setup_demo_user(client)
    install(MockProvider([plan_json(ids)]))
    plan = client.post("/api/plans/generate", json={"user_id": uid}, headers=h(uid)).json()["plan"]
    body = {"plan_id": plan["id"], "completion_status": "yes", "manageable_rating": 4, "helpfulness_rating": 4}
    other = make_profile(client)
    assert client.post("/api/feedback", json=body, headers=h(other)).status_code == 404
    assert client.post("/api/feedback", json={**body, "manageable_rating": 9}, headers=h(uid)).status_code == 422
    assert client.post("/api/feedback", json=body, headers=h(uid)).status_code == 200
    r = client.post("/api/feedback", json=body, headers=h(uid))
    assert r.status_code == 409 and r.json()["error"]["code"] == "feedback_exists"
    detail = client.get(f"/api/plans/detail/{plan['id']}", headers=h(uid)).json()
    assert detail["feedback"]["manageable_rating"] == 4
