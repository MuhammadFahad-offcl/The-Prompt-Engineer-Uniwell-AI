"""Hackathon-grade ownership guard.

The browser holds a random anonymous ID and sends it as `X-User-Id`. Every route checks that
the record it touches belongs to that ID, so guessing another record's ID gets a 404/403.
This is NOT authentication; production needs real auth (documented in README).
"""
import re

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.database import get_db
from app.db.models import User

USER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def validate_user_id(user_id: str) -> str:
    if not USER_ID_RE.match(user_id or ""):
        raise ApiError(400, "invalid_user_id", "The anonymous user ID is missing or malformed.")
    return user_id


def caller_id(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> str:
    if not x_user_id:
        raise ApiError(401, "missing_user_id", "Missing X-User-Id header (your anonymous app ID).")
    return validate_user_id(x_user_id)


def assert_same_user(path_user_id: str, caller: str) -> None:
    if path_user_id != caller:
        raise ApiError(403, "forbidden", "You can only access your own UniWell data.")


def load_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(404, "profile_not_found", "No profile found. Please complete onboarding first.")
    return user


def current_user(caller: str = Depends(caller_id), db: Session = Depends(get_db)) -> User:
    return load_user(db, caller)
