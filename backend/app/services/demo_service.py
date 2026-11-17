"""Synthetic demo data — clearly labelled, never presented as real students or outcomes.

Two scenarios:
  overloaded  — the PRD demo: DBMS 90 min (today), DSA 30 min (later today), AI quiz 60 min
                (tomorrow) vs 120 min available; mood 3, sleep okay, workload 5, energy 2.
  manageable  — light week, normal energy.
Each seeds 6 prior days of check-ins plus one synthetic plan + feedback from yesterday so the
adaptation loop and charts have history. Seeding first wipes this anonymous ID's data, so it is
repeatable. Seeded plans have provider "synthetic-seed" and are labelled as NOT AI output.
"""
from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.clock import get_zone, now_utc
from app.db.models import CheckIn, Feedback, Plan, PlanItem, Task, User
from app.services.data_service import delete_all_user_data

DEMO_LABEL = "Demo data — synthetic example"
SEED_PROVIDER = "synthetic-seed"

# (days_ago, mood, sleep, workload, energy, available)
HISTORY = {
    "overloaded": [(6, 4, "good", 3, 4, 120), (5, 3, "okay", 4, 3, 90), (4, 3, "poor", 4, 2, 60),
                   (3, 4, "good", 3, 4, 150), (2, 2, "poor", 5, 2, 90), (1, 3, "okay", 5, 3, 120)],
    "manageable": [(6, 3, "okay", 3, 3, 90), (5, 4, "good", 2, 4, 120), (4, 4, "good", 3, 4, 120),
                   (3, 3, "okay", 3, 3, 60), (2, 4, "good", 2, 4, 120), (1, 5, "good", 2, 5, 150)],
}
TODAY = {
    "overloaded": dict(mood_score=3, sleep_quality="okay", workload_score=5, energy_score=2, available_minutes=120),
    "manageable": dict(mood_score=4, sleep_quality="good", workload_score=2, energy_score=4, available_minutes=120),
}


def _local_dt(day, hh, mm, zone) -> datetime:
    return datetime.combine(day, time(hh, mm), tzinfo=zone)


def _naive_utc(dt: datetime) -> datetime:
    return dt.astimezone(get_zone("UTC")).replace(tzinfo=None)


def _today_deadline(now_local: datetime, hh: int, fallback_minutes: int) -> datetime:
    """A deadline later *today*; if it's already late in the day, a short time from now."""
    target = now_local.replace(hour=hh, minute=0, second=0, microsecond=0)
    if target <= now_local + timedelta(minutes=60):
        target = now_local + timedelta(minutes=fallback_minutes)
    return target


