"""Test-only helpers. MockProvider is NEVER used outside automated tests."""
import json
from datetime import timedelta

from app.services.ai_service import AIError, AIResult, set_provider_override
from tests.conftest import FROZEN_NOW, h, make_profile


class MockProvider:
    name = "mock-test"
    model = "mock-model"

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls: list[tuple[str, list]] = []

    def generate(self, system, messages):
        self.calls.append((system, list(messages)))
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        text = nxt(messages) if callable(nxt) else nxt
        return AIResult(text=text if isinstance(text, str) else json.dumps(text), provider=self.name,
                        model=self.model, latency_ms=5)


def install(provider):
    set_provider_override(lambda: provider)
    return provider


def setup_demo_user(client, session=30, energy=2, available=120):
    uid = make_profile(client, preferred_session_minutes=session)
    hdr = h(uid)
    ids = {}
    for key, title, minutes, hours, prio in (
        ("dbms", "DBMS assignment", 90, 8, "high"),
        ("quiz", "AI quiz revision", 60, 30, "medium"),
        ("dsa", "DSA practice", 30, 10, "medium"),
    ):
        r = client.post("/api/tasks", headers=hdr, json={
            "title": title, "deadline": (FROZEN_NOW + timedelta(hours=hours)).isoformat(),
            "estimated_minutes": minutes, "priority": prio})
        ids[key] = r.json()["id"]
    client.post("/api/checkins", headers=hdr, json={
        "mood_score": 3, "sleep_quality": "okay", "workload_score": 5,
        "energy_score": energy, "available_minutes": available})
    return uid, ids


def plan_json(ids, *, block=25, extra_items=None, deferred=True, **overrides):
    items = [
        {"type": "study", "task_id": ids["dbms"], "title": "DBMS: section 1", "duration_minutes": block,
         "instructions": "Write the ER diagram for Q1.", "reason": "Nearest deadline."},
        {"type": "break", "task_id": None, "title": "Screen break", "duration_minutes": 5,
         "instructions": "Stand up and stretch.", "reason": "Pause between blocks."},
        {"type": "wellbeing", "task_id": None, "title": "Grounding pause", "duration_minutes": 3,
         "instructions": "Notice five things you can see.", "reason": "A gentle reset.",
         "activity_type": "grounding"},
        {"type": "study", "task_id": ids["dsa"], "title": "DSA: two problems", "duration_minutes": block,
         "instructions": "Solve two array problems.", "reason": "Due later today."},
    ] + (extra_items or [])
    data = {
        "title": "A manageable plan",
        "supportive_message": "Let's start with one clear step.",
        "workload_summary": "You have more work due than time today.",
        "items": items,
        "study_tip": "Start with the headings.",
        "affirmation": "A small step still counts.",
        "why_this_plan": "The DBMS assignment is due first.",
        "fallback_plan": "If you lose time, finish the first block only.",
        "deferred_tasks": [{"task_id": ids["quiz"], "reason": "Due tomorrow.", "suggested_review_date": "2026-11-18"}]
        if deferred else [],
        "missing_info": [],
    }
    data.update(overrides)
    return data


def timeout_error():
    return AIError("ai_timeout", "The AI provider took too long to respond. Please retry.", 504)
