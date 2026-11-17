from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import now_utc, today_local
from app.core.security import assert_same_user, caller_id, load_user
from app.db.database import get_db
from app.db.models import CheckIn, Task, User
from app.services.events_service import track
from app.services.workload_engine import compute_radar

router = APIRouter(tags=["radar"])


def available_time_for_today(db: Session, user: User) -> tuple[int | None, str | None, CheckIn | None]:
    checkin = db.scalar(
        select(CheckIn).where(CheckIn.user_id == user.id, CheckIn.local_date == today_local(user.timezone))
    )
    if checkin:
        return checkin.available_minutes, "checkin", checkin
    if user.default_available_minutes:
        return user.default_available_minutes, "profile_default", None
    return None, None, None


def radar_for_user(db: Session, user: User) -> dict:
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id)).all())
    available, source, _ = available_time_for_today(db, user)
    return compute_radar(tasks, available, source, now_utc(), user.timezone)


@router.get("/radar/{user_id}")
def get_radar(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    result = radar_for_user(db, user)
    track(db, user.id, "radar_viewed")
    db.commit()
    return result
