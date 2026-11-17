"""User data lifecycle helpers."""
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    AdaptationEvent,
    CheckIn,
    Feedback,
    JournalEntry,
    Plan,
    PlanAdjustment,
    PlanItem,
    ProductEvent,
    RecoverySession,
    Task,
    User,
    WellbeingCheckIn,
)


def delete_all_user_data(db: Session, user_id: str) -> dict:
    """Remove every record tied to this anonymous ID. Returns per-table counts."""
    plan_ids = select(Plan.id).where(Plan.user_id == user_id)
    counts = {}
    for name, stmt in (
        ("journal_entries", delete(JournalEntry).where(JournalEntry.user_id == user_id)),
        ("recovery_sessions", delete(RecoverySession).where(RecoverySession.user_id == user_id)),
        ("plan_adjustments", delete(PlanAdjustment).where(PlanAdjustment.user_id == user_id)),
        ("wellbeing_checkins", delete(WellbeingCheckIn).where(WellbeingCheckIn.user_id == user_id)),
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
