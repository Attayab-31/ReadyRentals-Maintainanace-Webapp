from datetime import date, timedelta
import json

from sqlmodel import Session
from tests.conftest import TINY_PNG, TINY_PNG_B64, make_work_order_payload
from app.models import WorkOrderItem
from app.services.storage import get_storage


def upload_item_photos(client, token, item_ids):
    for item_id in item_ids:
        before = client.post(
            f"/wo/{token}/items/{item_id}/photo",
            params={"slot": "before"},
            files={"file": ("before.png", TINY_PNG, "image/png")},
        )
        assert before.status_code == 200, before.text
        after = client.post(
            f"/wo/{token}/items/{item_id}/photo",
            params={"slot": "after"},
            files={"file": ("after.png", TINY_PNG, "image/png")},
        )
        assert after.status_code == 200, after.text


def finish_payload(**overrides):
    data = {
        "entire_unit_inspected": True,
        "inspection_results": "Unit in good condition",
    }
    data.update(overrides)
    return data


def create_owner_headers(client):
    response = client.post(
        "/auth/register-owner",
        json={
            "name": "Recycle Bin Owner",
            "email": "recycle-owner@example.com",
            "password": "ownerpassword123",
            "owner_code": "READY-RENTALS-OWNER-2026",
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def resolve_items(client, token, item_ids):
    for item_id in item_ids:
        patched = client.patch(f"/wo/{token}/items/{item_id}", json={"resolved": True})
        assert patched.status_code == 200, patched.text


def test_checklist_categories_seeded_and_create(client, auth_headers):
    listed = client.get("/checklist-categories", headers=auth_headers)
    assert listed.status_code == 200
    names = {row["name"] for row in listed.json()}
    assert "Interior Surfaces" in names
    assert "Other" in names
    created = client.post(
        "/checklist-categories",
        headers=auth_headers,
        json={"name": "Windows"},
    )
    assert created.status_code == 201
    assert created.json()["name"] == "Windows"
    assert created.json()["is_active"] is True

    duplicate = client.post(
        "/checklist-categories",
        headers=auth_headers,
        json={"name": " windows "},
    )
    assert duplicate.status_code == 409

    archived = client.delete(
        f"/checklist-categories/{created.json()['id']}", headers=auth_headers
    )
    assert archived.status_code == 200
    active_names = {
        row["name"]
        for row in client.get("/checklist-categories", headers=auth_headers).json()
    }
    assert "Windows" not in active_names

    reactivated = client.post(
        "/checklist-categories",
        headers=auth_headers,
        json={"name": " WINDOWS "},
    )
    assert reactivated.status_code == 201
    assert reactivated.json()["id"] == created.json()["id"]


def test_archived_category_stays_on_history_but_cannot_be_reused(client, auth_headers):
    created_category = client.post(
        "/checklist-categories", headers=auth_headers, json={"name": "Windows"}
    ).json()
    payload = make_work_order_payload(
        items=[{"category": "Windows", "details": "Replace window"}]
    )
    created_order = client.post(
        "/work-orders", headers=auth_headers, json=payload)
    assert created_order.status_code == 201

    archived = client.delete(
        f"/checklist-categories/{created_category['id']}", headers=auth_headers
    )
    assert archived.status_code == 200

    fetched = client.get(
        f"/work-orders/{created_order.json()['id']}", headers=auth_headers
    )
    assert fetched.status_code == 200
    assert fetched.json()["items"][0]["category"] == "Windows"

    rejected = client.post("/work-orders", headers=auth_headers, json=payload)
    assert rejected.status_code == 400
    assert "Unknown checklist category 'Windows'" in rejected.json()["detail"]


def test_create_work_order_requires_complete_immutable_details(client, auth_headers):
    missing_tenant_phone = make_work_order_payload()
    missing_tenant_phone.pop("tenant_phone")
    response = client.post(
        "/work-orders", headers=auth_headers, json=missing_tenant_phone
    )
    assert response.status_code == 422

    blank_item_details = make_work_order_payload(
        items=[{"category": "Interior Surfaces", "details": "   "}]
    )
    response = client.post(
        "/work-orders", headers=auth_headers, json=blank_item_details
    )
    assert response.status_code == 422

    no_items = make_work_order_payload(items=[])
    response = client.post("/work-orders", headers=auth_headers, json=no_items)
    assert response.status_code == 422


def test_create_work_order_normalizes_and_validates_phone_numbers(client, auth_headers):
    formatted_numbers = make_work_order_payload(
        assigned_to_phone="(555) 555-0100",
        tenant_phone="1 (555) 555-0200",
    )
    response = client.post(
        "/work-orders", headers=auth_headers, json=formatted_numbers
    )
    assert response.status_code == 201, response.text
    assert response.json()["assigned_to_phone"] == "+15555550100"
    assert response.json()["tenant_phone"] == "+15555550200"

    invalid_number = make_work_order_payload(tenant_phone="1234")
    response = client.post(
        "/work-orders", headers=auth_headers, json=invalid_number
    )
    assert response.status_code == 422


def test_office_roles_can_create_work_orders_with_optional_before_photos(
    client, auth_headers
):
    owner_headers = create_owner_headers(client)
    payload = make_work_order_payload()
    data = {
        "payload": json.dumps(payload),
        "photo_indices": "[1]",
    }
    files = [("photos", ("before.png", TINY_PNG, "image/png"))]

    for headers in (auth_headers, owner_headers):
        created = client.post(
            "/work-orders/with-photos",
            headers=headers,
            data=data,
            files=files,
        )
        assert created.status_code == 201, created.text
        items = created.json()["items"]
        assert items[0]["before_photo_url"] is None
        assert items[0]["before_photo_required"] is True
        assert items[1]["before_photo_url"]
        assert items[1]["before_photo_required"] is True
        assert get_storage().exists(items[1]["before_photo_url"])

        worker_view = client.get(f"/wo/{created.json()['worker_access_token']}")
        assert worker_view.status_code == 200
        assert worker_view.json()["items"][1]["before_photo_url"] == items[1]["before_photo_url"]


def test_creation_photo_indices_are_validated(client, auth_headers):
    response = client.post(
        "/work-orders/with-photos",
        headers=auth_headers,
        data={
            "payload": json.dumps(make_work_order_payload()),
            "photo_indices": "[2]",
        },
        files=[("photos", ("before.png", TINY_PNG, "image/png"))],
    )
    assert response.status_code == 422
    assert client.get("/work-orders", headers=auth_headers).json() == []


def test_failed_creation_photo_storage_rolls_back_order_and_files(
    client, auth_headers, monkeypatch
):
    storage = get_storage()
    original_save = storage.save
    calls = 0

    def fail_second_save(data, key, content_type=None):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("simulated storage failure")
        return original_save(data, key, content_type)

    monkeypatch.setattr(storage, "save", fail_second_save)
    response = client.post(
        "/work-orders/with-photos",
        headers=auth_headers,
        data={
            "payload": json.dumps(make_work_order_payload()),
            "photo_indices": "[0,1]",
        },
        files=[
            ("photos", ("before-1.png", TINY_PNG, "image/png")),
            ("photos", ("before-2.png", TINY_PNG, "image/png")),
        ],
    )
    assert response.status_code == 503
    assert client.get("/work-orders", headers=auth_headers).json() == []
    assert not list(storage.root.rglob("*.png"))


def test_before_photo_is_required_for_new_work_orders(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    token = created["worker_access_token"]
    item_ids = [row["id"] for row in created["items"]]
    assert all(row["before_photo_required"] for row in created["items"])

    assert client.post(f"/wo/{token}/start").status_code == 200
    resolve_items(client, token, item_ids)
    skipped = client.patch(
        f"/wo/{token}/items/{item_ids[0]}",
        json={"before_photo_skipped": True},
    )
    assert skipped.status_code == 400
    assert "before photo is required" in skipped.json()["detail"].lower()

    for item_id in item_ids:
        response = client.patch(
            f"/wo/{token}/items/{item_id}",
            json={"after_photo_skipped": True},
        )
        assert response.status_code == 200
    missing_before = client.post(
        f"/wo/{token}/complete", json=finish_payload()
    )
    assert missing_before.status_code == 400
    assert "before photo" in missing_before.json()["detail"].lower()

    upload_item_photos(client, token, item_ids)
    completed = client.post(f"/wo/{token}/complete", json=finish_payload())
    assert completed.status_code == 200, completed.text


def test_worker_cannot_complete_without_required_photos(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    assert created.status_code == 201, created.text
    token = created.json()["worker_access_token"]
    item_id = created.json()["items"][0]["id"]

    started = client.post(f"/wo/{token}/start")
    assert started.status_code == 200, started.text

    item_ids = [row["id"] for row in created.json()["items"]]
    resolve_items(client, token, item_ids)

    completed = client.post(
        f"/wo/{token}/complete",
        json=finish_payload(),
    )
    assert completed.status_code == 400
    assert "no picture" in completed.json()["detail"].lower()


def test_full_status_lifecycle(client, auth_headers, tmp_path):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    assert created.status_code == 201, created.text
    body = created.json()
    wo_id = body["id"]
    token = body["worker_access_token"]
    assert body["status"] == "assigned"
    assert body["worker_share_url"].endswith(f"/wo/{token}")
    assert body["duration_minutes"] is None
    assert body["within_target"] is None
    item_id = body["items"][0]["id"]
    item2_id = body["items"][1]["id"]

    listed = client.get("/work-orders", headers=auth_headers)
    assert listed.status_code == 200
    assert any(row["id"] == wo_id for row in listed.json())

    filtered = client.get(
        "/work-orders",
        headers=auth_headers,
        params={"status": "assigned", "address": "Maple"},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1

    fetched = client.get(f"/work-orders/{wo_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["work_order_number"].startswith("WO-")

    patch_attempt = client.patch(
        f"/work-orders/{wo_id}",
        headers=auth_headers,
        json={"assigned_to_name": "Alexandra Tech"},
    )
    assert patch_attempt.status_code == 409
    assert "locked after creation" in patch_attempt.json()["detail"].lower()

    unchanged = client.get(f"/work-orders/{wo_id}", headers=auth_headers)
    assert unchanged.status_code == 200
    assert unchanged.json()["assigned_to_name"] == created.json()["assigned_to_name"]

    worker = client.get(f"/wo/{token}")
    assert worker.status_code == 200
    assert worker.json()["status"] == "assigned"
    assert worker.json()["start_time"] is None
    assert "pdf_url" in worker.json()
    assert worker.json()["pdf_url"] is None

    started = client.post(f"/wo/{token}/start")
    assert started.status_code == 200
    assert started.json()["status"] == "in_progress"
    assert started.json()["start_time"]

    again = client.post(f"/wo/{token}/start")
    assert again.status_code == 400

    admin_locked = client.patch(
        f"/work-orders/{wo_id}",
        headers=auth_headers,
        json={"assigned_to_name": "Nope"},
    )
    assert admin_locked.status_code == 409

    updated = client.patch(
        f"/wo/{token}/items/{item_id}",
        json={"details": "Patched and painted wall", "resolved": True},
    )
    assert updated.status_code == 200
    assert updated.json()["resolved"] is True

    photo = client.post(
        f"/wo/{token}/items/{item_id}/photo",
        params={"slot": "before"},
        files={"file": ("before.png", TINY_PNG, "image/png")},
    )
    assert photo.status_code == 200
    assert photo.json()["before_photo_url"]

    photo_after = client.post(
        f"/wo/{token}/items/{item_id}/photo",
        params={"slot": "after"},
        files={"file": ("after.png", TINY_PNG, "image/png")},
    )
    assert photo_after.status_code == 200
    assert photo_after.json()["after_photo_url"]

    client.patch(f"/wo/{token}/items/{item2_id}", json={"resolved": True})
    upload_item_photos(client, token, [item_id, item2_id])

    too_early_sign = client.post(
        f"/wo/{token}/sign",
        json={"signer": "tenant", "name": "Jamie Tenant",
              "signature_png_base64": TINY_PNG_B64},
    )
    assert too_early_sign.status_code == 400

    completed = client.post(
        f"/wo/{token}/complete",
        json={
            "entire_unit_inspected": True,
            "inspection_results": "Unit in good condition",
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed_pending_signoff"
    assert completed.json()["end_time"]
    assert completed.json()["duration_minutes"] is not None
    assert completed.json()["entire_unit_inspected"] is True

    tenant = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tenant",
            "name": "Jamie Tenant",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert tenant.status_code == 200
    assert tenant.json()["tenant_signed"] is True
    assert tenant.json()["status"] == "completed_pending_signoff"

    tenant_again = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tenant",
            "name": "Jamie Tenant",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert tenant_again.status_code == 400

    tech = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tech",
            "name": "Alexandra Tech",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert tech.status_code == 200, tech.text
    assert tech.json()["status"] == "signed_off"
    assert tech.json()["tech_signed"] is True
    assert tech.json()["pdf_url"]

    admin_view = client.get(f"/work-orders/{wo_id}", headers=auth_headers)
    assert admin_view.json()["status"] == "signed_off"
    assert admin_view.json()["duration_minutes"] is not None
    assert admin_view.json()["within_target"] is True


def test_failed_worker_notification_is_recorded(client, auth_headers, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("SMS failed")

    monkeypatch.setattr("app.services.notifications.send_worker_link", boom)

    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(),
    )
    assert created.status_code == 201, created.text

    work_order = client.get(
        f"/work-orders/{created.json()['id']}", headers=auth_headers
    )
    assert work_order.status_code == 200, work_order.text
    assert "worker_notify_error" in work_order.json()
    assert "SMS failed" in work_order.json()["worker_notify_error"]


def test_permanent_delete_cleanup_failure_keeps_work_order_in_recycle_bin(
    client, auth_headers, monkeypatch
):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(),
    )
    assert created.status_code == 201, created.text
    work_order_id = created.json()["id"]

    trashed = client.delete(
        f"/work-orders/{work_order_id}", headers=auth_headers)
    assert trashed.status_code == 200
    owner_headers = create_owner_headers(client)

    class BadStorage:
        def delete_prefix(self, _prefix):
            raise RuntimeError("disk failure")

    monkeypatch.setattr("app.services.work_orders.get_storage", lambda: BadStorage())
    deleted = client.delete(
        f"/work-orders/recycle-bin/{work_order_id}", headers=owner_headers
    )
    assert deleted.status_code == 503
    assert client.get(f"/work-orders/{work_order_id}", headers=owner_headers).status_code == 404
    bin_response = client.get("/work-orders/recycle-bin", headers=owner_headers)
    assert bin_response.status_code == 200
    assert [row["id"] for row in bin_response.json()["items"]] == [work_order_id]


def test_recycle_bin_is_owner_only_filters_and_restores_work_orders(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    assert created.status_code == 201, created.text
    work_order = created.json()
    work_order_id = work_order["id"]
    token = work_order["worker_access_token"]
    assert client.post(f"/wo/{token}/start").status_code == 200
    stored_photos = []
    for item in work_order["items"]:
        for slot in ("before", "after"):
            uploaded = client.post(
                f"/wo/{token}/items/{item['id']}/photo",
                params={"slot": slot},
                files={"file": (f"{slot}.png", TINY_PNG, "image/png")},
            )
            assert uploaded.status_code == 200, uploaded.text
            stored_photos.append(uploaded.json()[f"{slot}_photo_url"])

    assert client.get("/work-orders/recycle-bin", headers=auth_headers).status_code == 403
    assert client.delete(
        f"/work-orders/{work_order_id}", headers=auth_headers
    ).status_code == 200
    assert client.get(
        f"/work-orders/{work_order_id}", headers=auth_headers
    ).status_code == 404
    assert client.get(f"/wo/{token}").status_code == 404
    assert all(get_storage().exists(photo) for photo in stored_photos)

    owner_headers = create_owner_headers(client)
    assert client.post(
        f"/work-orders/recycle-bin/{work_order_id}/restore",
        headers=auth_headers,
    ).status_code == 403
    listed = client.get("/work-orders/recycle-bin", headers=owner_headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["total"] == 1
    assert body["limit"] == 25
    assert body["offset"] == 0
    assert body["items"][0]["id"] == work_order_id
    assert body["items"][0]["deleted_at"]
    assert client.get("/work-orders", headers=owner_headers).json() == []
    trash_logs = client.get(
        "/audit-logs",
        headers=owner_headers,
        params={"action": "work_order.trash"},
    )
    assert trash_logs.status_code == 200
    assert trash_logs.json()["total"] == 1
    assert client.get(
        "/work-orders/recycle-bin",
        headers=owner_headers,
        params={"search": "Maple"},
    ).json()["total"] == 1
    assert client.get(
        "/work-orders/recycle-bin",
        headers=owner_headers,
        params={"search": "does-not-match"},
    ).json()["total"] == 0
    assert client.get(
        "/work-orders/recycle-bin",
        headers=owner_headers,
        params={"deleted_from": (date.today() + timedelta(days=3650)).isoformat()},
    ).json()["total"] == 0
    assert client.get(
        "/work-orders/recycle-bin",
        headers=owner_headers,
        params={
            "deleted_from": (date.today() + timedelta(days=1)).isoformat(),
            "deleted_to": date.today().isoformat(),
        },
    ).status_code == 422

    restored = client.post(
        f"/work-orders/recycle-bin/{work_order_id}/restore",
        headers=owner_headers,
    )
    assert restored.status_code == 200, restored.text
    assert client.get(
        f"/work-orders/{work_order_id}", headers=owner_headers
    ).status_code == 200
    assert client.get(f"/wo/{token}").status_code == 200
    assert all(get_storage().exists(photo) for photo in stored_photos)
    assert client.get("/work-orders/recycle-bin", headers=owner_headers).json()["total"] == 0
    restore_logs = client.get(
        "/audit-logs",
        headers=owner_headers,
        params={"action": "work_order.restore"},
    )
    assert restore_logs.status_code == 200
    assert restore_logs.json()["total"] == 1


def test_permanent_delete_removes_files_and_is_owner_only(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    work_order_id = created["id"]
    token = created["worker_access_token"]
    assert client.post(f"/wo/{token}/start").status_code == 200
    upload_item_photos(client, token, [item["id"] for item in created["items"]])
    work_order_dir = get_storage().root / "work-orders" / str(work_order_id)
    assert work_order_dir.exists()
    assert client.delete(
        f"/work-orders/{work_order_id}", headers=auth_headers
    ).status_code == 200

    assert client.delete(
        f"/work-orders/recycle-bin/{work_order_id}", headers=auth_headers
    ).status_code == 403
    owner_headers = create_owner_headers(client)
    deleted = client.delete(
        f"/work-orders/recycle-bin/{work_order_id}", headers=owner_headers
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["detail"] == "Work order permanently deleted"
    assert not work_order_dir.exists()
    assert client.get(
        "/work-orders/recycle-bin", headers=owner_headers
    ).json()["total"] == 0
    permanent_logs = client.get(
        "/audit-logs",
        headers=owner_headers,
        params={"action": "work_order.permanently_delete"},
    )
    assert permanent_logs.status_code == 200
    assert permanent_logs.json()["total"] == 1


def test_regenerate_link_invalidates_old_token(client, auth_headers):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(),
    )
    assert created.status_code == 201, created.text
    work_order_id = created.json()["id"]
    old_token = created.json()["worker_access_token"]

    regenerated = client.post(
        f"/work-orders/{work_order_id}/regenerate-link",
        headers=auth_headers,
    )
    assert regenerated.status_code == 200, regenerated.text
    body = regenerated.json()
    assert body["worker_access_token"] != old_token

    old_lookup = client.get(f"/wo/{old_token}")
    assert old_lookup.status_code in {404, 410}

    new_lookup = client.get(f"/wo/{body['worker_access_token']}")
    assert new_lookup.status_code == 200
    assert new_lookup.json()["work_order_number"] == created.json()[
        "work_order_number"]


def test_delete_work_order_at_each_pre_signoff_stage(client, auth_headers):
    assigned = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    assert client.delete(
        f"/work-orders/{assigned['id']}", headers=auth_headers
    ).status_code == 200

    in_progress = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    token = in_progress["worker_access_token"]
    assert client.post(f"/wo/{token}/start").status_code == 200
    assert client.delete(
        f"/work-orders/{in_progress['id']}", headers=auth_headers
    ).status_code == 200

    incomplete = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    token = incomplete["worker_access_token"]
    item_ids = [row["id"] for row in incomplete["items"]]
    assert client.post(f"/wo/{token}/start").status_code == 200
    upload_item_photos(client, token, item_ids)
    resolve_items(client, token, item_ids)
    assert client.post(
        f"/wo/{token}/complete",
        json=finish_payload(),
    ).status_code == 200
    assert client.delete(
        f"/work-orders/{incomplete['id']}", headers=auth_headers
    ).status_code == 200


def test_cannot_complete_before_start(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    token = created.json()["worker_access_token"]
    response = client.post(f"/wo/{token}/complete", json=finish_payload())
    assert response.status_code == 400


def test_unresolved_items_cannot_reach_signatures(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    token = created.json()["worker_access_token"]
    item_ids = [row["id"] for row in created.json()["items"]]
    client.post(f"/wo/{token}/start")
    client.patch(
        f"/wo/{token}/items/{item_ids[0]}",
        json={"resolved": False, "tech_notes": "Waiting on special-order caulk"},
    )
    upload_item_photos(client, token, item_ids)
    completed = client.post(
        f"/wo/{token}/complete",
        json=finish_payload(entire_unit_inspected=False),
    )
    assert completed.status_code == 400
    assert "resolved" in completed.json()["detail"].lower()

    saved = client.post(
        f"/wo/{token}/progress",
        json={"entire_unit_inspected": False, "inspection_results": "Need a return visit"},
    )
    assert saved.status_code == 200
    assert saved.json()["status"] == "in_progress"
    assert saved.json()["inspection_results"] == "Need a return visit"

    office = client.get(
        f"/work-orders/{created.json()['id']}", headers=auth_headers
    )
    assert office.json()["status"] == "in_progress"
    assert office.json()["items"][0]["tech_notes"] == "Waiting on special-order caulk"


def test_legacy_work_order_can_still_skip_before_photos(client, auth_headers, engine):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(items=[{
            "category": "Interior Surfaces",
            "details": "Repair wall",
        }]),
    )
    token = created.json()["worker_access_token"]
    item_ids = [row["id"] for row in created.json()["items"]]
    with Session(engine) as session:
        item = session.get(WorkOrderItem, item_ids[0])
        assert item is not None
        item.before_photo_required = False
        session.add(item)
        session.commit()

    client.post(f"/wo/{token}/start")
    resolve_items(client, token, item_ids)
    for item_id in item_ids:
        skipped = client.patch(
            f"/wo/{token}/items/{item_id}",
            json={"before_photo_skipped": True, "after_photo_skipped": True},
        )
        assert skipped.status_code == 200, skipped.text
    completed = client.post(f"/wo/{token}/complete", json=finish_payload())
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed_pending_signoff"


def test_signoff_pdf_failure_does_not_partially_commit(client, auth_headers, monkeypatch):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(
            items=[
                {"category": "Interior Surfaces",
                    "details": "Repair", "resolved": True}
            ]
        ),
    )
    wo_id = created.json()["id"]
    token = created.json()["worker_access_token"]
    item_ids = [row["id"] for row in created.json()["items"]]
    client.post(f"/wo/{token}/start")
    upload_item_photos(client, token, item_ids)
    completed = client.post(f"/wo/{token}/complete", json=finish_payload())
    assert completed.status_code == 200

    tenant = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tenant",
            "name": "Jamie Tenant",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert tenant.status_code == 200

    def fail_pdf(*args, **kwargs):
        raise OSError("libgobject-2.0-0 unavailable")

    monkeypatch.setattr("app.services.work_orders.generate_pdf", fail_pdf)
    tech = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tech",
            "name": "Alex Tech",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert tech.status_code == 503

    worker = client.get(f"/wo/{token}").json()
    assert worker["status"] == "completed_pending_signoff"
    assert worker["tenant_signed"] is True
    assert worker["tech_signed"] is False
    assert worker["pdf_url"] is None

    admin_view = client.get(f"/work-orders/{wo_id}", headers=auth_headers).json()
    assert admin_view["status"] == "completed_pending_signoff"
    assert admin_view["tech_signature_url"] is None


def test_tech_cannot_sign_before_tenant(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    token = created.json()["worker_access_token"]
    item_ids = [row["id"] for row in created.json()["items"]]
    client.post(f"/wo/{token}/start")
    client.patch(
        f"/wo/{token}/items/{item_ids[0]}",
        json={"resolved": True},
    )
    client.patch(
        f"/wo/{token}/items/{item_ids[1]}",
        json={"resolved": True},
    )
    upload_item_photos(client, token, item_ids)
    assert client.post(f"/wo/{token}/complete", json=finish_payload()).status_code == 200
    response = client.post(
        f"/wo/{token}/sign",
        json={
            "signer": "tech",
            "name": "Alex Tech",
            "signature_png_base64": TINY_PNG_B64,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Tenant must sign before technician"


def test_list_overdue_filter(client, auth_headers):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(
            priority="emergency",
            date_assigned=(date.today() - timedelta(days=2)).isoformat(),
        ),
    )
    assert created.status_code == 201
    overdue = client.get(
        "/work-orders", headers=auth_headers, params={"overdue": True})
    assert overdue.status_code == 200
    assert len(overdue.json()) >= 1


def test_owner_can_delete_completed_work_order_but_admin_cannot(
    client, auth_headers, monkeypatch
):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    wo_id = created["id"]
    token = created["worker_access_token"]
    item_ids = [row["id"] for row in created["items"]]

    client.post(f"/wo/{token}/start")
    upload_item_photos(client, token, item_ids)
    resolve_items(client, token, item_ids)
    client.post(f"/wo/{token}/complete", json=finish_payload())
    client.post(
        f"/wo/{token}/sign",
        json={"signer": "tenant", "name": "Tenant Name", "signature_png_base64": TINY_PNG_B64},
    )
    signed = client.post(
        f"/wo/{token}/sign",
        json={"signer": "tech", "name": "Tech Name", "signature_png_base64": TINY_PNG_B64},
    )
    assert signed.status_code == 200
    assert signed.json()["status"] == "signed_off"

    # Office Admin (non-owner) attempts to delete -> fails with 409
    admin_del = client.delete(f"/work-orders/{wo_id}", headers=auth_headers)
    assert admin_del.status_code == 409
    assert "Completed work orders cannot be deleted" in admin_del.json()["detail"]

    owner_headers = create_owner_headers(client)

    storage = get_storage()
    original_delete_prefix = storage.delete_prefix

    def fail_file_cleanup(_prefix):
        raise OSError("simulated storage failure")

    monkeypatch.setattr(storage, "delete_prefix", fail_file_cleanup)
    owner_del = client.delete(f"/work-orders/{wo_id}", headers=owner_headers)
    assert owner_del.status_code == 200
    assert owner_del.json()["detail"] == "Moved to recycle bin"
    assert (get_storage().root / "work-orders" / str(wo_id)).exists()
    assert client.get(f"/work-orders/{wo_id}", headers=owner_headers).status_code == 404

    failed_permanent_delete = client.delete(
        f"/work-orders/recycle-bin/{wo_id}", headers=owner_headers
    )
    assert failed_permanent_delete.status_code == 503
    assert client.get("/work-orders/recycle-bin", headers=owner_headers).json()["total"] == 1

    monkeypatch.setattr(storage, "delete_prefix", original_delete_prefix)
    permanent_delete = client.delete(
        f"/work-orders/recycle-bin/{wo_id}", headers=owner_headers
    )
    assert permanent_delete.status_code == 200
    assert not (get_storage().root / "work-orders" / str(wo_id)).exists()

    get_res = client.get(f"/work-orders/{wo_id}", headers=owner_headers)
    assert get_res.status_code == 404


def test_photo_remove_replace_and_work_order_delete_clean_all_files(
    client, auth_headers, monkeypatch
):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    ).json()
    wo_id = created["id"]
    token = created["worker_access_token"]
    item_id = created["items"][0]["id"]
    storage = get_storage()

    assert client.post(f"/wo/{token}/start").status_code == 200
    photo_url = client.post(
        f"/wo/{token}/items/{item_id}/photo",
        params={"slot": "before"},
        files={"file": ("before.png", TINY_PNG, "image/png")},
    ).json()["before_photo_url"]
    replaced_url = client.post(
        f"/wo/{token}/items/{item_id}/photo",
        params={"slot": "before"},
        files={"file": ("replacement.png", TINY_PNG, "image/png")},
    ).json()["before_photo_url"]
    assert photo_url != replaced_url
    assert not storage.exists(photo_url)
    assert storage.exists(replaced_url)

    original_delete = storage.delete

    def fail_photo_cleanup(_url):
        raise OSError("simulated photo cleanup failure")

    monkeypatch.setattr(storage, "delete", fail_photo_cleanup)
    failed_remove = client.delete(
        f"/wo/{token}/items/{item_id}/photo", params={"slot": "before"}
    )
    assert failed_remove.status_code == 503
    restored = client.get(f"/wo/{token}").json()
    assert restored["items"][0]["before_photo_url"] == replaced_url
    assert storage.exists(replaced_url)
    monkeypatch.setattr(storage, "delete", original_delete)

    removed = client.delete(
        f"/wo/{token}/items/{item_id}/photo", params={"slot": "before"}
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["before_photo_url"] is None
    assert not storage.exists(replaced_url)

    # Moving a work order to the bin retains all attachments until permanent deletion.
    upload_item_photos(client, token, [row["id"] for row in created["items"]])
    work_order_dir = storage.root / "work-orders" / str(wo_id)
    assert work_order_dir.exists()
    deleted = client.delete(f"/work-orders/{wo_id}", headers=auth_headers)
    assert deleted.status_code == 200, deleted.text
    assert work_order_dir.exists()

    owner_headers = create_owner_headers(client)
    permanently_deleted = client.delete(
        f"/work-orders/recycle-bin/{wo_id}", headers=owner_headers
    )
    assert permanently_deleted.status_code == 200, permanently_deleted.text
    assert not work_order_dir.exists()
