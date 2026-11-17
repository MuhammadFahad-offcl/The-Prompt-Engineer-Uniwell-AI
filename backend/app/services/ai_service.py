"""Live AI provider abstraction.

`AIProvider.generate(system, messages)` returns the model's raw text (expected to be JSON).
Providers are selected by AI_PROVIDER. Keys stay on the server. There is NO offline/template
fallback: if the provider is missing or fails, callers get an AIError and the UI shows an
honest error state.
"""
import logging
import time
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger("uniwell.ai")


class AIError(Exception):
    """Provider failure mapped to an honest, user-presentable error."""

    def __init__(self, code: str, message: str, status_code: int = 502):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


@dataclass
class Message:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class AIResult:
    text: str
    provider: str
    model: str
    latency_ms: int


class AIProvider(Protocol):
    name: str
    model: str

    def generate(self, system: str, messages: list[Message]) -> AIResult: ...


def _map_http_error(provider: str, resp: httpx.Response) -> AIError:
    status = resp.status_code
    detail = ""
    try:
        body = resp.json()
        detail = (body.get("error") or {}).get("message", "") if isinstance(body, dict) else ""
    except ValueError:
        pass
    # Log status + short provider message only (never the prompt, which holds student data).
    log.warning("%s HTTP %s: %s", provider, status, detail[:200])
    if status == 429:
        return AIError("ai_rate_limited", f"The {provider} API is rate-limiting requests. Please wait a moment and retry.", 429)
    if status in (401, 403):
        return AIError("ai_auth_failed", f"The {provider} API key was rejected. Check the key in your .env file.", 502)
    if status == 404:
        return AIError("ai_model_not_found", f"The configured {provider} model was not found. Check the *_MODEL setting in .env.", 502)
    if status == 400:
        return AIError("ai_bad_request", f"The {provider} API rejected the request: {detail[:160] or 'bad request'}.", 502)
    return AIError("ai_provider_error", f"The {provider} API returned an error (HTTP {status}). Please retry.", 502)


class GeminiProvider:
    name = "gemini"
    BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str, timeout: float):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def generate(self, system: str, messages: list[Message]) -> AIResult:
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
                for m in messages
            ],
            "generationConfig": {
                "temperature": 0.6,
                "responseMimeType": "application/json",
                "maxOutputTokens": 8192,
            },
        }
        start = time.perf_counter()
        try:
            resp = httpx.post(
                f"{self.BASE}/{self.model}:generateContent",
                headers={"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
                json=payload,
                timeout=self.timeout,
            )
        except httpx.TimeoutException as exc:
            raise AIError("ai_timeout", "The AI provider took too long to respond. Please retry.", 504) from exc
        except httpx.HTTPError as exc:
            raise AIError("ai_unreachable", "Could not reach the AI provider. Check your internet connection.", 502) from exc
        if resp.status_code != 200:
            raise _map_http_error("Gemini", resp)
        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            block = (data.get("promptFeedback") or {}).get("blockReason")
            raise AIError("ai_blocked", f"The AI provider returned no plan{f' ({block})' if block else ''}. Please retry.", 502)
        cand = candidates[0]
        parts = (cand.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if not text.strip():
            reason = cand.get("finishReason", "unknown")
            raise AIError("ai_empty", f"The AI provider returned an empty response (finish reason: {reason}).", 502)
        return AIResult(text=text, provider=self.name, model=self.model,
                        latency_ms=int((time.perf_counter() - start) * 1000))


class GroqProvider:
    name = "groq"
    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str, timeout: float):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def generate(self, system: str, messages: list[Message]) -> AIResult:
        payload = {
            "model": self.model,
            "temperature": 0.6,
            "max_tokens": 3000,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}]
            + [{"role": m.role, "content": m.content} for m in messages],
        }
        start = time.perf_counter()
        try:
            resp = httpx.post(
                self.URL,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=self.timeout,
            )
        except httpx.TimeoutException as exc:
            raise AIError("ai_timeout", "The AI provider took too long to respond. Please retry.", 504) from exc
        except httpx.HTTPError as exc:
            raise AIError("ai_unreachable", "Could not reach the AI provider. Check your internet connection.", 502) from exc
        if resp.status_code != 200:
            raise _map_http_error("Groq", resp)
        data = resp.json()
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise AIError("ai_empty", "The AI provider returned an unexpected response shape.", 502) from exc
        if not text.strip():
            raise AIError("ai_empty", "The AI provider returned an empty response.", 502)
        return AIResult(text=text, provider=self.name, model=self.model,
                        latency_ms=int((time.perf_counter() - start) * 1000))


def provider_status() -> dict:
    s = get_settings()
    name = s.ai_provider.lower().strip()
    if name == "groq":
        return {"provider": "groq", "configured": bool(s.groq_api_key), "model": s.resolved_groq_model,
                "missing_env": None if s.groq_api_key else "GROQ_API_KEY"}
    return {"provider": "gemini", "configured": bool(s.gemini_api_key), "model": s.resolved_gemini_model,
            "missing_env": None if s.gemini_api_key else "GEMINI_API_KEY"}


# Tests may replace this hook with a mock provider factory. Production never does.
_provider_override = None


def set_provider_override(factory) -> None:
    global _provider_override
    _provider_override = factory


def get_provider() -> AIProvider:
    if _provider_override is not None:
        return _provider_override()
    s = get_settings()
    status = provider_status()
    if not status["configured"]:
        raise AIError(
            "ai_not_configured",
            f"AI provider not configured. Set {status['missing_env']} in the .env file and restart the backend.",
            503,
        )
    if status["provider"] == "groq":
        return GroqProvider(s.groq_api_key, s.resolved_groq_model, s.ai_timeout_seconds)
    return GeminiProvider(s.gemini_api_key, s.resolved_gemini_model, s.ai_timeout_seconds)
