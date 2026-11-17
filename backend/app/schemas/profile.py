from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_user_id
from app.schemas.common import SESSION_CHOICES, Language, ORMModel, UtcDatetime


class ProfileUpsert(BaseModel):
    user_id: str
    nickname: str | None = Field(default=None, max_length=40)
    language: Language = "en"
    preferred_session_minutes: int = 25
    default_available_minutes: int | None = Field(default=None, ge=10, le=720)
    timezone: str = Field(default="Asia/Karachi", max_length=64)
    consent_acknowledged: bool

    @field_validator("user_id")
    @classmethod
    def _uid(cls, v: str) -> str:
        return validate_user_id(v)

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    @field_validator("preferred_session_minutes")
    @classmethod
    def _session(cls, v: int) -> int:
        if v not in SESSION_CHOICES:
            raise ValueError(f"must be one of {', '.join(map(str, SESSION_CHOICES))}")
        return v

    @field_validator("consent_acknowledged")
    @classmethod
    def _consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("please acknowledge the privacy & non-clinical notice to continue")
        return v


class ProfileOut(ORMModel):
    id: str
    nickname: str | None
    language: Language
    timezone: str
    preferred_session_minutes: int
    default_available_minutes: int | None
    consent_acknowledged: bool
    adapted_session_minutes: int | None
    effective_session_minutes: int
    max_tasks_override: int | None
    buffer_minutes: int
    keep_breaks: bool
    noncompletion_streak: int
    is_synthetic: bool
    created_at: UtcDatetime
    updated_at: UtcDatetime
