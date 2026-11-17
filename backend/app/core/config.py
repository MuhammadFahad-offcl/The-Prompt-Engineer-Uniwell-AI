"""Application settings, read from environment variables / a .env file.

The .env file may live at the repo root or inside backend/. Secrets stay server-side only.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = ""
    groq_api_key: str = ""
    groq_model: str = ""
    ai_timeout_seconds: float = 45.0

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'uniwell.db').as_posix()}"
    frontend_origin: str = "http://localhost:5173"
    app_env: str = "development"

    # Basic abuse protection for the AI endpoint (per anonymous user, per minute)
    plan_rate_limit_per_minute: int = 6
    max_request_bytes: int = 64_000

    @property
    def allowed_origins(self) -> list[str]:
        origins = [o.strip() for o in self.frontend_origin.split(",") if o.strip()]
        # Vite sometimes serves on 127.0.0.1 instead of localhost
        extra = [o.replace("localhost", "127.0.0.1") for o in origins if "localhost" in o]
        return origins + extra

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local", "test"}

    @property
    def resolved_gemini_model(self) -> str:
        return self.gemini_model.strip() or DEFAULT_GEMINI_MODEL

    @property
    def resolved_groq_model(self) -> str:
        return self.groq_model.strip() or DEFAULT_GROQ_MODEL


@lru_cache
def get_settings() -> Settings:
    return Settings()
