"""Encryption at rest for private wellbeing text (journal entries, optional check-in notes).

Fernet (AES-128-CBC + HMAC-SHA256). Key from MINDBALANCE_KEY, else a locally generated key
file (backend/.journal.key, git-ignored). Text is decrypted only for its owner's requests and
is never sent to an AI provider.
"""
import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import BACKEND_DIR, get_settings

KEY_FILE = BACKEND_DIR / ".journal.key"


@lru_cache
def _fernet() -> Fernet:
    key = (get_settings().mindbalance_key or "").strip()
    if not key:
        if KEY_FILE.exists():
            key = KEY_FILE.read_text().strip()
        else:
            key = Fernet.generate_key().decode()
            KEY_FILE.write_text(key)
            try:
                os.chmod(KEY_FILE, 0o600)
            except OSError:
                pass
    return Fernet(key.encode())


def encrypt(text: str | None) -> str | None:
    if not text:
        return None
    return _fernet().encrypt(text.encode("utf-8")).decode("ascii")


def decrypt(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return None  # key rotated or lost: fail closed, never show garbage


def reset_cache() -> None:
    _fernet.cache_clear()
