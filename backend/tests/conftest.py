"""Shared fixtures: an isolated in-memory DB per test and a frozen clock.

Automated tests never call a real AI provider; AI calls are replaced with a mock provider
in the tests that need one (see test_plans.py). The live demo uses a real provider.
"""
import os
import uuid
from datetime import datetime, timezone

os.environ.setdefault("APP_ENV", "test")
os.environ["AI_PROVIDER"] = "gemini"  # tests are independent of the developer's .env
os.environ["GEMINI_API_KEY"] = ""  # never hit a real provider from tests
os.environ["GROQ_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import clock
from app.core.config import get_settings
from app.db import database
from app.db.database import Base, get_db
from app.main import create_app

# 17 Nov 2026, 10:00 in Asia/Karachi (UTC+5)
FROZEN_NOW = datetime(2026, 11, 17, 5, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _frozen_clock():
    clock.freeze_now(FROZEN_NOW)
    yield
    clock.freeze_now(None)


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    from app.db import models  # noqa: F401

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine):
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as s:
        yield s


@pytest.fixture
def client(engine, monkeypatch):
    get_settings.cache_clear()
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    # Lifespan seeding uses database.SessionLocal / init_db: point both at the test engine.
    monkeypatch.setattr(database, "SessionLocal", Session)
    monkeypatch.setattr("app.main.SessionLocal", Session)
    monkeypatch.setattr("app.main.init_db", lambda: Base.metadata.create_all(engine))

    app = create_app()

    def _get_db():
        with Session() as s:
            yield s

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c


def new_uid() -> str:
    return "test-" + uuid.uuid4().hex[:16]


def make_profile(client, uid: str | None = None, **overrides) -> str:
    uid = uid or new_uid()
    body = {
        "user_id": uid,
        "nickname": "Tester",
        "language": "en",
        "preferred_session_minutes": 30,
        "timezone": "Asia/Karachi",
        "consent_acknowledged": True,
        **overrides,
    }
    r = client.post("/api/profile", json=body, headers={"X-User-Id": uid})
    assert r.status_code == 200, r.text
    return uid


def h(uid: str) -> dict:
    return {"X-User-Id": uid}
