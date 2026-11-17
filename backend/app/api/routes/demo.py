from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, validate_user_id
from app.db.database import get_db
from app.schemas.profile import ProfileOut
from app.services.demo_service import seed_demo
from app.services.events_service import track

router = APIRouter(tags=["demo"])


class SeedRequest(BaseModel):
    user_id: str
    scenario: Literal["overloaded", "manageable"] = "overloaded"
    timezone: str = Field(default="Asia/Karachi", max_length=64)

    @field_validator("user_id")
    @classmethod
    def _uid(cls, v: str) -> str:
        return validate_user_id(v)


@router.post("/demo/seed")
def seed(body: SeedRequest, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    """Development/demo only: replace THIS anonymous ID's data with a labelled synthetic student."""
    if not get_settings().is_development:
        raise ApiError(404, "not_found", "Demo seeding is disabled outside development.")
    assert_same_user(body.user_id, caller)
    result = seed_demo(db, body.user_id, body.scenario, body.timezone)
    track(db, body.user_id, "demo_seeded", scenario=body.scenario)
    db.commit()
    return {**result, "profile": ProfileOut.model_validate(result["profile"])}
