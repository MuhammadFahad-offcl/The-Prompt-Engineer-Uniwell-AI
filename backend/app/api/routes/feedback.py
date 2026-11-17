from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import current_user
from app.db.database import get_db
from app.db.models import AdaptationEvent, Feedback, Plan, User
from app.schemas.common import CompletionStatus, ReasonCode
from app.schemas.plan import AdaptationEventOut, FeedbackOut
from app.services.adaptation_engine import AdaptState, FeedbackSignal, apply_feedback_rules
from app.services.events_service import track

router = APIRouter(tags=["feedback"])


class FeedbackCreate(BaseModel):
    plan_id: str
    completion_status: CompletionStatus
    manageable_rating: int = Field(ge=1, le=5)
    helpfulness_rating: int = Field(ge=1, le=5)
    reason_code: ReasonCode | None = None
    breaks_helpful: bool | None = None


def signal_from_plan(plan: Plan, body: FeedbackCreate) -> FeedbackSignal:
    study = [i for i in plan.items if i.item_type == "study"]
    # Count tasks by snapshot so a task deleted after planning still counts correctly.
    tasks = {i.task_id or i.task_title_snapshot for i in study if (i.task_id or i.task_title_snapshot)}
    used_session = (plan.plan_json or {}).get("constraints", {}).get("session_minutes")
    longest = max((i.duration_minutes for i in study), default=None)
    return FeedbackSignal(
        completion_status=body.completion_status,
        manageable=body.manageable_rating,
        helpful=body.helpfulness_rating,
        reason_code=body.reason_code,
        breaks_helpful=body.breaks_helpful,
        items_completed=sum(1 for i in plan.items if i.completed),
        items_total=len(plan.items),
        plan_session_minutes=used_session or longest,
        plan_study_tasks=len(tasks) or (1 if study else 0),
    )


def apply_adaptation(db: Session, user: User, plan: Plan, body: FeedbackCreate, feedback: Feedback):
    state = AdaptState(
        preferred_session_minutes=user.preferred_session_minutes,
        adapted_session_minutes=user.adapted_session_minutes,
        max_tasks_override=user.max_tasks_override,
        buffer_minutes=user.buffer_minutes,
        keep_breaks=user.keep_breaks,
        noncompletion_streak=user.noncompletion_streak,
    )
    outcome = apply_feedback_rules(state, signal_from_plan(plan, body))
    new = outcome.state
    user.adapted_session_minutes = new.adapted_session_minutes
    user.max_tasks_override = new.max_tasks_override
    user.buffer_minutes = new.buffer_minutes
    user.keep_breaks = new.keep_breaks
    user.noncompletion_streak = new.noncompletion_streak
    events = []
    for ch in outcome.changes:
        ev = AdaptationEvent(user_id=user.id, feedback_id=feedback.id, rule_applied=ch.rule,
                             previous_value=ch.previous, new_value=ch.new, reason=ch.reason)
        db.add(ev)
        events.append(ev)
    return outcome, events


@router.post("/feedback")
def submit_feedback(body: FeedbackCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    plan = db.get(Plan, body.plan_id)
    if plan is None or plan.user_id != user.id:
        raise ApiError(404, "plan_not_found", "Plan not found.")
    if db.scalar(select(Feedback).where(Feedback.plan_id == plan.id)):
        raise ApiError(409, "feedback_exists", "Feedback was already submitted for this plan.")

    feedback = Feedback(
        user_id=user.id,
        plan_id=plan.id,
        completion_status=body.completion_status,
        manageable_rating=body.manageable_rating,
        helpfulness_rating=body.helpfulness_rating,
        reason_code=body.reason_code,
        breaks_helpful=body.breaks_helpful,
    )
    db.add(feedback)
    db.flush()
    outcome, events = apply_adaptation(db, user, plan, body, feedback)
    track(db, user.id, "feedback_submitted")
    db.commit()
    for ev in events:
        db.refresh(ev)
    db.refresh(feedback)
    return {
        "feedback": FeedbackOut.model_validate(feedback),
        "adaptation_events": [AdaptationEventOut.model_validate(e) for e in events],
        "next_constraints_preview": {
            "session_minutes": user.effective_session_minutes,
            "max_tasks_override": user.max_tasks_override,
            "buffer_minutes": user.buffer_minutes,
            "keep_breaks": user.keep_breaks,
        },
        "ask_availability": outcome.ask_availability,
    }
