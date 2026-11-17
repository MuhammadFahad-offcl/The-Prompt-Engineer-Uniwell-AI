"""Safety guardrails: input sanitization, explicit-danger routing and non-clinical output checks.

This is deliberately simple keyword matching. It is NOT a clinical risk assessment and never
produces a score; it only decides whether to pause normal plan generation for a request in
which the student explicitly states immediate danger.
"""
import re
import unicodedata

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩]")
_WS = re.compile(r"\s+")


def sanitize_text(value: str | None, max_len: int) -> str | None:
    """Strip control/bidi characters, collapse whitespace and cap length (untrusted input)."""
    if value is None:
        return None
    value = unicodedata.normalize("NFKC", value)
    value = _CONTROL.sub("", value)
    value = _WS.sub(" ", value).strip()
    return value[:max_len] or None


# Explicit statements of immediate danger to self or others (English + common Roman Urdu).
_DANGER_PATTERNS = [
    r"\bkill (my ?self|me)\b",
    r"\bend (my|it all|my life)\b",
    r"\bsuicid",
    r"\bwant to die\b",
    r"\bdon'?t want to (live|be alive)\b",
    r"\bhurt (my ?self|someone|somebody|others)\b",
    r"\bharm (my ?self|someone|somebody|others)\b",
    r"\bself[- ]?harm",
    r"\bcut(ting)? my ?self\b",
    r"\bkill (him|her|them|someone|somebody)\b",
    r"\bin (immediate )?danger\b",
    r"\bkhudkushi\b",
    r"\bkhud ?kushi\b",
    r"\bmarna chaht[ai]\b",
    r"\bmar jana chaht[ai]\b",
    r"\bjeena nahi chaht[ai]\b",
    r"\bapne aap ko nuqsan\b",
]
_DANGER_RE = re.compile("|".join(_DANGER_PATTERNS), re.IGNORECASE)


def indicates_immediate_danger(text: str | None) -> bool:
    return bool(text and _DANGER_RE.search(text))


def safety_response(language: str) -> dict:
    """Compassionate pause message. No hotline numbers are invented (none verified for this build)."""
    if language == "roman_urdu":
        return {
            "title": "Chaliye plan ko abhi rok dete hain",
            "message": (
                "Aap ne jo likha hai woh sun kar humein aap ki fikar hai. Aap ki hifazat kisi bhi "
                "assignment se zyada ahem hai. UniWell emergency ya crisis support nahi de sakta."
            ),
            "actions": [
                "Abhi kisi bharosemand shakhs — dost, family ya teacher — se rabta karein aur unhein batayein.",
                "Agar aap foran khatre mein hain to local emergency services ko call karein ya qareebi emergency department jayein.",
                "Agar aap ki university mein counselling ya student support hai to unse aaj hi rabta karein.",
            ],
        }
    return {
        "title": "Let’s pause the plan for now",
        "message": (
            "What you wrote matters, and we’re concerned for you. Your safety is more important than "
            "any assignment. UniWell can’t provide emergency or crisis support."
        ),
        "actions": [
            "Reach out right now to someone you trust — a friend, family member or teacher — and tell them how you feel.",
            "If you are in immediate danger, contact local emergency services or go to the nearest emergency department.",
            "If your university has counselling or student support services, contact them today.",
        ],
    }


# The AI must never diagnose or use clinical framing about the student.
_CLINICAL_PATTERNS = [
    r"\bdiagnos",
    r"\bdisorder\b",
    r"\b(you|u) (have|has|are suffering from|suffer from|seem to have|may have|might have)\b[^.]{0,40}\b(depression|anxiety|burnout|adhd|ptsd|insomnia|ocd|bipolar)\b",
    r"\b(clinical(ly)?|major) depress",
    r"\bmental (illness|disorder)\b",
    r"\bprescri(be|ption)\b",
    r"\bmedication\b",
    r"\b(risk|stress|burnout|mental[- ]health) score\b",
    r"\bsymptoms? of\b",
    r"\bskip (sleep|meals?|eating|lunch|dinner|breakfast)\b",
    r"\b(pull an? )?all[- ]nighter\b",
]
_CLINICAL_RE = re.compile("|".join(_CLINICAL_PATTERNS), re.IGNORECASE)


def find_disallowed_claims(texts: list[str]) -> list[str]:
    hits = []
    for t in texts:
        m = _CLINICAL_RE.search(t or "")
        if m:
            hits.append(m.group(0))
    return hits
