"""MindBalance Engine API. Every route is scoped to the caller's anonymous ID (X-User-Id).

Private text (check-in notes, journal entries) is encrypted at rest, returned only to its
owner and never sent to an AI provider. All analysis here is deterministic (no LLM).
"""
import json
from datetime import timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.clock import now_utc, today_local
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, current_user, load_user
from app.db.database import get_db
from app.db.models import JournalEntry, PlanAdjustment, RecoverySession, Task, User, WellbeingCheckIn
from app.schemas.common import UtcDatetime
from app.services.events_service import track
from app.services.mindbalance import academic_adaptation, insights_service, recovery_service, wellbeing_analysis
from app.services.mindbalance.journal_crypto import decrypt, encrypt
from app.services.safety_service import indicates_immediate_danger, safety_response, sanitize_text

router = APIRouter(prefix="/mindbalance", tags=["mindbalance"])

Mood = Literal["very_good", "good", "neutral", "low", "very_low"]
Condition = Literal["calm", "overwhelmed", "anxious", "mentally_exhausted", "demotivated", "unable_to_concentrate"]
Pressure = Literal["low", "moderate", "high", "very_high"]
Activity = Literal["breathing", "grounding", "journal", "energy", "motivation"]

SUPPORT_FILE = Path(__file__).resolve().parents[2] / "data" / "support_contacts.json"


