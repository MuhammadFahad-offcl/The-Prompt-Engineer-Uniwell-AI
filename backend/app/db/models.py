"""SQLAlchemy models. All timestamps are stored as UTC; `local_date` keeps the student's day."""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import now_utc
from app.db.database import Base


def new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String(40), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="en")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Karachi")
    preferred_session_minutes: Mapped[int] = mapped_column(Integer, default=25)
    default_available_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consent_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)

    # Adaptation state written only by the adaptation engine (visible + resettable in Settings)
    adapted_session_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_tasks_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    buffer_minutes: Mapped[int] = mapped_column(Integer, default=5)
    keep_breaks: Mapped[bool] = mapped_column(Boolean, default=True)
    noncompletion_streak: Mapped[int] = mapped_column(Integer, default=0)

    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    @property
    def effective_session_minutes(self) -> int:
        return self.adapted_session_minutes or self.preferred_session_minutes


class CheckIn(Base):
    __tablename__ = "checkins"
    __table_args__ = (
        UniqueConstraint("user_id", "local_date", name="uq_checkin_user_day"),
        Index("ix_checkins_user_date", "user_id", "local_date"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    local_date: Mapped[date] = mapped_column(Date)
    mood_score: Mapped[int] = mapped_column(Integer)
    sleep_quality: Mapped[str] = mapped_column(String(8))
    workload_score: Mapped[int] = mapped_column(Integer)
    energy_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    available_minutes: Mapped[int] = mapped_column(Integer)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_user_deadline", "user_id", "deadline"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(120))
    subject: Mapped[str | None] = mapped_column(String(80), nullable=True)
    task_type: Mapped[str] = mapped_column(String(16), default="assignment")
    deadline: Mapped[datetime] = mapped_column(DateTime)  # UTC
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    priority: Mapped[str] = mapped_column(String(8), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (Index("ix_plans_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    checkin_id: Mapped[str | None] = mapped_column(
        ForeignKey("checkins.id", ondelete="SET NULL"), nullable=True
    )
    local_date: Mapped[date] = mapped_column(Date)
    language: Mapped[str] = mapped_column(String(16), default="en")
    plan_json: Mapped[dict] = mapped_column(JSON)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | superseded
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    items: Mapped[list["PlanItem"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanItem.position"
    )


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True)
    # Deleting a task must not break history: keep a title snapshot and null the link.
    task_id: Mapped[str | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer)
    item_type: Mapped[str] = mapped_column(String(16))  # study | break | wellbeing
    title: Mapped[str] = mapped_column(String(160))
    instructions: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    task_title_snapshot: Mapped[str | None] = mapped_column(String(120), nullable=True)

    plan: Mapped[Plan] = relationship(back_populates="items")


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (UniqueConstraint("plan_id", name="uq_feedback_plan"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"))
    completion_status: Mapped[str] = mapped_column(String(16))  # yes | partially | no
    manageable_rating: Mapped[int] = mapped_column(Integer)
    helpfulness_rating: Mapped[int] = mapped_column(Integer)
    reason_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    breaks_helpful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class AdaptationEvent(Base):
    __tablename__ = "adaptation_events"
    __table_args__ = (Index("ix_adapt_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    feedback_id: Mapped[str | None] = mapped_column(
        ForeignKey("feedback.id", ondelete="SET NULL"), nullable=True
    )
    rule_applied: Mapped[str] = mapped_column(String(48))
    previous_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    publisher: Mapped[str] = mapped_column(String(120))
    url: Mapped[str] = mapped_column(String(400))
    topic: Mapped[str] = mapped_column(String(60))
    language: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    rights_note: Mapped[str] = mapped_column(Text)
    verification_status: Mapped[str] = mapped_column(String(16), default="unverified")
    source_updated: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_checked_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)


class ProductEvent(Base):
    """Coarse analytics only — never check-in values, free text or identifiers beyond user_id."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    event_name: Mapped[str] = mapped_column(String(48))
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


# ---------------------------------------------------------------- MindBalance Engine
class WellbeingCheckIn(Base):
    """MindBalance check-in (several per day allowed). Self-reported; never a diagnosis."""

    __tablename__ = "wellbeing_checkins"
    __table_args__ = (Index("ix_wb_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    local_date: Mapped[date] = mapped_column(Date)
    mood: Mapped[str] = mapped_column(String(12))  # very_good | good | neutral | low | very_low
    stress: Mapped[int] = mapped_column(Integer)  # 1-10
    energy: Mapped[int] = mapped_column(Integer)  # 1-10
    mental_condition: Mapped[str] = mapped_column(String(24))
    academic_pressure: Mapped[str] = mapped_column(String(12))  # low | moderate | high | very_high
    note_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)  # optional, Fernet-encrypted
    state: Mapped[str] = mapped_column(String(24))
    state_reasons: Mapped[list] = mapped_column(JSON, default=list)
    kind: Mapped[str] = mapped_column(String(12), default="daily")  # daily | post_activity
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class RecoverySession(Base):
    __tablename__ = "recovery_sessions"
    __table_args__ = (Index("ix_recovery_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    checkin_id: Mapped[str | None] = mapped_column(ForeignKey("wellbeing_checkins.id", ondelete="SET NULL"), nullable=True)
    activity: Mapped[str] = mapped_column(String(24))  # breathing | grounding | journal | energy | motivation
    variant: Mapped[str | None] = mapped_column(String(40), nullable=True)  # e.g. "2min", "stretching"
    status: Mapped[str] = mapped_column(String(12), default="started")  # started | completed | skipped
    pre_stress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pre_energy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_stress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_energy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    helpful: Mapped[str | None] = mapped_column(String(12), nullable=True)  # yes | somewhat | no
    steps_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class JournalEntry(Base):
    """Thought-unloading journal. All text fields are Fernet-encrypted at rest and never sent to an LLM."""

    __tablename__ = "journal_entries"
    __table_args__ = (Index("ix_journal_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[str | None] = mapped_column(ForeignKey("recovery_sessions.id", ondelete="SET NULL"), nullable=True)
    bothering_enc: Mapped[str] = mapped_column(Text)
    in_control_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    outside_control_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    small_action_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class PlanAdjustment(Base):
    """Proposed wellbeing-aware schedule changes. Nothing is applied until the student confirms."""

    __tablename__ = "plan_adjustments"
    __table_args__ = (Index("ix_adjust_user_date", "user_id", "local_date"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    checkin_id: Mapped[str | None] = mapped_column(ForeignKey("wellbeing_checkins.id", ondelete="SET NULL"), nullable=True)
    local_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | applied | dismissed
    pressure_level: Mapped[str] = mapped_column(String(12))
    summary: Mapped[str] = mapped_column(Text)
    changes: Mapped[list] = mapped_column(JSON, default=list)  # [{id, type, task_id, title, detail, reason, accepted}]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
