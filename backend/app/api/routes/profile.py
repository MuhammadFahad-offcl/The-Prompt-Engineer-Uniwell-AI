from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.clock import get_zone
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, load_user
from app.db.database import get_db
from app.db.models import (
    AdaptationEvent,
    CheckIn,
    Feedback,
    Plan,
    PlanItem,
    ProductEvent,
    Task,
    User,
)
from app.schemas.profile import ProfileOut, ProfileUpsert
from app.services.events_service import track

router = APIRouter(tags=["profile"])


@router.post("/profile", response_model=ProfileOut)
def upsert_profile(body: ProfileUpsert, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(body.user_id, caller)
    tz = get_zone(body.timezone).key
    user = db.get(User, body.user_id)
    created = user is None
    if created:
        user = User(id=body.user_id)
        db.add(user)
    elif user.preferred_session_minutes != body.preferred_session_minutes:
        # A manual preference change wins over earlier automatic adaptation.
        if user.adapted_session_minutes is not None:
            db.add(
                AdaptationEvent(
                    user_id=user.id,
                    rule_applied="manual_preference_reset",
                    previous_value=str(user.adapted_session_minutes),
                    new_value=str(body.preferred_session_minutes),
                    reason="You changed your preferred session length, so earlier automatic "
                    "session adjustments were cleared.",
                )
            )
        user.adapted_session_minutes = None

    user.nickname = body.nickname
    user.language = body.language
    user.preferred_session_minutes = body.preferred_session_minutes
    user.default_available_minutes = body.default_available_minutes
    user.timezone = tz
    user.consent_acknowledged = body.consent_acknowledged
    if created:
        track(db, user.id, "onboarding_completed")
    db.commit()
    db.refresh(user)
    return user


@router.get("/profile/{user_id}", response_model=ProfileOut)
def get_profile(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    return load_user(db, user_id)


@router.post("/profile/{user_id}/reset-adaptation", response_model=ProfileOut)
def reset_adaptation(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    """Let the student undo automatic adaptations (student agency)."""
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    db.add(
        AdaptationEvent(
            user_id=user.id,
            rule_applied="manual_adaptation_reset",
            previous_value=f"session={user.effective_session_minutes},max_tasks={user.max_tasks_override},buffer={user.buffer_minutes}",
            new_value=f"session={user.preferred_session_minutes},max_tasks=None,buffer=5",
            reason="You reset automatic plan adjustments back to your own preferences.",
        )
    )
    user.adapted_session_minutes = None
    user.max_tasks_override = None
    user.buffer_minutes = 5
    user.keep_breaks = True
    user.noncompletion_streak = 0
    db.commit()
    db.refresh(user)
    return user


def delete_all_user_data(db: Session, user_id: str) -> dict:
    """Remove every record tied to this anonymous ID. Returns per-table counts."""
    plan_ids = select(Plan.id).where(Plan.user_id == user_id)
    counts = {}
    for name, stmt in (
        ("plan_items", delete(PlanItem).where(PlanItem.plan_id.in_(plan_ids))),
        ("adaptation_events", delete(AdaptationEvent).where(AdaptationEvent.user_id == user_id)),
        ("feedback", delete(Feedback).where(Feedback.user_id == user_id)),
        ("plans", delete(Plan).where(Plan.user_id == user_id)),
        ("checkins", delete(CheckIn).where(CheckIn.user_id == user_id)),
        ("tasks", delete(Task).where(Task.user_id == user_id)),
        ("events", delete(ProductEvent).where(ProductEvent.user_id == user_id)),
        ("users", delete(User).where(User.id == user_id)),
    ):
        counts[name] = db.execute(stmt.execution_options(synchronize_session=False)).rowcount or 0
    return counts


@router.delete("/user/{user_id}/data")
def delete_user_data(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    if db.get(User, user_id) is None:
        raise ApiError(404, "profile_not_found", "No data found for this anonymous ID.")
    counts = delete_all_user_data(db, user_id)
    # Anonymous count only — the user row is gone, so this event has no user link.
    track(db, None, "data_deleted")
    db.commit()
    return {"deleted": True, "records_removed": counts}
