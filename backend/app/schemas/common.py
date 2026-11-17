from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PlainSerializer

Language = Literal["en", "roman_urdu"]
SleepQuality = Literal["poor", "okay", "good"]
TaskType = Literal["assignment", "quiz", "exam", "project", "reading", "other"]
Priority = Literal["low", "medium", "high"]
TaskStatus = Literal["pending", "in_progress", "completed"]
CompletionStatus = Literal["yes", "partially", "no"]
ReasonCode = Literal[
    "too_many_tasks",
    "sessions_too_long",
    "unexpected_event",
    "not_enough_time",
    "plan_was_helpful",
    "other",
]
SESSION_CHOICES = (15, 20, 25, 30, 40, 45)


def _utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# Serialise every timestamp as explicit UTC ("...Z") so the browser converts to local time correctly.
UtcDatetime = Annotated[datetime, PlainSerializer(_utc_iso, return_type=str)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
