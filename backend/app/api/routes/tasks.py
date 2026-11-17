from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.clock import as_utc, ensure_aware_utc, now_utc
from app.core.errors import ApiError
from app.core.security import assert_same_user, caller_id, current_user, load_user
from app.db.database import get_db
from app.db.models import PlanItem, Task, User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.events_service import track

router = APIRouter(tags=["tasks"])

MAX_TASKS_PER_USER = 200


def to_out(task: Task) -> TaskOut:
    out = TaskOut.model_validate(task)
    deadline = ensure_aware_utc(task.deadline)
    out.deadline = deadline
    out.is_overdue = task.status != "completed" and deadline < now_utc()
    return out


def _validate_deadline(deadline: datetime, user: User) -> datetime:
    utc = as_utc(deadline, user.timezone)
    now = now_utc()
    if utc < now - timedelta(days=60):
        raise ApiError(422, "invalid_deadline", "Deadline is more than 60 days in the past.")
    if utc > now + timedelta(days=366):
        raise ApiError(422, "invalid_deadline", "Deadline must be within the next year.")
    return utc.replace(tzinfo=None)  # stored as naive UTC


def get_owned_task(db: Session, task_id: str, user_id: str) -> Task:
    task = db.get(Task, task_id)
    # Same 404 for "missing" and "someone else's" so IDs can't be probed.
    if task is None or task.user_id != user_id:
        raise ApiError(404, "task_not_found", "Task not found.")
    return task


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    count = db.query(Task).filter(Task.user_id == user.id).count()
    if count >= MAX_TASKS_PER_USER:
        raise ApiError(422, "too_many_tasks", f"You can keep up to {MAX_TASKS_PER_USER} tasks.")
    data = body.model_dump()
    data["deadline"] = _validate_deadline(body.deadline, user)
    task = Task(user_id=user.id, **data)
    if task.status == "completed":
        task.completed_at = now_utc()
    db.add(task)
    track(db, user.id, "task_created")
    db.commit()
    db.refresh(task)
    return to_out(task)


@router.get("/tasks/{user_id}", response_model=list[TaskOut])
def list_tasks(user_id: str, caller: str = Depends(caller_id), db: Session = Depends(get_db)):
    assert_same_user(user_id, caller)
    load_user(db, user_id)
    rows = db.scalars(select(Task).where(Task.user_id == user_id).order_by(Task.deadline, Task.created_at)).all()
    return [to_out(t) for t in rows]


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str, body: TaskUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    task = get_owned_task(db, task_id, user.id)
    changes = body.model_dump(exclude_unset=True)
    if "title" in changes and changes["title"] is None:
        raise ApiError(422, "validation_error", "title: cannot be empty")
    for key in ("task_type", "estimated_minutes", "priority", "status", "deadline"):
        if key in changes and changes[key] is None:
            changes.pop(key)
    if "deadline" in changes:
        changes["deadline"] = _validate_deadline(changes["deadline"], user)
    if "status" in changes and changes["status"] != task.status:
        task.completed_at = now_utc() if changes["status"] == "completed" else None
    for key, value in changes.items():
        setattr(task, key, value)
    task.updated_at = now_utc()
    db.commit()
    db.refresh(task)
    return to_out(task)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = get_owned_task(db, task_id, user.id)
    # Historical plan items keep their title snapshot; only the link is cleared.
    db.execute(
        update(PlanItem)
        .where(PlanItem.task_id == task.id)
        .values(task_id=None)
        .execution_options(synchronize_session=False)
    )
    db.delete(task)
    db.commit()
    return {"deleted": True}
