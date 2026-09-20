from tests.conftest import make_work_order_payload


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


def test_get_me(client, auth_headers):
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "manager@example.com"
    assert data["name"] == "Pat Manager"
    assert data["role"] == "manager"


def test_register_owner_and_owner_permissions(client, auth_headers):
    # Register owner with wrong code fails
    fail_res = client.post(
        "/auth/register-owner",
        json={
            "name": "John USA",
            "email": "john@readyrentals.com",
            "password": "strongpassword123",
            "owner_code": "WRONG-CODE",
        },
    )
    assert fail_res.status_code == 403

    # Register owner with valid code succeeds
    ok_res = client.post(
        "/auth/register-owner",
        json={
            "name": "John USA",
            "email": "john@readyrentals.com",
            "password": "strongpassword123",
            "owner_code": "READY-RENTALS-OWNER-2026",
        },
    )
    assert ok_res.status_code == 200
    owner_token = ok_res.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # Verify /auth/me returns owner
    me_res = client.get("/auth/me", headers=owner_headers)
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "owner"

    # Regular manager cannot access /admins
    forbidden = client.get("/admins", headers=auth_headers)
    assert forbidden.status_code == 403

    # Owner can list admins
    admins_res = client.get("/admins", headers=owner_headers)
    assert admins_res.status_code == 200
    assert any(u["email"] == "john@readyrentals.com" for u in admins_res.json())

    # Owner creates an admin
    create_res = client.post(
        "/admins",
        headers=owner_headers,
        json={
            "name": "Sarah Admin",
            "email": "sarah@readyrentals.com",
            "password": "password123",
        },
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]
    assert create_res.json()["role"] == "admin"

    # Sarah Admin can log in
    sarah_login = client.post(
        "/auth/login",
        json={"email": "sarah@readyrentals.com", "password": "password123"},
    )
    assert sarah_login.status_code == 200
    sarah_headers = {"Authorization": f"Bearer {sarah_login.json()['access_token']}"}

    # Sarah can create a work order
    wo_res = client.post(
        "/work-orders",
        headers=sarah_headers,
        json=make_work_order_payload(),
    )
    assert wo_res.status_code == 201
    wo_data = wo_res.json()
    assert wo_data["created_by_name"] == "Sarah Admin"

    # Sarah cannot create admins
    sarah_forbidden = client.post(
        "/admins",
        headers=sarah_headers,
        json={
            "name": "Hacker",
            "email": "hacker@test.com",
            "password": "password123",
        },
    )
    assert sarah_forbidden.status_code == 403

    # Filter work orders by assigned_by_id
    filtered = client.get(f"/work-orders?assigned_by_id={created_id}", headers=owner_headers)
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["created_by_name"] == "Sarah Admin"

    # Owner cannot delete self
    self_delete = client.delete(f"/admins/{me_res.json()['id']}", headers=owner_headers)
    assert self_delete.status_code == 400

    # Owner deletes Sarah -> Sarah's work order is reassigned to owner
    del_res = client.delete(f"/admins/{created_id}", headers=owner_headers)
    assert del_res.status_code == 200

    # Work order still exists and is reassigned
    check_wo = client.get(f"/work-orders/{wo_data['id']}", headers=owner_headers)
    assert check_wo.status_code == 200
    assert check_wo.json()["created_by_name"] == "John USA"

    # Attempting to register another owner fails because an owner already exists
    second_owner_res = client.post(
        "/auth/register-owner",
        json={
            "name": "Second Owner",
            "email": "second@readyrentals.com",
            "password": "password123",
            "owner_code": "READY-RENTALS-OWNER-2026",
        },
    )
    assert second_owner_res.status_code == 400
    assert "already been registered" in second_owner_res.json()["detail"]
