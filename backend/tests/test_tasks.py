from app.db.models import Plan, PlanItem
from tests.conftest import h, make_profile

TASK = {
    "title": "DBMS assignment",
    "subject": "Databases",
    "task_type": "assignment",
    "deadline": "2026-11-17T18:00:00Z",
    "estimated_minutes": 90,
    "priority": "high",
}


def test_task_crud_roundtrip(client):
    uid = make_profile(client)
    r = client.post("/api/tasks", json=TASK, headers=h(uid))
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["status"] == "pending" and task["deadline"].endswith("Z")

    r = client.patch(f"/api/tasks/{task['id']}", json={"estimated_minutes": 60, "priority": "low"}, headers=h(uid))
    assert r.status_code == 200
    assert r.json()["estimated_minutes"] == 60
    assert r.json()["priority"] == "low"  # student's own priority is kept as given

    r = client.patch(f"/api/tasks/{task['id']}", json={"status": "completed"}, headers=h(uid))
    assert r.json()["status"] == "completed" and r.json()["completed_at"]

    listed = client.get(f"/api/tasks/{uid}", headers=h(uid)).json()
    assert [t["id"] for t in listed] == [task["id"]]

    assert client.delete(f"/api/tasks/{task['id']}", headers=h(uid)).json() == {"deleted": True}
    assert client.get(f"/api/tasks/{uid}", headers=h(uid)).json() == []


def test_task_validation(client):
    uid = make_profile(client)
    for bad in (
        {**TASK, "title": "   "},
        {**TASK, "estimated_minutes": 0},
        {**TASK, "estimated_minutes": 721},
        {**TASK, "task_type": "party"},
        {**TASK, "priority": "urgent"},
        {**TASK, "deadline": "not-a-date"},
    ):
        r = client.post("/api/tasks", json=bad, headers=h(uid))
        assert r.status_code == 422, bad
    r = client.post("/api/tasks", json={**TASK, "deadline": "2030-01-01T00:00:00Z"}, headers=h(uid))
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_deadline"


def test_task_title_is_sanitized(client):
    uid = make_profile(client)
    r = client.post("/api/tasks", json={**TASK, "title": "  Essay‮\x07   draft\n\n  "}, headers=h(uid))
    assert r.json()["title"] == "Essay draft"


def test_overdue_flag(client):
    uid = make_profile(client)
    r = client.post("/api/tasks", json={**TASK, "deadline": "2026-11-16T10:00:00Z"}, headers=h(uid))
    assert r.json()["is_overdue"] is True


def test_naive_deadline_is_read_in_user_timezone(client):
    uid = make_profile(client)  # Asia/Karachi, UTC+5
    r = client.post("/api/tasks", json={**TASK, "deadline": "2026-11-17T23:00:00"}, headers=h(uid))
    assert r.json()["deadline"] == "2026-11-17T18:00:00Z"


def test_task_ownership_isolation(client):
    alice = make_profile(client)
    bob = make_profile(client)
    task = client.post("/api/tasks", json=TASK, headers=h(alice)).json()

    assert client.get(f"/api/tasks/{alice}", headers=h(bob)).status_code == 403
    assert client.patch(f"/api/tasks/{task['id']}", json={"title": "pwned"}, headers=h(bob)).status_code == 404
    assert client.delete(f"/api/tasks/{task['id']}", headers=h(bob)).status_code == 404
    assert client.get(f"/api/tasks/{alice}", headers=h(alice)).json()[0]["title"] == "DBMS assignment"


def test_deleting_task_keeps_plan_history(client, db_session):
    uid = make_profile(client)
    task = client.post("/api/tasks", json=TASK, headers=h(uid)).json()
    plan = Plan(user_id=uid, local_date=__import__("datetime").date(2026, 11, 17), plan_json={}, provider="test", model="t")
    db_session.add(plan)
    db_session.flush()
    db_session.add(
        PlanItem(plan_id=plan.id, task_id=task["id"], position=0, item_type="study", title="Work",
                 instructions="x", duration_minutes=25, task_title_snapshot="DBMS assignment")
    )
    db_session.commit()

    assert client.delete(f"/api/tasks/{task['id']}", headers=h(uid)).status_code == 200
    db_session.expire_all()
    item = db_session.query(PlanItem).filter_by(plan_id=plan.id).one()
    assert item.task_id is None
    assert item.task_title_snapshot == "DBMS assignment"
