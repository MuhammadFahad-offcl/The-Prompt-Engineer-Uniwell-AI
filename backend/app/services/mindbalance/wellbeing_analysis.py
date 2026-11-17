"""Wellbeing state analysis — transparent rules over SELF-REPORTED values.

This is not a clinical assessment. It never diagnoses and never estimates risk of harm.
States: balanced · elevated_stress · low_energy · overloaded · recovery_recommended.
"""
from dataclasses import dataclass

MOODS = ("very_good", "good", "neutral", "low", "very_low")
MOOD_SCORE = {"very_good": 5, "good": 4, "neutral": 3, "low": 2, "very_low": 1}
CONDITIONS = ("calm", "overwhelmed", "anxious", "mentally_exhausted", "demotivated", "unable_to_concentrate")
PRESSURES = ("low", "moderate", "high", "very_high")
PRESSURE_SCORE = {"low": 1, "moderate": 2, "high": 3, "very_high": 4}

STATE_LABEL = {
    "balanced": "Balanced",
    "elevated_stress": "Elevated stress",
    "low_energy": "Low energy",
    "overloaded": "Overloaded",
    "recovery_recommended": "Recovery recommended",
}

RULES = [
    "Recovery recommended: stress at least 8 with energy at most 3, OR very low mood with energy at most 3, OR 'mentally exhausted' with energy at most 3.",
    "Overloaded: stress at least 7 with high or very high academic pressure.",
    "Elevated stress: stress at least 7, OR you selected 'overwhelmed' or 'anxious'.",
    "Low energy: energy at most 3, OR you selected 'mentally exhausted' or 'demotivated'.",
    "Balanced: none of the above. The first matching rule wins.",
]


@dataclass(frozen=True)
class StateResult:
    state: str
    label: str
    reasons: list[str]


def _nice(value: str) -> str:
    return value.replace("_", " ")


def analyse(*, mood: str, stress: int, energy: int, condition: str, pressure: str) -> StateResult:
    reasons: list[str] = []
    if stress >= 8 and energy <= 3:
        reasons.append(f"You reported high stress ({stress}/10) with low energy ({energy}/10).")
    if MOOD_SCORE[mood] == 1 and energy <= 3:
        reasons.append(f"You reported a very low mood with low energy ({energy}/10).")
    if condition == "mentally_exhausted" and energy <= 3:
        reasons.append("You described feeling mentally exhausted with little energy left.")
    if reasons:
        return StateResult("recovery_recommended", STATE_LABEL["recovery_recommended"], reasons)

    if stress >= 7 and PRESSURE_SCORE[pressure] >= 3:
        return StateResult("overloaded", STATE_LABEL["overloaded"],
                           [f"Stress {stress}/10 together with {_nice(pressure)} academic pressure."])

    if stress >= 7 or condition in ("overwhelmed", "anxious"):
        why = f"Stress {stress}/10." if stress >= 7 else f"You selected '{_nice(condition)}'."
        return StateResult("elevated_stress", STATE_LABEL["elevated_stress"], [why])

    if energy <= 3 or condition in ("mentally_exhausted", "demotivated"):
        why = f"Energy {energy}/10." if energy <= 3 else f"You selected '{_nice(condition)}'."
        return StateResult("low_energy", STATE_LABEL["low_energy"], [why])

    return StateResult("balanced", STATE_LABEL["balanced"],
                       [f"Stress {stress}/10 and energy {energy}/10 are in a manageable range."])
