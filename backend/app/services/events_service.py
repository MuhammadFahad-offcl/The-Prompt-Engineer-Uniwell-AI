"""Privacy-conscious product analytics: event names + coarse, non-sensitive metadata only."""
import logging

from sqlalchemy.orm import Session

from app.db.models import ProductEvent

log = logging.getLogger("uniwell.events")

ALLOWED_EVENTS = {
    "onboarding_completed",
    "checkin_saved",
    "task_created",
    "radar_viewed",
    "plan_generation_started",
    "plan_generation_succeeded",
    "plan_generation_failed",
    "plan_item_completed",
    "feedback_submitted",
    "insights_viewed",
    "data_deleted",
    "safety_message_shown",
    "demo_seeded",
}

# Only these metadata keys may ever be recorded (no mood values, no free text).
ALLOWED_META_KEYS = {"provider", "error_code", "scenario", "item_type", "latency_ms", "retry_used"}


def track(db: Session, user_id: str | None, name: str, **meta) -> None:
    if name not in ALLOWED_EVENTS:
        return
    clean = {k: v for k, v in meta.items() if k in ALLOWED_META_KEYS}
    db.add(ProductEvent(user_id=user_id, event_name=name, metadata_json=clean or None))
    log.info("event=%s %s", name, clean or "")
