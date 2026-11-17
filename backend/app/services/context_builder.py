"""Student Context Engine — assembles the minimal JSON context sent to the AI.

Only the current user's data is read. No user ID, nickname, timezone name or other
identifier is sent to the model. Free text (task titles, subjects, the optional note) is
sanitized and placed inside a JSON data object, never into the system prompt.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import get_zone
from app.db.models import AdaptationEvent, CheckIn, Feedback, Plan, Task, User
from app.schemas.plan import WELLBEING_ACTIVITY_TYPES
from app.services.adaptation_engine import Constraints
from app.services.safety_service import sanitize_text
from app.services.workload_engine import RankedTask, rank_pending_tasks

MAX_CANDIDATE_TASKS = 8

URGENCY_LABEL = {"overdue": "overdue", "today": "due_today", "next_48h": "due_within_48h", "later": "due_later"}


@dataclass
class StudentContext:
    payload: dict
    candidates: list[RankedTask]
    not_considered: list[RankedTask]
    adaptation_explanations: list[str]
    previous_plan_at: datetime | None
    student_deferred: list[RankedTask] = field(default_factory=list)


def build_context(
    db: Session,
    *,
    user: User,
    checkin: CheckIn,
    radar: dict,
    constraints: Constraints,
    now_utc: datetime,
    note: str | None,
) -> StudentContext:
    zone = get_zone(user.timezone)
    local_now = now_utc.astimezone(zone)

    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id)).all())
    ranked = rank_pending_tasks(tasks, now_utc, user.timezone)
    candidates = ranked[:MAX_CANDIDATE_TASKS]
    not_considered = ranked[MAX_CANDIDATE_TASKS:]

    candidate_payload = [
        {
            "task_id": r.task.id,
            "title": sanitize_text(r.task.title, 120),
            "subject": sanitize_text(r.task.subject, 80),
            "type": r.task.task_type,
            "deadline_local": r.deadline_utc.astimezone(zone).strftime("%a %d %b %Y, %H:%M"),
            "hours_until_deadline": round((r.deadline_utc - now_utc).total_seconds() / 3600, 1),
            "urgency": URGENCY_LABEL[r.bucket],
            "estimated_minutes": r.task.estimated_minutes,
            "student_priority": r.task.priority,
            "rank": r.rank,
            "status": r.task.status,
        }
        for r in candidates
    ]

    recent_checkins = db.scalars(
        select(CheckIn)
        .where(
            CheckIn.user_id == user.id,
            CheckIn.local_date < checkin.local_date,
            CheckIn.local_date >= checkin.local_date - timedelta(days=7),
        )
        .order_by(CheckIn.local_date.desc())
    ).all()

    recent_plans = db.scalars(
        select(Plan).where(Plan.user_id == user.id).order_by(Plan.created_at.desc()).limit(5)
    ).all()
    plan_ids = [p.id for p in recent_plans]
    feedback_rows = (
        db.scalars(select(Feedback).where(Feedback.plan_id.in_(plan_ids)).order_by(Feedback.created_at.desc()).limit(3)).all()
        if plan_ids
        else []
    )
    plans_by_id = {p.id: p for p in recent_plans}
    recent_feedback = []
    for fb in feedback_rows:
        plan = plans_by_id.get(fb.plan_id)
        items = plan.items if plan else []
        study = [i for i in items if i.item_type == "study"]
        recent_feedback.append(
            {
                "plan_date": plan.local_date.isoformat() if plan else None,
                "followed_plan": fb.completion_status,
                "manageable_1_to_5": fb.manageable_rating,
                "helpful_1_to_5": fb.helpfulness_rating,
                "reason": fb.reason_code,
                "breaks_helpful": fb.breaks_helpful,
                "items_completed": sum(1 for i in items if i.completed),
                "items_total": len(items),
                "longest_study_block_minutes": max((i.duration_minutes for i in study), default=None),
            }
        )

    # Adaptations made since the previous plan are "new" for this plan and shown to the student.
    previous_plan_at = recent_plans[0].created_at if recent_plans else None
    events_q = select(AdaptationEvent).where(AdaptationEvent.user_id == user.id)
    if previous_plan_at is not None:
        events_q = events_q.where(AdaptationEvent.created_at >= previous_plan_at)
    new_events = db.scalars(events_q.order_by(AdaptationEvent.created_at)).all()
    adaptation_explanations = [e.reason for e in new_events if e.rule_applied != "manual_preference_reset"]

    older_events = db.scalars(
        select(AdaptationEvent)
        .where(AdaptationEvent.user_id == user.id)
        .order_by(AdaptationEvent.created_at.desc())
        .limit(5)
    ).all()

    payload = {
        "today": {
            "date": local_now.date().isoformat(),
            "weekday": local_now.strftime("%A"),
            "local_time": local_now.strftime("%H:%M"),
        },
        "profile": {
            "language": user.language,
            "preferred_session_minutes": user.preferred_session_minutes,
        },
        "checkin": {
            "mood_1_to_5": checkin.mood_score,
            "sleep_quality": checkin.sleep_quality,
            "perceived_workload_1_to_5": checkin.workload_score,
            "energy_1_to_5": checkin.energy_score,
            "available_minutes": checkin.available_minutes,
        },
        "workload_radar": {
            "status": radar["status"],
            "due_soon_minutes": radar["due_soon_minutes"],
            "overdue_minutes": radar["overdue_minutes"],
            "available_minutes": radar["available_minutes"],
            "ratio": radar["workload_ratio"],
        },
        "constraints": constraints.as_dict(),
        "candidate_tasks": candidate_payload,
        "other_pending_tasks_not_listed": len(not_considered),
        "recent_checkins": [
            {
                "date": c.local_date.isoformat(),
                "mood_1_to_5": c.mood_score,
                "sleep_quality": c.sleep_quality,
                "perceived_workload_1_to_5": c.workload_score,
                "energy_1_to_5": c.energy_score,
            }
            for c in recent_checkins
        ],
        "recent_feedback": recent_feedback,
        "adaptation_notes": adaptation_explanations
        or [e.reason for e in older_events if e.rule_applied not in ("manual_preference_reset",)][:3],
        "student_note_untrusted": sanitize_text(note, 280),
        "allowed_wellbeing_activities": list(WELLBEING_ACTIVITY_TYPES),
    }
    return StudentContext(
        payload=payload,
        candidates=candidates,
        not_considered=not_considered,
        adaptation_explanations=adaptation_explanations,
        previous_plan_at=previous_plan_at,
    )
