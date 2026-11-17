"""Recovery recommendations: fixed, transparent rules + cautious use of the student's own ratings.

Activities are optional general-wellbeing suggestions, never presented as treatment.
"""
from collections import Counter

ACTIVITIES = {
    "breathing": "Guided breathing",
    "grounding": "5-4-3-2-1 grounding",
    "journal": "Thought unloading journal",
    "energy": "Mental energy recovery",
    "motivation": "Confidence & motivation reset",
}

BASE_ORDER: dict[str, list[tuple[str, str]]] = {
    "recovery_recommended": [
        ("energy", "Your energy is low, so rest comes before more work."),
        ("breathing", "A slow breathing pause may help you settle."),
        ("journal", "Writing things down can make them feel more manageable."),
    ],
    "overloaded": [
        ("motivation", "Breaking the big task into small steps can make starting easier."),
        ("breathing", "A short pause before you plan."),
        ("grounding", "Bring your attention back to the present moment."),
    ],
    "elevated_stress": [
        ("breathing", "A slow breathing pause may help you settle."),
        ("grounding", "Bring your attention back to the present moment."),
        ("journal", "Separate what you can and can't control."),
    ],
    "low_energy": [
        ("energy", "A short walk, some water or a screen break before studying."),
        ("breathing", "A gentle 2-minute reset."),
        ("motivation", "Pick one small, achievable first step."),
    ],
    "balanced": [
        ("motivation", "Turn your next task into a clear first step."),
        ("energy", "Keep short breaks in your day to stay balanced."),
        ("breathing", "Optional: a short reset between study blocks."),
    ],
}


def recommend(state: str, condition: str, history: list[tuple[str, str | None]]) -> list[dict]:
    """history = (activity, helpful) for this student's completed sessions (most recent first)."""
    order = list(BASE_ORDER[state])
    if condition in ("anxious", "unable_to_concentrate") and state != "balanced":
        if not any(a == "grounding" for a, _ in order):
            order.append(("grounding", "Grounding can help when it's hard to focus."))
        order.sort(key=lambda x: 0 if x[0] == "grounding" else 1)

    helpful = Counter(a for a, h in history if h == "yes")
    recs = []
    for activity, reason in order:
        n = helpful.get(activity, 0)
        note = f"You rated this helpful {n} times before." if n >= 2 else None
        recs.append({"activity": activity, "label": ACTIVITIES[activity], "reason": reason, "personal_note": note})
    # Cautious personalisation (a fixed rule, not machine learning): activities the student
    # rated helpful at least twice move to the top; otherwise the rule order is kept.
    recs.sort(key=lambda r: 0 if r["personal_note"] else 1)
    return recs
