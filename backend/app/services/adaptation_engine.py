"""Deterministic personalization: plan constraints + feedback-driven adaptation rules.

No ML model is trained. Rules are transparent, unit-tested and every change is written to
`adaptation_events` with a human-readable reason that the next plan shows to the student.
"""
from dataclasses import dataclass, field, replace

SESSION_FLOOR = 15
BUFFER_CAP = 20
LOW_ENERGY_SESSION_CAP = 25


# ---------------------------------------------------------------------------------------
# Plan constraints (used before every AI generation)
# ---------------------------------------------------------------------------------------
@dataclass
class Constraints:
    available_minutes: int
    buffer_minutes: int
    budget_minutes: int
    session_minutes: int
    max_study_tasks: int
    keep_breaks: bool
    low_energy_mode: bool
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "available_minutes": self.available_minutes,
            "buffer_minutes": self.buffer_minutes,
            "budget_minutes": self.budget_minutes,
            "session_minutes": self.session_minutes,
            "max_study_tasks": self.max_study_tasks,
            "keep_breaks": self.keep_breaks,
            "low_energy_mode": self.low_energy_mode,
            "notes": list(self.notes),
        }


def compute_constraints(
    *,
    available_minutes: int,
    energy_score: int | None,
    effective_session_minutes: int,
    adapted_session_minutes: int | None,
    max_tasks_override: int | None,
    buffer_minutes: int,
    keep_breaks: bool,
) -> Constraints:
    notes: list[str] = []

    # A small free buffer so the plan never fills every minute (bounded to 25% of the time).
    buffer = min(buffer_minutes, available_minutes // 4) if available_minutes >= 30 else 0
    budget = available_minutes - buffer

    session = effective_session_minutes
    if adapted_session_minutes is not None:
        notes.append(f"Study blocks are set to {adapted_session_minutes} min based on your earlier feedback.")
    low_energy = energy_score is not None and energy_score <= 2
    if low_energy and session > LOW_ENERGY_SESSION_CAP:
        session = LOW_ENERGY_SESSION_CAP
        notes.append(f"You reported low energy, so study blocks are capped at {LOW_ENERGY_SESSION_CAP} min.")
    session = max(min(session, budget), min(10, budget))

    max_tasks = 1 if budget <= 45 else 2 if budget <= 100 else 3
    if low_energy and max_tasks > 1:
        max_tasks -= 1
        notes.append("Low energy today, so the plan focuses on fewer tasks.")
    if max_tasks_override is not None and max_tasks_override < max_tasks:
        max_tasks = max_tasks_override
        notes.append(f"Your earlier feedback asked for fewer tasks, so this plan covers at most {max_tasks}.")
    if buffer:
        notes.append(f"{buffer} min of your time is kept free as a buffer.")

    return Constraints(
        available_minutes=available_minutes,
        buffer_minutes=buffer,
        budget_minutes=budget,
        session_minutes=session,
        max_study_tasks=max_tasks,
        keep_breaks=keep_breaks,
        low_energy_mode=low_energy,
        notes=notes,
    )


# ---------------------------------------------------------------------------------------
# Feedback → adaptation rules
# ---------------------------------------------------------------------------------------
@dataclass(frozen=True)
class AdaptState:
    preferred_session_minutes: int
    adapted_session_minutes: int | None
    max_tasks_override: int | None
    buffer_minutes: int
    keep_breaks: bool
    noncompletion_streak: int

    @property
    def effective_session(self) -> int:
        return self.adapted_session_minutes or self.preferred_session_minutes


@dataclass(frozen=True)
class FeedbackSignal:
    completion_status: str  # yes | partially | no
    manageable: int
    helpful: int
    reason_code: str | None
    breaks_helpful: bool | None
    items_completed: int
    items_total: int
    plan_session_minutes: int | None  # longest study block actually used in the rated plan
    plan_study_tasks: int  # distinct tasks in the rated plan


@dataclass(frozen=True)
class Change:
    rule: str
    previous: str | None
    new: str | None
    reason: str


@dataclass(frozen=True)
class AdaptationOutcome:
    state: AdaptState
    changes: list[Change]
    ask_availability: bool


def apply_feedback_rules(state: AdaptState, fb: FeedbackSignal) -> AdaptationOutcome:
    changes: list[Change] = []
    new = state
    hard = fb.manageable <= 2

    # R1 — shorter sessions when the plan felt unmanageable or sessions were too long.
    if hard or fb.reason_code == "sessions_too_long":
        used = min(state.effective_session, fb.plan_session_minutes or state.effective_session)
        step = 10 if used >= 35 else 5
        target = max(SESSION_FLOOR, used - step)
        why = "sessions felt too long" if fb.reason_code == "sessions_too_long" else "the plan felt hard to manage"
        if target < used:
            new = replace(new, adapted_session_minutes=target)
            changes.append(Change("shorten_sessions", str(used), str(target),
                                  f"Your last feedback said {why}, so your next plan uses {target}-minute study blocks (was {used})."))
        else:
            changes.append(Change("session_at_minimum", str(used), str(used),
                                  f"Your last feedback said {why}. Study blocks are already at the {SESSION_FLOOR}-minute minimum, so they stay short."))

    # R2 — fewer tasks and more buffer when there was too much in the plan.
    if hard or fb.reason_code == "too_many_tasks":
        current = state.max_tasks_override or max(fb.plan_study_tasks, 1)
        target = max(1, min(current, max(fb.plan_study_tasks, 1)) - 1) if fb.plan_study_tasks > 1 else 1
        if target < current or state.max_tasks_override is None:
            new = replace(new, max_tasks_override=target)
            changes.append(Change("reduce_task_count", str(current), str(target),
                                  f"The last plan had too much in it, so your next plan focuses on at most {target} task{'s' if target > 1 else ''}."))
        buf = min(BUFFER_CAP, new.buffer_minutes + 5)
        if buf > new.buffer_minutes:
            changes.append(Change("increase_buffer", str(new.buffer_minutes), str(buf),
                                  f"We'll keep {buf} minutes free as buffer time."))
            new = replace(new, buffer_minutes=buf)

    # R3 — not enough time: plan only what fits, don't roll everything into tomorrow.
    if fb.reason_code == "not_enough_time":
        buf = min(BUFFER_CAP, new.buffer_minutes + 5)
        changes.append(Change("respect_actual_time", str(new.buffer_minutes), str(buf),
                              "You said there wasn't enough time. The next plan uses only the time you report and keeps extra buffer, instead of piling missed work onto tomorrow."))
        new = replace(new, buffer_minutes=buf)

    # R3b — unexpected events are not penalised.
    if fb.reason_code == "unexpected_event":
        changes.append(Change("no_penalty_unexpected_event", None, None,
                              "Something unexpected came up — that happens. Your plan settings stay the same."))

    # R4 — breaks.
    if fb.breaks_helpful is True:
        new = replace(new, keep_breaks=True)
        changes.append(Change("preserve_breaks", str(state.keep_breaks).lower(), "true",
                              "You found the breaks helpful, so future plans keep breaks between study blocks."))
    elif fb.breaks_helpful is False and state.keep_breaks:
        new = replace(new, keep_breaks=False)
        changes.append(Change("breaks_optional", "true", "false",
                              "You said breaks weren't helpful, so short plans may skip optional breaks (longer plans still include one)."))

    # R5 — success: keep what works, never auto-increase workload.
    all_done = fb.items_total > 0 and fb.items_completed >= fb.items_total
    if fb.manageable >= 4 and (fb.completion_status == "yes" or all_done) and not hard:
        changes.append(Change("preserve_success", str(state.effective_session), str(new.effective_session),
                              f"This plan worked for you, so we're keeping {new.effective_session}-minute study blocks and won't add extra work automatically."))

    # R6 — repeated non-completion: ask about availability; never infer laziness or a condition.
    streak = state.noncompletion_streak + 1 if fb.completion_status == "no" else 0
    new = replace(new, noncompletion_streak=streak)
    ask = streak >= 2
    if ask:
        changes.append(Change("check_availability", None, None,
                              "A couple of plans in a row didn't fit your day. That's useful information, not a failure — has your available time changed? Updating it in your check-in helps the next plan fit."))

    return AdaptationOutcome(state=new, changes=changes, ask_availability=ask)
