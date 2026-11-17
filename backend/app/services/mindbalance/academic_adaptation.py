"""Adaptive academic-wellness planning: PROPOSE changes from reported state + real tasks.

Nothing is applied until the student confirms. Deadlines are never moved and tasks are never
deleted. "Defer" only removes a task from TODAY's plan; "split" turns one task into smaller
steps with the same total minutes and the same deadline.
"""
from datetime import datetime, timedelta
from uuid import uuid4

from app.db.models import Task, WellbeingCheckIn
from app.services.workload_engine import rank_pending_tasks

SPLIT_MIN_MINUTES = 45
MAX_SPLIT_STEPS = 4


def needs_adjustment(c: WellbeingCheckIn) -> bool:
    return c.stress >= 7 or c.energy <= 3 or c.state in ("overloaded", "recovery_recommended")


def propose(*, checkin: WellbeingCheckIn, tasks: list[Task], now_utc: datetime, tz: str) -> dict:
    ranked = rank_pending_tasks(tasks, now_utc, tz)
    if not needs_adjustment(checkin):
        return {"pressure_level": "normal",
                "summary": "Your reported stress and energy look manageable, so no schedule changes are suggested. Your usual plan settings apply.",
                "changes": []}

    severe = checkin.stress >= 8 or checkin.energy <= 2
    session_cap = 15 if checkin.energy <= 2 else 20
    max_tasks = 1 if (checkin.energy <= 3 or checkin.stress >= 8) else 2
    changes: list[dict] = []

    def add(kind: str, title: str, detail: str, reason: str, task_id: str | None = None, data: dict | None = None):
        changes.append({"id": uuid4().hex[:12], "type": kind, "task_id": task_id, "title": title,
                        "detail": detail, "reason": reason, "data": data or {}, "accepted": None})

    add("recovery_first", "Start with a short recovery activity",
        "Begin today with a 5-minute recovery activity from MindBalance before studying.",
        f"You reported stress {checkin.stress}/10 and energy {checkin.energy}/10.")
    add("lighter_sessions", f"Use {session_cap}-minute study blocks today",
        f"Today's plan will cap study blocks at {session_cap} minutes, with breaks between them.",
        "Shorter blocks are more realistic when energy is low or stress is high.",
        data={"session_cap": session_cap})
    add("focus", f"Focus on at most {max_tasks} task{'s' if max_tasks > 1 else ''} today",
        "Today's plan will include fewer tasks so it stays achievable.",
        "Trying to cover everything at once can make a hard day harder.",
        data={"max_tasks": max_tasks})

    if ranked:
        top = ranked[0]
        if top.task.estimated_minutes >= SPLIT_MIN_MINUTES:
            steps = min(MAX_SPLIT_STEPS, max(2, -(-top.task.estimated_minutes // max(session_cap * 2, 30))))
            base = top.task.estimated_minutes // steps
            parts = [base] * steps
            parts[-1] += top.task.estimated_minutes - base * steps
            add("split_task", f"Break “{top.task.title}” into {steps} smaller steps",
                f"Create {steps} steps of about {base} minutes each (same deadline, same total time).",
                f"It's your most urgent task ({top.reason.split(';')[0].lower()}), and smaller steps are easier to start.",
                task_id=top.task.id, data={"parts": parts})
        urgent_cutoff = now_utc + timedelta(hours=24)
        deferrable = [r for r in ranked[1:] if r.bucket in ("next_48h", "later") and r.deadline_utc > urgent_cutoff]
        for r in deferrable[:3]:
            add("defer_task", f"Move “{r.task.title}” off today's plan",
                "It stays in your task list with the same deadline; it just won't be scheduled today.",
                f"It isn't due within 24 hours ({r.reason.split(';')[0].lower()}).",
                task_id=r.task.id)

    level = "high" if severe else "elevated"
    summary = (
        "Your check-in shows high pressure with limited energy. These are suggestions: review each one and keep only what helps."
        if severe else
        "Your check-in shows some pressure. Here are optional adjustments to keep today realistic."
    )
    return {"pressure_level": level, "summary": summary, "changes": changes}


def plan_overrides(adjustment_changes: list[dict]) -> dict:
    """Accepted changes → constraints for today's plan generation."""
    out = {"session_cap": None, "max_tasks": None, "deferred_task_ids": [], "recovery_first": False, "notes": []}
    for ch in adjustment_changes:
        if not ch.get("accepted"):
            continue
        if ch["type"] == "lighter_sessions":
            out["session_cap"] = ch["data"]["session_cap"]
            out["notes"].append(f"You chose lighter {ch['data']['session_cap']}-minute study blocks today (MindBalance).")
        elif ch["type"] == "focus":
            out["max_tasks"] = ch["data"]["max_tasks"]
            out["notes"].append(f"You chose to focus on at most {ch['data']['max_tasks']} task(s) today (MindBalance).")
        elif ch["type"] == "defer_task" and ch.get("task_id"):
            out["deferred_task_ids"].append(ch["task_id"])
        elif ch["type"] == "recovery_first":
            out["recovery_first"] = True
            out["notes"].append("You chose to start with a short recovery activity (MindBalance).")
    if out["deferred_task_ids"]:
        out["notes"].append(f"You moved {len(out['deferred_task_ids'])} non-urgent task(s) off today's plan (MindBalance).")
    return out
