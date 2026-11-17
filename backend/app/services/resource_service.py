"""Curated resource catalogue: metadata + links only (see DATA_SOURCES.md)."""
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import Resource

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "resources.json"


def load_resource_records() -> list[dict]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def seed_resources(db: Session) -> int:
    """Idempotent upsert of resources.json into SQLite."""
    records = load_resource_records()
    for rec in records:
        row = db.get(Resource, rec["id"])
        if row is None:
            row = Resource(id=rec["id"])
            db.add(row)
        for key in ("title", "publisher", "url", "topic", "language", "summary", "rights_note",
                    "verification_status", "source_updated", "last_checked_at", "reviewed"):
            setattr(row, key, rec.get(key))
    db.commit()
    return len(records)
