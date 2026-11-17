from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import now_utc, today_local
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, current_user, load_user
from app.db.database import get_db
from app.db.models import CheckIn, User
from app.schemas.checkin import CheckInCreate, CheckInOut, CheckInSaved
from app.services.events_service import track

router = APIRouter(tags=["checkins"])


@router.post("/checkins", response_model=CheckInSaved)
def save_checkin(body: CheckInCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    today = today_local(user.timezone)
    day = body.local_date or today
    # Allow a 1-day skew for browser/server timezone edges; no far-future or very old edits.
    if day > today + timedelta(days=1) or day < today - timedelta(days=7):
        raise ApiError(422, "invalid_date", "Check-ins can only be saved for today or the past week.")

    existing = db.scalar(select(CheckIn).where(CheckIn.user_id == user.id, CheckIn.local_date == day))
    values = body.model_dump(exclude={"local_date"})
    if existing:
        # One check-in per day: an edit updates the same record (no duplicate chart points).
        for k, v in values.items():
            setattr(existing, k, v)
        existing.revision += 1
        existing.is_synthetic = False
        existing.updated_at = now_utc()
        checkin, updated = existing, True
    else:
        checkin = CheckIn(user_id=user.id, local_date=day, **values)
        db.add(checkin)
        updated = False
    track(db, user.id, "checkin_saved")
    db.commit()
    db.refresh(checkin)
    return CheckInSaved(checkin=CheckInOut.model_validate(checkin), updated_existing=updated)


@router.get("/checkins/{user_id}")
def list_checkins(
    user_id: str,
    days: int = Query(default=30, ge=1, le=120),
    caller: str = Depends(caller_id),
    db: Session = Depends(get_db),
):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    today = today_local(user.timezone)
    rows = db.scalars(
        select(CheckIn)
        .where(CheckIn.user_id == user_id, CheckIn.local_date >= today - timedelta(days=days - 1))
        .order_by(CheckIn.local_date.desc())
    ).all()
    items = [CheckInOut.model_validate(r) for r in rows]
    todays = next((c for c in items if c.local_date == today), None)
    return {"today_local_date": today.isoformat(), "today": todays, "items": items}
