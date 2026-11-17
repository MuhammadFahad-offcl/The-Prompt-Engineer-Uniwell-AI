from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CompletionStatus, Language, ORMModel, ReasonCode, UtcDatetime

WELLBEING_ACTIVITY_TYPES = (
    "screen_break",
    "breathing_pause",
    "grounding",
    "stretch_and_water",
    "self_kindness",
    "ten_minute_start",
)


# ---- What the model must return (validated strictly) -------------------------------------
class AIPlanItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["study", "break", "wellbeing"]
    task_id: str | None = None
    title: str = Field(min_length=1, max_length=160)
    duration_minutes: int = Field(ge=1, le=240)
    instructions: str = Field(min_length=1, max_length=700)
    reason: str = Field(default="", max_length=500)
    activity_type: str | None = None


class AIDeferred(BaseModel):
    model_config = ConfigDict(extra="ignore")

    task_id: str
    reason: str = Field(min_length=1, max_length=400)
    suggested_review_date: str | None = None


class AIPlanOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1, max_length=140)
    supportive_message: str = Field(min_length=1, max_length=500)
    workload_summary: str = Field(min_length=1, max_length=500)
    items: list[AIPlanItem] = Field(min_length=1, max_length=14)
    study_tip: str = Field(min_length=1, max_length=400)
    affirmation: str = Field(min_length=1, max_length=240)
    why_this_plan: str = Field(min_length=1, max_length=900)
    fallback_plan: str = Field(min_length=1, max_length=600)
    deferred_tasks: list[AIDeferred] = Field(default_factory=list, max_length=30)
    missing_info: list[str] = Field(default_factory=list, max_length=5)


AI_OUTPUT_SCHEMA_HINT = {
    "title": "string — short plan title",
    "supportive_message": "string — 1-2 warm sentences",
    "workload_summary": "string — one sentence restating workload_radar in plain words",
    "items": [
        {
            "type": "study | break | wellbeing",
            "task_id": "string from candidate_tasks, or null",
            "title": "string",
            "duration_minutes": "integer",
            "instructions": "string — concrete first step",
            "reason": "string — why this block, why now",
            "activity_type": f"only for wellbeing: one of {list(WELLBEING_ACTIVITY_TYPES)}",
        }
    ],
    "study_tip": "string — one tip tailored to today",
    "affirmation": "string — one short kind line, no promises",
    "why_this_plan": "string — 2-3 sentences",
    "fallback_plan": "string — what to do with less time",
    "deferred_tasks": [
        {"task_id": "string from candidate_tasks", "reason": "string", "suggested_review_date": "YYYY-MM-DD or null"}
    ],
    "missing_info": ["string — optional: info that would improve the plan"],
}


# ---- API shapes -------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    user_id: str
    note: str | None = Field(default=None, max_length=500, description="Optional, transient; never stored.")


class PlanItemOut(ORMModel):
    id: str
    position: int
    item_type: str
    task_id: str | None
    title: str
    instructions: str
    reason: str
    duration_minutes: int
    completed: bool
    completed_at: UtcDatetime | None
    task_title_snapshot: str | None


class PlanItemUpdate(BaseModel):
    completed: bool


class FeedbackOut(ORMModel):
    id: str
    plan_id: str
    completion_status: CompletionStatus
    manageable_rating: int
    helpfulness_rating: int
    reason_code: ReasonCode | None
    breaks_helpful: bool | None
    is_synthetic: bool
    created_at: UtcDatetime


class PlanDetailOut(BaseModel):
    id: str
    local_date: date
    language: Language
    provider: str
    model: str
    status: str
    is_synthetic: bool
    created_at: UtcDatetime
    plan: dict
    items: list[PlanItemOut]
    feedback: FeedbackOut | None


class PlanSummaryOut(BaseModel):
    id: str
    local_date: date
    title: str
    provider: str
    model: str
    status: str
    is_synthetic: bool
    created_at: UtcDatetime
    total_planned_minutes: int
    items_total: int
    items_completed: int
    feedback: FeedbackOut | None


class AdaptationEventOut(ORMModel):
    id: str
    rule_applied: str
    previous_value: str | None
    new_value: str | None
    reason: str
    is_synthetic: bool
    created_at: UtcDatetime
