import pytest
from datetime import date
from sqlmodel import Session, select
from app.models import AuditLog, User, UserRole
from app.security import hash_password


@pytest.fixture()
def owner_headers(client, engine) -> dict[str, str]:
    with Session(engine) as session:
        owner = session.exec(select(User).where(User.email == "owner@example.com")).first()
        if not owner:
            owner = User(
                email="owner@example.com",
                hashed_password=hash_password("ownersecret"),
                name="Big Owner",
                role=UserRole.owner,
            )
            session.add(owner)
            session.commit()
    res = client.post("/auth/login", json={"email": "owner@example.com", "password": "ownersecret"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def admin_headers(client, engine) -> tuple[dict[str, str], int]:
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.email == "sarah.admin@example.com")).first()
        if not admin:
            admin = User(
                email="sarah.admin@example.com",
                hashed_password=hash_password("adminpass"),
                name="Sarah Admin",
                role=UserRole.admin,
            )
            session.add(admin)
            session.commit()
            session.refresh(admin)
        admin_id = admin.id
    res = client.post("/auth/login", json={"email": "sarah.admin@example.com", "password": "adminpass"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}, admin_id


def test_admin_work_order_audit_logging(client, admin_headers, owner_headers):
    admin_auth, admin_id = admin_headers

    # 1. Admin creates a work order
    wo_payload = {
        "assigned_to_name": "Tom Technician",
        "assigned_to_phone": "+15551234567",
        "date_assigned": date.today().isoformat(),
        "service_address": "742 Evergreen Terrace",
        "tenant_names": "Homer Simpson",
        "tenant_phone": "+15559876543",
        "priority": "emergency",
        "items": [
            {"category": "Other", "details": "Fix broken radiator"},
        ],
    }
    create_res = client.post("/work-orders", json=wo_payload, headers=admin_auth)
    assert create_res.status_code == 201, create_res.text
    wo_data = create_res.json()
    wo_id = wo_data["id"]
    wo_number = wo_data["work_order_number"]

    # 2. Admin verifies work orders cannot be edited once created (locked)
    update_res = client.patch(
        f"/work-orders/{wo_id}",
        json={"assigned_to_name": "Lisa Tech"},
        headers=admin_auth,
    )
    assert update_res.status_code == 409

    # 3. Admin regenerates link
    regen_res = client.post(f"/work-orders/{wo_id}/regenerate-link", headers=admin_auth)
    assert regen_res.status_code == 200

    # 4. Admin resends link
    resend_res = client.post(f"/work-orders/{wo_id}/resend", headers=admin_auth)
    assert resend_res.status_code == 200

    # 5. Admin accesses audit logs -> FORBIDDEN (Only owner allowed)
    admin_logs_res = client.get("/audit-logs", headers=admin_auth)
    assert admin_logs_res.status_code == 403

    # 6. Owner checks audit logs
    owner_logs_res = client.get("/audit-logs", headers=owner_headers)
    assert owner_logs_res.status_code == 200
    logs = owner_logs_res.json()["items"]
    assert len(logs) >= 3

    # Verify create action was logged
    create_log = next((l for l in logs if l["action"] == "work_order.create"), None)
    assert create_log is not None
    assert create_log["actor_name"] == "Sarah Admin"
    assert create_log["actor_role"] == "admin"
    assert create_log["entity_name"] == wo_number
    assert "742 Evergreen Terrace" in create_log["description"]
    assert create_log["parsed_details"]["assigned_to_name"] == "Tom Technician"

    # Verify regenerate link was logged
    regen_log = next((l for l in logs if l["action"] == "work_order.regenerate_link"), None)
    assert regen_log is not None
    assert regen_log["actor_name"] == "Sarah Admin"
    assert regen_log["entity_name"] == wo_number

    # Verify resend link was logged
    resend_log = next((l for l in logs if l["action"] == "work_order.resend_link"), None)
    assert resend_log is not None


def test_filter_audit_logs_by_admin(client, admin_headers, owner_headers):
    admin_auth, admin_id = admin_headers

    # Admin creates category
    cat_res = client.post(
        "/checklist-categories",
        json={"name": "Fire Sprinklers"},
        headers=admin_auth,
    )
    assert cat_res.status_code == 201

    # Filter audit logs by actor_role=admin
    res = client.get("/audit-logs?actor_role=admin", headers=owner_headers)
    assert res.status_code == 200
    data = res.json()
    assert all(item["actor_role"] == "admin" for item in data["items"])

    # Search filter
    search_res = client.get("/audit-logs?search=Sprinklers", headers=owner_headers)
    assert search_res.status_code == 200
    search_items = search_res.json()["items"]
    assert len(search_items) >= 1
    assert "Sprinklers" in search_items[0]["description"]


def test_audit_stats(client, admin_headers, owner_headers):
    res = client.get("/audit-logs/stats", headers=owner_headers)
    assert res.status_code == 200
    stats = res.json()
    assert "total_events" in stats
    assert "admin_actions_today" in stats
    assert "work_order_actions" in stats
    assert "unique_active_admins" in stats
    assert stats["total_events"] > 0
