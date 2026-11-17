"""Single source of 'now' so tests can freeze time."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TZ = "Asia/Karachi"

_frozen_now: datetime | None = None


def freeze_now(value: datetime | None) -> None:
    """Test helper: pin 'now' to a fixed aware datetime (None to unfreeze)."""
    global _frozen_now
    _frozen_now = value


def now_utc() -> datetime:
    if _frozen_now is not None:
        return _frozen_now.astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def get_zone(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or DEFAULT_TZ)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TZ)


def now_local(tz_name: str | None) -> datetime:
    return now_utc().astimezone(get_zone(tz_name))


def today_local(tz_name: str | None) -> date:
    return now_local(tz_name).date()


def as_utc(dt: datetime, tz_name: str | None = None) -> datetime:
    """Normalise a datetime to aware UTC. Naive values are read in the user's timezone."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=get_zone(tz_name))
    return dt.astimezone(timezone.utc)


def ensure_aware_utc(dt: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; values are always stored as UTC, so re-attach it."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
