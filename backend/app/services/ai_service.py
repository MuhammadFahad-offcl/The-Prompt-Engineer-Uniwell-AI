"""AI provider abstraction (fully implemented at the live-AI milestone)."""
from app.core.config import get_settings


def provider_status() -> dict:
    s = get_settings()
    name = s.ai_provider.lower().strip()
    if name == "groq":
        return {"provider": "groq", "configured": bool(s.groq_api_key), "model": s.resolved_groq_model,
                "missing_env": None if s.groq_api_key else "GROQ_API_KEY"}
    return {"provider": "gemini", "configured": bool(s.gemini_api_key), "model": s.resolved_gemini_model,
            "missing_env": None if s.gemini_api_key else "GEMINI_API_KEY"}
