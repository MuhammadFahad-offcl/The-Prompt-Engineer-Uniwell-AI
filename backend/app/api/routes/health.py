from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.services.ai_service import provider_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover - only on a broken DB file
        db_ok = False
    settings = get_settings()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "app_env": settings.app_env,
        "demo_enabled": settings.is_development,
        "ai": provider_status(),
    }
