from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, SleepQuality, UtcDatetime


class CheckInCreate(BaseModel):
    local_date: date | None = Field(
        default=None, description="Student's local date; defaults to today in the profile timezone."
    )
    mood_score: int = Field(ge=1, le=5)
    sleep_quality: SleepQuality
    workload_score: int = Field(ge=1, le=5)
    energy_score: int | None = Field(default=None, ge=1, le=5)
    available_minutes: int = Field(ge=10, le=720)


class CheckInOut(ORMModel):
    id: str
    local_date: date
    mood_score: int
    sleep_quality: SleepQuality
    workload_score: int
    energy_score: int | None
    available_minutes: int
    revision: int
    is_synthetic: bool
    created_at: UtcDatetime
    updated_at: UtcDatetime


class CheckInSaved(BaseModel):
    checkin: CheckInOut
    updated_existing: bool