def verified_support_contacts() -> list[dict]:
    """Only contacts with a recorded official verification source are shown. Empty by default."""
    try:
        rows = json.loads(SUPPORT_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [r for r in rows if r.get("verified_source") and r.get("verified_on")]


def safety_payload(language: str) -> dict:
    return {**safety_response(language), "contacts": verified_support_contacts(),
            "not_emergency_service": "UniWell is not an emergency service and cannot respond to emergencies."}


# ------------------------------------------------------------------------- schemas
class WellbeingCheckInIn(BaseModel):
    mood: Mood
    stress: int = Field(ge=1, le=10)
    energy: int = Field(ge=1, le=10)
    mental_condition: Condition
    academic_pressure: Pressure
    note: str | None = Field(default=None, max_length=2000)
    kind: Literal["daily", "post_activity"] = "daily"


class WellbeingCheckInOut(BaseModel):
    id: str
    local_date: str
    mood: str
    stress: int
    energy: int
    mental_condition: str
    academic_pressure: str
    note: str | None
    state: str
    state_label: str
    state_reasons: list[str]
    kind: str
    is_synthetic: bool
    created_at: UtcDatetime


def checkin_out(c: WellbeingCheckIn) -> WellbeingCheckInOut:
    return WellbeingCheckInOut(
        id=c.id, local_date=c.local_date.isoformat(), mood=c.mood, stress=c.stress, energy=c.energy,
        mental_condition=c.mental_condition, academic_pressure=c.academic_pressure,
        note=decrypt(c.note_encrypted), state=c.state, state_label=wellbeing_analysis.STATE_LABEL[c.state],
        state_reasons=c.state_reasons or [], kind=c.kind, is_synthetic=c.is_synthetic, created_at=c.created_at)


class SessionStart(BaseModel):
    activity: Activity
    variant: str | None = Field(default=None, max_length=40)
    checkin_id: str | None = None
    pre_stress: int | None = Field(default=None, ge=1, le=10)
    pre_energy: int | None = Field(default=None, ge=1, le=10)


class SessionFinish(BaseModel):
    status: Literal["completed", "skipped"] = "completed"
    post_stress: int | None = Field(default=None, ge=1, le=10)
    post_energy: int | None = Field(default=None, ge=1, le=10)
    helpful: Literal["yes", "somewhat", "no"] | None = None
    steps_completed: int | None = Field(default=None, ge=0, le=20)


def session_out(s: RecoverySession) -> dict:
    return {"id": s.id, "activity": s.activity, "variant": s.variant, "status": s.status,
            "pre_stress": s.pre_stress, "pre_energy": s.pre_energy, "post_stress": s.post_stress,
            "post_energy": s.post_energy, "helpful": s.helpful, "steps_completed": s.steps_completed,
            "created_at": s.created_at.isoformat() + "Z",
            "completed_at": s.completed_at.isoformat() + "Z" if s.completed_at else None}


class JournalIn(BaseModel):
    bothering: str = Field(min_length=1, max_length=2000)
    in_control: str | None = Field(default=None, max_length=2000)
    outside_control: str | None = Field(default=None, max_length=2000)
    small_action: str | None = Field(default=None, max_length=500)
    session_id: str | None = None


def journal_out(j: JournalEntry) -> dict:
    return {"id": j.id, "bothering": decrypt(j.bothering_enc), "in_control": decrypt(j.in_control_enc),
            "outside_control": decrypt(j.outside_control_enc), "small_action": decrypt(j.small_action_enc),
            "created_at": j.created_at.isoformat() + "Z"}


class DecideIn(BaseModel):
    accepted_change_ids: list[str] = Field(default_factory=list, max_length=20)


def adjustment_out(a: PlanAdjustment | None) -> dict | None:
    if a is None:
        return None
    return {"id": a.id, "local_date": a.local_date.isoformat(), "status": a.status, "pressure_level": a.pressure_level,
            "summary": a.summary, "changes": a.changes, "created_at": a.created_at.isoformat() + "Z"}


# ------------------------------------------------------------------------- helpers
def _clean(text: str | None, n: int) -> str | None:
    return sanitize_text(text, n)


def _history(db: Session, user_id: str) -> list[tuple[str, str | None]]:
    rows = db.scalars(select(RecoverySession).where(RecoverySession.user_id == user_id,
                                                    RecoverySession.status == "completed")
                      .order_by(RecoverySession.created_at.desc()).limit(50)).all()
    return [(r.activity, r.helpful) for r in rows]


def latest_daily_checkin(db: Session, user: User) -> WellbeingCheckIn | None:
    return db.scalar(select(WellbeingCheckIn).where(WellbeingCheckIn.user_id == user.id,
                                                    WellbeingCheckIn.local_date == today_local(user.timezone),
                                                    WellbeingCheckIn.kind == "daily")
                     .order_by(WellbeingCheckIn.created_at.desc()).limit(1))


def todays_adjustment(db: Session, user: User, status: str | None = None) -> PlanAdjustment | None:
    q = select(PlanAdjustment).where(PlanAdjustment.user_id == user.id,
                                     PlanAdjustment.local_date == today_local(user.timezone))
    if status:
        q = q.where(PlanAdjustment.status == status)
    return db.scalar(q.order_by(PlanAdjustment.created_at.desc()).limit(1))


# --------------------------------------------------------------------------- routes
@router.get("/{user_id}/summary")
def summary(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    latest = latest_daily_checkin(db, user)
    recs = recovery_service.recommend(latest.state, latest.mental_condition, _history(db, user.id)) if latest else []
    return {"latest_checkin": checkin_out(latest) if latest else None, "recommendations": recs,
            "rules": wellbeing_analysis.RULES, "adjustment": adjustment_out(todays_adjustment(db, user)),
            "support_contacts": verified_support_contacts()}


@router.post("/checkins")
def create_checkin(body: WellbeingCheckInIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    note = _clean(body.note, 2000)
    result = wellbeing_analysis.analyse(mood=body.mood, stress=body.stress, energy=body.energy,
                                        condition=body.mental_condition, pressure=body.academic_pressure)
    c = WellbeingCheckIn(user_id=user.id, local_date=today_local(user.timezone), mood=body.mood, stress=body.stress,
                         energy=body.energy, mental_condition=body.mental_condition,
                         academic_pressure=body.academic_pressure, note_encrypted=encrypt(note),
                         state=result.state, state_reasons=result.reasons, kind=body.kind)
    db.add(c)
    track(db, user.id, "checkin_saved")
    if indicates_immediate_danger(note):
        # Safety first: no routine productivity recommendations for this request.
        track(db, user.id, "safety_message_shown")
        db.commit()
        db.refresh(c)
        return {"checkin": checkin_out(c), "recommendations": [], "safety": safety_payload(user.language)}
    db.commit()
    db.refresh(c)
    recs = recovery_service.recommend(result.state, body.mental_condition, _history(db, user.id))
    return {"checkin": checkin_out(c), "recommendations": recs, "safety": None}


@router.get("/checkins/{user_id}")
def list_checkins(user_id: str, days: int = Query(default=30, ge=1, le=120),
                  caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    since = today_local(user.timezone) - timedelta(days=days - 1)
    rows = db.scalars(select(WellbeingCheckIn).where(WellbeingCheckIn.user_id == user_id,
                                                     WellbeingCheckIn.local_date >= since)
                      .order_by(WellbeingCheckIn.created_at.desc())).all()
    return [checkin_out(r) for r in rows]


@router.post("/sessions")
def start_session(body: SessionStart, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.checkin_id:
        c = db.get(WellbeingCheckIn, body.checkin_id)
        if c is None or c.user_id != user.id:
            raise ApiError(404, "checkin_not_found", "Check-in not found.")
    s = RecoverySession(user_id=user.id, activity=body.activity, variant=_clean(body.variant, 40),
                        checkin_id=body.checkin_id, pre_stress=body.pre_stress, pre_energy=body.pre_energy)
    db.add(s)
    db.commit()
    db.refresh(s)
    return session_out(s)


@router.post("/sessions/{session_id}/finish")
def finish_session(session_id: str, body: SessionFinish, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(RecoverySession, session_id)
    if s is None or s.user_id != user.id:
        raise ApiError(404, "session_not_found", "Recovery session not found.")
    if s.status != "started":
        raise ApiError(409, "session_finished", "This activity was already finished.")
    s.status = body.status
    s.post_stress, s.post_energy = body.post_stress, body.post_energy
    s.helpful, s.steps_completed = body.helpful, body.steps_completed
    s.completed_at = now_utc()
    db.commit()
    db.refresh(s)
    return session_out(s)


@router.get("/sessions/{user_id}")
def list_sessions(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    load_user(db, user_id)
    rows = db.scalars(select(RecoverySession).where(RecoverySession.user_id == user_id)
                      .order_by(RecoverySession.created_at.desc()).limit(50)).all()
    return [session_out(r) for r in rows]


@router.post("/journal")
def create_journal(body: JournalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fields = {k: _clean(getattr(body, k), 2000) for k in ("bothering", "in_control", "outside_control", "small_action")}
    if not fields["bothering"]:
        raise ApiError(422, "validation_error", "bothering: please write at least a few words")
    if body.session_id:
        s = db.get(RecoverySession, body.session_id)
        if s is None or s.user_id != user.id:
            raise ApiError(404, "session_not_found", "Recovery session not found.")
    j = JournalEntry(user_id=user.id, session_id=body.session_id, bothering_enc=encrypt(fields["bothering"]),
                     in_control_enc=encrypt(fields["in_control"]), outside_control_enc=encrypt(fields["outside_control"]),
                     small_action_enc=encrypt(fields["small_action"]))
    db.add(j)
    db.commit()
    db.refresh(j)
    danger = any(indicates_immediate_danger(v) for v in fields.values())
    if danger:
        track(db, user.id, "safety_message_shown")
        db.commit()
    return {"entry": journal_out(j), "safety": safety_payload(user.language) if danger else None}


@router.get("/journal/{user_id}")
def list_journal(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    load_user(db, user_id)
    rows = db.scalars(select(JournalEntry).where(JournalEntry.user_id == user_id)
                      .order_by(JournalEntry.created_at.desc()).limit(100)).all()
    return [journal_out(r) for r in rows]


@router.delete("/journal/{entry_id}")
def delete_journal(entry_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    j = db.get(JournalEntry, entry_id)
    if j is None or j.user_id != user.id:
        raise ApiError(404, "journal_not_found", "Journal entry not found.")
    db.delete(j)
    db.commit()
    return {"deleted": True}


@router.get("/insights/{user_id}")
def insights(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    checkins = db.scalars(select(WellbeingCheckIn).where(WellbeingCheckIn.user_id == user_id)).all()
    sessions = db.scalars(select(RecoverySession).where(RecoverySession.user_id == user_id)).all()
    tasks = db.scalars(select(Task).where(Task.user_id == user_id)).all()
    return insights_service.build_insights(today=today_local(user.timezone), tz=user.timezone,
                                           checkins=list(checkins), sessions=list(sessions), tasks=list(tasks))


MICRO_STEPS = {
    "assignment": ["Open the brief and list exactly what is required (10 min)", "Write headings for each section (10 min)",
                   "Draft the easiest section first (20 min)", "Note one question to ask or look up (5 min)"],
    "quiz": ["List the topics the quiz covers (5 min)", "Re-read notes for the first topic (15 min)",
             "Try 3 practice questions (15 min)", "Mark topics you feel unsure about (5 min)"],
    "exam": ["Make a one-page list of exam topics (10 min)", "Pick the topic you feel least sure about (5 min)",
             "Review it with past questions (20 min)", "Write a 5-line summary from memory (10 min)"],
    "project": ["Write the next deliverable in one sentence (5 min)", "Break it into 3 parts (10 min)",
                "Do the smallest part (20 min)", "Message your team or note blockers (5 min)"],
    "reading": ["Skim headings and summary (5 min)", "Read the first section only (15 min)",
                "Write 3 key points (10 min)"],
    "other": ["Write what 'done' looks like (5 min)", "Do the first 10 minutes only (10 min)",
              "Decide the next small step (5 min)"],
}


@router.get("/micro-steps/{task_id}")
def micro_steps(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if t is None or t.user_id != user.id:
        raise ApiError(404, "task_not_found", "Task not found.")
    return {"task_id": t.id, "title": t.title, "steps": MICRO_STEPS.get(t.task_type, MICRO_STEPS["other"])}


@router.post("/adjustments/propose")
def propose_adjustment(user: User = Depends(current_user), db: Session = Depends(get_db)):
    checkin = latest_daily_checkin(db, user)
    if checkin is None:
        raise ApiError(409, "wellbeing_checkin_required", "Complete today's MindBalance check-in first.")
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id)).all())
    proposal = academic_adaptation.propose(checkin=checkin, tasks=tasks, now_utc=now_utc(), tz=user.timezone)
    if not proposal["changes"]:
        return {"adjustment": None, "summary": proposal["summary"], "pressure_level": proposal["pressure_level"]}
    # A newer proposal replaces any undecided one for today.
    db.execute(update(PlanAdjustment).where(PlanAdjustment.user_id == user.id, PlanAdjustment.status == "pending")
               .values(status="dismissed").execution_options(synchronize_session=False))
    adj = PlanAdjustment(user_id=user.id, checkin_id=checkin.id, local_date=today_local(user.timezone),
                         pressure_level=proposal["pressure_level"], summary=proposal["summary"], changes=proposal["changes"])
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return {"adjustment": adjustment_out(adj), "summary": proposal["summary"], "pressure_level": proposal["pressure_level"]}


@router.post("/adjustments/{adjustment_id}/decide")
def decide_adjustment(adjustment_id: str, body: DecideIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    adj = db.get(PlanAdjustment, adjustment_id)
    if adj is None or adj.user_id != user.id:
        raise ApiError(404, "adjustment_not_found", "Adjustment not found.")
    if adj.status != "pending":
        raise ApiError(409, "adjustment_decided", "These changes were already decided.")
    accepted = set(body.accepted_change_ids)
    known = {c["id"] for c in adj.changes}
    if not accepted <= known:
        raise ApiError(422, "validation_error", "Unknown change id.")

    applied: list[str] = []
    new_changes = []
    for ch in adj.changes:
        ch = {**ch, "accepted": ch["id"] in accepted}
        if ch["accepted"] and ch["type"] == "split_task":
            task = db.get(Task, ch["task_id"])
            if task is None or task.user_id != user.id or task.status == "completed":
                ch["accepted"] = False
                ch["detail"] += " (Skipped: the task changed or was completed.)"
            else:
                parts = ch["data"]["parts"]
                original = task.title
                n = len(parts)
                task.title = f"{original} — step 1/{n}"[:120]
                task.estimated_minutes = parts[0]
                for i, minutes in enumerate(parts[1:], start=2):
                    db.add(Task(user_id=user.id, title=f"{original} — step {i}/{n}"[:120], subject=task.subject,
                                task_type=task.task_type, deadline=task.deadline, estimated_minutes=minutes,
                                priority=task.priority, status="pending", is_synthetic=task.is_synthetic))
                applied.append(f"Split “{original}” into {n} steps.")
        new_changes.append(ch)
    adj.changes = new_changes
    adj.status = "applied" if accepted else "dismissed"
    adj.decided_at = now_utc()
    db.commit()
    db.refresh(adj)
    return {"adjustment": adjustment_out(adj), "applied": applied}
