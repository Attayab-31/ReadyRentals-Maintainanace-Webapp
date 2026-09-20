from datetime import date, timedelta

from tests.conftest import TINY_PNG, TINY_PNG_B64, make_work_order_payload


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

    patched = client.patch(
        f"/work-orders/{wo_id}",
        headers=auth_headers,
        json={"assigned_to_name": "Alexandra Tech"},
    )
    assert patched.status_code == 200
    assert patched.json()["assigned_to_name"] == "Alexandra Tech"

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

    manager_locked = client.patch(
        f"/work-orders/{wo_id}",
        headers=auth_headers,
        json={"assigned_to_name": "Nope"},
    )
    assert manager_locked.status_code == 400

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

    manager_view = client.get(f"/work-orders/{wo_id}", headers=auth_headers)
    assert manager_view.json()["status"] == "signed_off"
    assert manager_view.json()["duration_minutes"] is not None
    assert manager_view.json()["within_target"] is True


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


def test_delete_cleanup_failure_keeps_row_queryable(client, auth_headers, monkeypatch):
    created = client.post(
        "/work-orders",
        headers=auth_headers,
        json=make_work_order_payload(),
    )
    assert created.status_code == 201, created.text
    work_order_id = created.json()["id"]

    class BadStorage:
        def delete_prefix(self, _prefix):
            raise RuntimeError("disk failure")

    monkeypatch.setattr(
        "app.services.work_orders.get_storage", lambda: BadStorage())

    deleted = client.delete(
        f"/work-orders/{work_order_id}", headers=auth_headers)
    assert deleted.status_code == 503

    fetched = client.get(f"/work-orders/{work_order_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == work_order_id


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


def test_no_picture_skip_allows_complete(client, auth_headers):
    created = client.post(
        "/work-orders", headers=auth_headers, json=make_work_order_payload()
    )
    token = created.json()["worker_access_token"]
    item_ids = [row["id"] for row in created.json()["items"]]
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

    manager = client.get(f"/work-orders/{wo_id}", headers=auth_headers).json()
    assert manager["status"] == "completed_pending_signoff"
    assert manager["tech_signature_url"] is None


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


def test_owner_can_delete_completed_work_order_but_manager_cannot(client, auth_headers):
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

    # Manager (non-owner) attempts to delete -> fails with 409
    manager_del = client.delete(f"/work-orders/{wo_id}", headers=auth_headers)
    assert manager_del.status_code == 409
    assert "Completed work orders cannot be deleted" in manager_del.json()["detail"]

    # Register owner
    owner_token_res = client.post(
        "/auth/register-owner",
        json={
            "name": "Super Owner",
            "email": "superowner@readyrentals.com",
            "password": "ownerpassword123",
            "owner_code": "READY-RENTALS-OWNER-2026",
        },
    )
    assert owner_token_res.status_code == 200
    owner_headers = {"Authorization": f"Bearer {owner_token_res.json()['access_token']}"}

    # Owner deletes the completed work order -> succeeds with 200
    owner_del = client.delete(f"/work-orders/{wo_id}", headers=owner_headers)
    assert owner_del.status_code == 200
    assert owner_del.json()["detail"] == "Deleted"

    # Verify work order is now gone
    get_res = client.get(f"/work-orders/{wo_id}", headers=owner_headers)
    assert get_res.status_code == 404

