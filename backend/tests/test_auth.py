def test_login_ok(client):
    response = client.post(
        "/auth/login", json={"email": "manager@example.com", "password": "secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_rejected(client):
    response = client.post(
        "/auth/login", json={"email": "manager@example.com", "password": "wrong"}
    )
    assert response.status_code == 401


def test_manager_routes_require_jwt(client):
    assert client.get("/work-orders").status_code == 401
    assert client.get("/checklist-categories").status_code == 401
