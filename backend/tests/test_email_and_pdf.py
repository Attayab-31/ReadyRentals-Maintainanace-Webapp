from datetime import date
from pathlib import Path
from email import message_from_bytes

import pytest
from sqlmodel import Session, select

from app.config import get_settings
from app.models import Priority, User, UserRole, WorkOrder, WorkOrderItem, WorkOrderStatus
from app.security import hash_password
from app.services import notifications
from app.services.pdf import generate_pdf, render_html
from app.services.work_orders import get_work_order, send_completion_email
from tests.conftest import make_work_order_payload


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
def created_work_order(client, auth_headers, engine) -> int:
    payload = make_work_order_payload()
    res = client.post("/work-orders", json=payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_pdf_rendering_contains_logo_and_branding(engine, created_work_order):
    """Test that render_html and generate_pdf include the logo and Ready Rentals Online branding."""
    settings = get_settings()
    with Session(engine) as session:
        wo = get_work_order(session, created_work_order)
        html = render_html(wo)

        assert "Ready Rentals Online" in html
        assert "PROPERTY MAINTENANCE REPORT" in html
        assert "data:image/png;base64," in html  # Embedded base64 logo
        assert settings.company_phone in html
        assert settings.company_email in html

        pdf_bytes = generate_pdf(wo)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")
        assert len(pdf_bytes) > 20000


def test_email_content_customized_with_branding_and_footer(engine, created_work_order):
    """Test subject line, HTML body, plain text body, phone number, and footer logo."""
    settings = get_settings()
    with Session(engine) as session:
        wo = get_work_order(session, created_work_order)
        wo_num = wo.work_order_number
        filename = f"{wo_num}.pdf"

        subject, text_body, html_body = notifications.render_completion_email_content(
            work_order_number=wo_num,
            filename=filename,
            work_order=wo,
        )

        # Subject line customization
        assert f"Ready Rentals Online | Maintenance Work Order #{wo_num} Completed & Signed" == subject

        # HTML Body checks
        assert "READY RENTALS ONLINE" in html_body
        assert "Property Maintenance & Operations" in html_body
        assert wo.service_address in html_body
        assert "cid:readyrentals_logo" in html_body  # Ready Rentals Online Logo in footer
        assert settings.company_phone in html_body  # Phone number in footer
        assert settings.company_email in html_body  # Support email in footer
        assert "24/7 Emergency Maintenance Dispatch Available" in html_body
        assert "2026 Ready Rentals Online" in html_body
        assert "Attached PDF Report" in html_body

        # Plain text fallback checks
        assert "READY RENTALS ONLINE" in text_body
        assert wo.service_address in text_body
        assert settings.company_phone in text_body
        assert settings.company_email in text_body


def test_mime_email_structure(engine, created_work_order):
    """Test that the MIME email has the exact RFC-compliant structure with CID logo and PDF attachment."""
    wo_num = "WO-TEST-001"
    filename = f"{wo_num}.pdf"
    pdf_data = b"%PDF-1.4 dummy pdf content for testing"
    logo_bytes = notifications._load_logo_bytes()

    with Session(engine) as session:
        wo = get_work_order(session, created_work_order)
        subject, text_body, html_body = notifications.render_completion_email_content(
            work_order_number=wo_num,
            filename=filename,
            work_order=wo,
        )

    msg = notifications._build_email_message(
        to_list=["owner@example.com"],
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        pdf_bytes=pdf_data,
        filename=filename,
        logo_bytes=logo_bytes,
    )

    assert msg["Subject"] == subject
    assert "Ready Rentals Online" in msg["From"]
    assert msg["To"] == "owner@example.com"

    # Verify parts
    raw_bytes = msg.as_bytes()
    parsed = message_from_bytes(raw_bytes)
    assert parsed.is_multipart()

    part_types = [p.get_content_type() for p in parsed.walk()]
    assert "text/plain" in part_types
    assert "text/html" in part_types
    assert "application/pdf" in part_types
    if logo_bytes:
        assert "image/png" in part_types


def test_send_completion_email_resolves_owner(engine, created_work_order):
    """Test that send_completion_email sends to the owner's mail account and updates notified timestamp."""
    with Session(engine) as session:
        owner = session.exec(select(User).where(User.role == UserRole.owner)).first()
        if not owner:
            owner = User(
                email="owner_test@readyrentalsonline.com",
                hashed_password="hash",
                name="Test Owner",
                role=UserRole.owner,
            )
            session.add(owner)
            session.commit()
            session.refresh(owner)

        wo = get_work_order(session, created_work_order)
        wo.status = WorkOrderStatus.signed_off
        wo.pdf_url = f"work-orders/{wo.id}/{wo.work_order_number}.pdf"
        session.add(wo)
        session.commit()

        from app.services.storage import get_storage
        storage = get_storage()
        storage.save(b"%PDF-1.4 test data", wo.pdf_url, content_type="application/pdf")

        recipients = send_completion_email(wo.id, engine)
        assert owner.email.lower() in [r.lower() for r in recipients]

        session.expire_all()
        refreshed_wo = get_work_order(session, wo.id)
        assert refreshed_wo.manager_notified_at is not None
        assert refreshed_wo.manager_notify_error is None

        # Check outbound mail directory
        settings = get_settings()
        out_dir = Path(settings.storage_local_dir) / "outbound_mail"
        assert (out_dir / f"{wo.work_order_number}.pdf").exists()
        assert (out_dir / f"{wo.work_order_number}_email.html").exists()
        assert (out_dir / f"{wo.work_order_number}.eml").exists()


def test_send_email_api_endpoint(client, owner_headers, created_work_order, engine):
    """Test POST /work-orders/{id}/send-email endpoint."""
    # Before signing off -> 400 Bad Request
    res = client.post(f"/work-orders/{created_work_order}/send-email", headers=owner_headers)
    assert res.status_code == 400

    # Mark signed off and create PDF in storage
    with Session(engine) as session:
        wo = get_work_order(session, created_work_order)
        wo.status = WorkOrderStatus.signed_off
        wo.pdf_url = f"work-orders/{wo.id}/{wo.work_order_number}.pdf"
        session.add(wo)
        session.commit()

        from app.services.storage import get_storage
        storage = get_storage()
        storage.save(b"%PDF-1.4 test", wo.pdf_url, content_type="application/pdf")

    # Now post send-email
    res = client.post(f"/work-orders/{created_work_order}/send-email", headers=owner_headers)
    assert res.status_code == 200
    assert "Completed report emailed to" in res.json()["detail"]