def seed_demo(db: Session, user_id: str, scenario: str, timezone: str) -> dict:
    if scenario not in HISTORY:
        raise ValueError("scenario must be 'overloaded' or 'manageable'")
    delete_all_user_data(db, user_id)

    zone = get_zone(timezone)
    now = now_utc()
    now_local = now.astimezone(zone)
    today = now_local.date()
    yesterday = today - timedelta(days=1)

    user = User(id=user_id, nickname="Demo student", language="en", timezone=zone.key,
                preferred_session_minutes=30, default_available_minutes=120, consent_acknowledged=True,
                is_synthetic=True)
    db.add(user)
    db.flush()

    for days_ago, mood, sleep, workload, energy, avail in HISTORY[scenario]:
        db.add(CheckIn(user_id=user_id, local_date=today - timedelta(days=days_ago), mood_score=mood,
                       sleep_quality=sleep, workload_score=workload, energy_score=energy,
                       available_minutes=avail, is_synthetic=True,
                       created_at=_naive_utc(_local_dt(today - timedelta(days=days_ago), 9, 0, zone))))
    db.add(CheckIn(user_id=user_id, local_date=today, is_synthetic=True, **TODAY[scenario]))

    def task(title, subject, ttype, deadline_local, minutes, priority, status="pending", completed_days_ago=None):
        t = Task(user_id=user_id, title=title, subject=subject, task_type=ttype,
                 deadline=_naive_utc(deadline_local), estimated_minutes=minutes, priority=priority,
                 status=status, is_synthetic=True,
                 created_at=_naive_utc(now_local - timedelta(days=3)))
        if status == "completed":
            t.completed_at = _naive_utc(now_local - timedelta(days=completed_days_ago or 1))
        db.add(t)
        return t

    if scenario == "overloaded":
        main = task("DBMS assignment", "Database Systems", "assignment", _today_deadline(now_local, 21, 150), 90, "high")
        task("DSA practice", "Data Structures", "other", _today_deadline(now_local, 23, 210), 30, "medium")
        task("AI quiz revision", "Artificial Intelligence", "quiz", _local_dt(today + timedelta(days=1), 14, 0, zone), 60, "medium")
        task("Thesis literature review", "Final Year Project", "project", _local_dt(today + timedelta(days=9), 17, 0, zone), 120, "low")
        done = task("Linear algebra worksheet", "Mathematics", "assignment", _local_dt(yesterday, 17, 0, zone), 45, "medium",
                    status="completed", completed_days_ago=1)
    else:
        main = task("Operating Systems: read chapter 5", "Operating Systems", "reading",
                    _local_dt(today + timedelta(days=2), 9, 0, zone), 45, "medium")
        task("Networks lab report", "Computer Networks", "assignment", _local_dt(today + timedelta(days=4), 23, 0, zone), 60, "high")
        task("Statistics quiz prep", "Statistics", "quiz", _local_dt(today + timedelta(days=1), 11, 0, zone), 30, "low")
        done = task("Software Engineering diagram", "Software Engineering", "project", _local_dt(yesterday, 18, 0, zone), 40, "medium",
                    status="completed", completed_days_ago=1)
    db.flush()

    # One synthetic plan + feedback from yesterday (NOT AI output — clearly labelled).
    plan_time = _naive_utc(_local_dt(yesterday, 16, 0, zone))
    session = 30
    items = [
        ("study", done, f"{done.title}: first half", session, "Work through the first half.", "Nearest deadline yesterday."),
        ("break", None, "Short screen break", 5, "Step away from the screen.", "Pause between blocks."),
        ("study", main, f"{main.title}: get started", session, "Outline the first section.", "Next most urgent task."),
        ("wellbeing", None, "Stretch and water", 3, "Stand, stretch gently and have some water.", "A short reset."),
    ]
    completed_flags = [True, False, False, True] if scenario == "overloaded" else [True, True, True, True]
    content = {
        "title": "Yesterday's plan (synthetic example)",
        "supportive_message": "This is a synthetic demo record created by the seed script, not AI output.",
        "workload_status": "over_capacity" if scenario == "overloaded" else "manageable",
        "workload_summary": "Synthetic example.",
        "total_planned_minutes": sum(i[3] for i in items),
        "available_minutes": 120,
        "study_tip": "Synthetic example.",
        "affirmation": "Synthetic example.",
        "why_this_plan": "Seeded so the demo has plan and feedback history.",
        "fallback_plan": "Synthetic example.",
        "wellbeing_activity": {"title": "Stretch and water", "activity_type": "stretch_and_water",
                               "duration_minutes": 3, "instructions": "Stand, stretch gently and have some water."},
        "deferred_tasks": [],
        "adaptation_explanations": [],
        "constraints": {"available_minutes": 120, "buffer_minutes": 5, "budget_minutes": 115,
                        "session_minutes": session, "max_study_tasks": 2, "keep_breaks": True,
                        "low_energy_mode": False, "notes": []},
        "repairs": [],
        "missing_info": [],
        "synthetic_note": DEMO_LABEL,
    }
    plan = Plan(user_id=user_id, local_date=yesterday, language="en", plan_json=content,
                provider=SEED_PROVIDER, model="none (not AI)", status="active", is_synthetic=True,
                created_at=plan_time)
    db.add(plan)
    db.flush()
    for pos, ((itype, t, title, dur, instr, reason), flag) in enumerate(zip(items, completed_flags)):
        db.add(PlanItem(plan_id=plan.id, task_id=t.id if t else None, position=pos, item_type=itype, title=title,
                        instructions=instr, reason=reason, duration_minutes=dur, completed=flag,
                        completed_at=plan_time + timedelta(hours=pos + 1) if flag else None,
                        task_title_snapshot=t.title if t else None))
    db.flush()
    db.refresh(plan)

    # Feedback is run through the real adaptation engine so the seeded events are genuine rule output.
    from app.api.routes.feedback import FeedbackCreate, apply_adaptation

    fb_body = (
        FeedbackCreate(plan_id=plan.id, completion_status="partially", manageable_rating=2, helpfulness_rating=3,
                       reason_code="sessions_too_long", breaks_helpful=True)
        if scenario == "overloaded"
        else FeedbackCreate(plan_id=plan.id, completion_status="yes", manageable_rating=5, helpfulness_rating=4,
                            reason_code="plan_was_helpful", breaks_helpful=True)
    )
    feedback = Feedback(user_id=user_id, plan_id=plan.id, completion_status=fb_body.completion_status,
                        manageable_rating=fb_body.manageable_rating, helpfulness_rating=fb_body.helpfulness_rating,
                        reason_code=fb_body.reason_code, breaks_helpful=fb_body.breaks_helpful, is_synthetic=True,
                        created_at=plan_time + timedelta(hours=5))
    db.add(feedback)
    db.flush()
    _outcome, events = apply_adaptation(db, user, plan, fb_body, feedback)
    for ev in events:
        ev.is_synthetic = True
        ev.created_at = plan_time + timedelta(hours=5)

    db.commit()
    db.refresh(user)
    return {
        "scenario": scenario,
        "profile": user,
        "counts": {"checkins": len(HISTORY[scenario]) + 1, "tasks": 5 if scenario == "overloaded" else 4,
                   "plans": 1, "feedback": 1, "adaptation_events": len(events)},
        "label": DEMO_LABEL,
    }
