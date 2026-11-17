from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel, Priority, TaskStatus, TaskType, UtcDatetime
from app.services.safety_service import sanitize_text


def _clean_title(v: str) -> str:
    cleaned = sanitize_text(v, 120)
    if not cleaned:
        raise ValueError("title is required")
    return cleaned


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=120)
    task_type: TaskType = "assignment"
    deadline: datetime
    estimated_minutes: int = Field(ge=5, le=720)
    priority: Priority = "medium"
    status: TaskStatus = "pending"

    @field_validator("title")
    @classmethod
    def _v_title(cls, v: str) -> str:
        return _clean_title(v)

    @field_validator("subject")
    @classmethod
    def _v_subject(cls, v: str | None) -> str | None:
        return sanitize_text(v, 80)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=120)
    task_type: TaskType | None = None
    deadline: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=720)
    priority: Priority | None = None
    status: TaskStatus | None = None

    @field_validator("title")
    @classmethod
    def _v_title(cls, v: str | None) -> str | None:
        return None if v is None else _clean_title(v)

    @field_validator("subject")
    @classmethod
    def _v_subject(cls, v: str | None) -> str | None:
        return sanitize_text(v, 80)


class TaskOut(ORMModel):
    id: str
    title: str
    subject: str | None
    task_type: TaskType
    deadline: UtcDatetime
    estimated_minutes: int
    priority: Priority
    status: TaskStatus
    completed_at: UtcDatetime | None
    is_overdue: bool = False
    is_synthetic: bool
    created_at: UtcDatetime
    updated_at: UtcDatetime
