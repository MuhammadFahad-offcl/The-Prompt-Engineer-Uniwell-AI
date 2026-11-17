from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import now_utc
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, current_user, load_user
from app.db.database import get_db
from app.db.models import AdaptationEvent, Feedback, Plan, PlanItem, User
from app.schemas.plan import (
    AdaptationEventOut,
    FeedbackOut,
    GenerateRequest,
    PlanDetailOut,
    PlanItemOut,
    PlanItemUpdate,
    PlanSummaryOut,
)
from app.services.ai_service import AIError
from app.services.events_service import track
from app.services.plan_service import generate_plan

router = APIRouter(tags=["plans"])


def plan_detail(db: Session, plan: Plan) -> PlanDetailOut:
    fb = db.scalar(select(Feedback).where(Feedback.plan_id == plan.id))
    return PlanDetailOut(
        id=plan.id,
        local_date=plan.local_date,
        language=plan.language,
        provider=plan.provider,
        model=plan.model,
        status=plan.status,
        is_synthetic=plan.is_synthetic,
        created_at=plan.created_at,
        plan=plan.plan_json,
        items=[PlanItemOut.model_validate(i) for i in plan.items],
        feedback=FeedbackOut.model_validate(fb) if fb else None,
    )


def get_owned_plan(db: Session, plan_id: str, user_id: str) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None or plan.user_id != user_id:
        raise ApiError(404, "plan_not_found", "Plan not found.")
    return plan


@router.post("/plans/generate")
def generate(body: GenerateRequest, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(body.user_id, caller)
    user = load_user(db, body.user_id)
    try:
        result = generate_plan(db, user, body.note)
    except AIError as err:
        # Honest failure: no template or cached plan is ever substituted.
        raise ApiError(err.status_code, err.code, err.message) from err
    if result.kind == "safety":
        return {"kind": "safety", "safety": result.safety}
    return {"kind": "plan", "plan": plan_detail(db, result.plan)}


@router.get("/plans/{user_id}")
def list_plans(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    load_user(db, user_id)
    plans = db.scalars(
        select(Plan).where(Plan.user_id == user_id).order_by(Plan.created_at.desc()).limit(50)
    ).all()
    fb_by_plan = {
        f.plan_id: f
        for f in db.scalars(select(Feedback).where(Feedback.plan_id.in_([p.id for p in plans]))).all()
    } if plans else {}
    summaries = [
        PlanSummaryOut(
            id=p.id,
            local_date=p.local_date,
            title=(p.plan_json or {}).get("title", "Plan"),
            provider=p.provider,
            model=p.model,
            status=p.status,
            is_synthetic=p.is_synthetic,
            created_at=p.created_at,
            total_planned_minutes=(p.plan_json or {}).get("total_planned_minutes", 0),
            items_total=len(p.items),
            items_completed=sum(1 for i in p.items if i.completed),
            feedback=FeedbackOut.model_validate(fb_by_plan[p.id]) if p.id in fb_by_plan else None,
        )
        for p in plans
    ]
    events = db.scalars(
        select(AdaptationEvent)
        .where(AdaptationEvent.user_id == user_id)
        .order_by(AdaptationEvent.created_at.desc())
        .limit(30)
    ).all()
    return {"items": summaries, "adaptation_events": [AdaptationEventOut.model_validate(e) for e in events]}


@router.get("/plans/detail/{plan_id}", response_model=PlanDetailOut)
def get_plan(plan_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return plan_detail(db, get_owned_plan(db, plan_id, user.id))


@router.patch("/plan-items/{item_id}", response_model=PlanItemOut)
def update_item(item_id: str, body: PlanItemUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = db.get(PlanItem, item_id)
    if item is None or item.plan.user_id != user.id:
        raise ApiError(404, "item_not_found", "Plan item not found.")
    if item.completed != body.completed:
        item.completed = body.completed
        item.completed_at = now_utc() if body.completed else None
        if body.completed:
            track(db, user.id, "plan_item_completed", item_type=item.item_type)
    db.commit()
    db.refresh(item)
    return item
