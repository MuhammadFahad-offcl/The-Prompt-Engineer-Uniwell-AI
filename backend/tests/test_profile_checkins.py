from tests.conftest import h, make_profile, new_uid


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["ai"]["configured"] is False
    assert body["ai"]["missing_env"] == "GEMINI_API_KEY"


def test_profile_requires_consent(client):
    uid = new_uid()
    r = client.post(
        "/api/profile",
        json={"user_id": uid, "language": "en", "preferred_session_minutes": 25, "consent_acknowledged": False},
        headers=h(uid),
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_profile_rejects_invalid_session_length(client):
    uid = new_uid()
    r = client.post(
        "/api/profile",
        json={"user_id": uid, "preferred_session_minutes": 33, "consent_acknowledged": True},
        headers=h(uid),
    )
    assert r.status_code == 422


def test_profile_roundtrip_and_header_mismatch(client):
    uid = make_profile(client)
    r = client.get(f"/api/profile/{uid}", headers=h(uid))
    assert r.status_code == 200
    assert r.json()["effective_session_minutes"] == 30
    other = make_profile(client)
    assert client.get(f"/api/profile/{uid}", headers=h(other)).status_code == 403
    assert client.get(f"/api/profile/{uid}").status_code == 401


CHECKIN = {"mood_score": 3, "sleep_quality": "okay", "workload_score": 5, "energy_score": 2, "available_minutes": 120}


def test_checkin_validation_ranges(client):
    uid = make_profile(client)
    for bad in (
        {**CHECKIN, "mood_score": 0},
        {**CHECKIN, "mood_score": 6},
        {**CHECKIN, "workload_score": 9},
        {**CHECKIN, "energy_score": 0},
        {**CHECKIN, "sleep_quality": "terrible"},
        {**CHECKIN, "available_minutes": 0},
    ):
        r = client.post("/api/checkins", json=bad, headers=h(uid))
        assert r.status_code == 422, bad


def test_checkin_one_per_day_updates_instead_of_duplicating(client):
    uid = make_profile(client)
    r1 = client.post("/api/checkins", json=CHECKIN, headers=h(uid))
    assert r1.status_code == 200 and r1.json()["updated_existing"] is False
    r2 = client.post("/api/checkins", json={**CHECKIN, "mood_score": 4}, headers=h(uid))
    assert r2.json()["updated_existing"] is True
    assert r2.json()["checkin"]["revision"] == 2

    hist = client.get(f"/api/checkins/{uid}", headers=h(uid)).json()
    assert len(hist["items"]) == 1
    assert hist["today"]["mood_score"] == 4
    assert hist["today_local_date"] == "2026-11-17"


def test_checkin_requires_profile(client):
    uid = new_uid()
    r = client.post("/api/checkins", json=CHECKIN, headers=h(uid))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "profile_not_found"
