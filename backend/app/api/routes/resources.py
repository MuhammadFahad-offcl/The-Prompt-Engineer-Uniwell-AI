from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Resource
from app.schemas.common import ORMModel

router = APIRouter(tags=["resources"])


class ResourceOut(ORMModel):
    id: str
    title: str
    publisher: str
    url: str
    topic: str
    language: str
    summary: str
    rights_note: str
    verification_status: str
    source_updated: str | None
    last_checked_at: str | None
    reviewed: bool


@router.get("/resources", response_model=list[ResourceOut])
def list_resources(db: Session = Depends(get_db)):
    """Public catalogue — contains no user data."""
    return db.scalars(select(Resource).order_by(Resource.publisher, Resource.title)).all()
