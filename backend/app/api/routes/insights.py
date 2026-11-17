"""Weekly insights: descriptive summaries of what the student reported. Never causal, never diagnostic."""
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import ensure_aware_utc, now_utc, today_local
from app.core.security import assert_same_user, caller_id, load_user
from app.db.database import get_db
from app.db.models import CheckIn, Feedback, Plan, Task
from app.services.events_service import track

router = APIRouter(tags=["insights"])

MIN_RECORDS_FOR_STATEMENTS = 3
MIN_FEEDBACK_FOR_AVERAGES = 2
SLEEP_VALUE = {"poor": 1, "okay": 2, "good": 3}


@router.get("/insights/{user_id}")
def get_insights(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    user = load_user(db, user_id)
    today = today_local(user.timezone)
    start = today - timedelta(days=6)

    checkins = {
        c.local_date: c
        for c in db.scalars(
            select(CheckIn).where(CheckIn.user_id == user_id, CheckIn.local_date >= start, CheckIn.local_date <= today)
        ).all()
    }
    days = []
    for i in range(7):
        d = start + timedelta(days=i)
        c = checkins.get(d)
        days.append({
            "local_date": d.isoformat(),
            "weekday": d.strftime("%a"),
            "has_checkin": c is not None,
            "mood": c.mood_score if c else None,
            "sleep_quality": c.sleep_quality if c else None,
            "sleep_value": SLEEP_VALUE[c.sleep_quality] if c else None,
            "workload": c.workload_score if c else None,
            "energy": c.energy_score if c else None,
            "available_minutes": c.available_minutes if c else None,
            "is_synthetic": bool(c and c.is_synthetic),
        })

    tasks = db.scalars(select(Task).where(Task.user_id == user_id)).all()
    now = now_utc()
    week_ago = now - timedelta(days=7)
    task_summary = {
        "pending": sum(1 for t in tasks if t.status != "completed"),
        "completed": sum(1 for t in tasks if t.status == "completed"),
        "overdue": sum(1 for t in tasks if t.status != "completed" and ensure_aware_utc(t.deadline) < now),
        "completed_last_7_days": sum(
            1 for t in tasks if t.status == "completed" and t.completed_at and ensure_aware_utc(t.completed_at) >= week_ago
        ),
    }

    plans = db.scalars(select(Plan).where(Plan.user_id == user_id, Plan.local_date >= start)).all()
    plan_ids = [p.id for p in plans]
    feedback = db.scalars(select(Feedback).where(Feedback.plan_id.in_(plan_ids))).all() if plan_ids else []
    feedback_summary = None
    if len(feedback) >= MIN_FEEDBACK_FOR_AVERAGES:
        feedback_summary = {
            "count": len(feedback),
            "avg_manageable": round(sum(f.manageable_rating for f in feedback) / len(feedback), 1),
            "avg_helpful": round(sum(f.helpfulness_rating for f in feedback) / len(feedback), 1),
        }

    # Descriptive statements only, each with its sample size. No causal or clinical wording.
    recorded = [d for d in days if d["has_checkin"]]
    n = len(recorded)
    statements = []
    if n >= MIN_RECORDS_FOR_STATEMENTS:
        avg_mood = sum(d["mood"] for d in recorded) / n
        statements.append({"text": f"In your last {n} check-ins, you reported an average mood of {avg_mood:.1f} out of 5.", "sample_size": n})
        poor = sum(1 for d in recorded if d["sleep_quality"] == "poor")
        good = sum(1 for d in recorded if d["sleep_quality"] == "good")
        statements.append({
            "text": f"You described your sleep as 'poor' on {poor} and 'good' on {good} of those {n} days.",
            "sample_size": n,
        })
        heavy = sum(1 for d in recorded if d["workload"] >= 4)
        statements.append({"text": f"You rated your academic workload as heavy (4 or 5) on {heavy} of {n} days.", "sample_size": n})
        energies = [d["energy"] for d in recorded if d["energy"] is not None]
        if len(energies) >= MIN_RECORDS_FOR_STATEMENTS:
            statements.append({
                "text": f"Your average reported energy was {sum(energies) / len(energies):.1f} out of 5 ({len(energies)} days with an energy rating).",
                "sample_size": len(energies),
            })
    if feedback_summary:
        statements.append({
            "text": f"Across {feedback_summary['count']} rated plans, you rated manageability {feedback_summary['avg_manageable']} and helpfulness {feedback_summary['avg_helpful']} out of 5 on average.",
            "sample_size": feedback_summary["count"],
        })

    track(db, user_id, "insights_viewed")
    db.commit()
    return {
        "days": days,
        "checkins_7d": n,
        "plans_generated_7d": len(plans),
        "task_summary": task_summary,
        "feedback_summary": feedback_summary,
        "min_records_for_statements": MIN_RECORDS_FOR_STATEMENTS,
        "statements": statements,
        "synthetic_records_present": any(d["is_synthetic"] for d in days) or any(t.is_synthetic for t in tasks),
    }
