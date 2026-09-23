from __future__ import annotations

import base64
import logging
import re
import smtplib
from datetime import date, datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import get_settings

if TYPE_CHECKING:
    from app.models import WorkOrder

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
ASSETS_DIR = TEMPLATES_DIR / "assets"
LOGO_PNG_PATH = ASSETS_DIR / "ready_rentals_logo.png"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _fmt_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    local_val = value.astimezone()
    tz_name = local_val.strftime("%Z") or "Local"
    return f"{local_val.strftime('%b')} {local_val.day}, {local_val.year} {local_val.strftime('%I:%M %p')} {tz_name}"


def _fmt_date(value: date | None) -> str:
    if value is None:
        return ""
    return f"{value.strftime('%b')} {value.day}, {value.year}"


def _clean_phone(phone: str | None) -> str:
    if not phone:
        return ""
    return re.sub(r"[^\d+]", "", phone)


def _load_logo_bytes() -> bytes | None:
    if LOGO_PNG_PATH.exists():
        try:
            return LOGO_PNG_PATH.read_bytes()
        except Exception:
            logger.warning("Could not read logo bytes from %s", LOGO_PNG_PATH)
    return None


def send_worker_link(phone: str, share_url: str, work_order_number: str) -> None:
    """Text (or log) the single-use-token technician link."""
    body = (
        f"Ready Rentals Online work order {work_order_number} assigned to you. "
        f"Open this link to start the job: {share_url}"
    )
    settings = get_settings()
    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number:
        try:
            httpx.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                data={
                    "From": settings.twilio_from_number,
                    "To": phone,
                    "Body": body,
                },
                timeout=20,
            ).raise_for_status()
            return
        except Exception:
            logger.exception("Twilio SMS failed for %s", phone)
    logger.info("TECHNICIAN LINK to %s for %s: %s",
                phone, work_order_number, share_url)


def render_completion_email_content(
    work_order_number: str,
    filename: str,
    work_order: WorkOrder | None = None,
) -> tuple[str, str, str]:
    """Render subject, plain text body, and responsive HTML body for completion email."""
    settings = get_settings()
    subject = f"Ready Rentals Online | Maintenance Work Order #{work_order_number} Completed & Signed"

    items_list: list[dict[str, Any]] = []
    service_address = "Property on Record"
    tenant_names = "Resident"
    assigned_to_name = "Service Technician"
    assigned_to_phone = None
    priority_name = "Standard"
    date_assigned_str = None
    service_date_str = None
    duration_minutes = None
    inspection_status = None
    tenant_sig_name = None
    tenant_sig_at = None
    tech_sig_name = None
    tech_sig_at = None

    if work_order:
        service_address = work_order.service_address or service_address
        tenant_names = work_order.tenant_names or tenant_names
        assigned_to_name = work_order.assigned_to_name or assigned_to_name
        assigned_to_phone = work_order.assigned_to_phone
        if work_order.priority:
            priority_name = work_order.priority.name
        date_assigned_str = _fmt_date(work_order.date_assigned)
        service_date_str = _fmt_date(work_order.service_date) if work_order.service_date else date_assigned_str
        if work_order.start_time and work_order.end_time:
            from app.schemas import duration_minutes_between
            duration_minutes = duration_minutes_between(work_order.start_time, work_order.end_time)
        if work_order.entire_unit_inspected is True:
            inspection_status = "Yes, Full Property Inspected"
        elif work_order.entire_unit_inspected is False:
            inspection_status = "No"
        tenant_sig_name = work_order.tenant_signature_name
        tenant_sig_at = _fmt_dt(work_order.tenant_signature_at)
        tech_sig_name = work_order.tech_signature_name
        tech_sig_at = _fmt_dt(work_order.tech_signature_at)

        for item in sorted(work_order.items, key=lambda i: i.sort_order):
            items_list.append({
                "category": item.category,
                "details": item.details or "",
                "tech_notes": item.tech_notes or "",
                "resolved": item.resolved,
            })

    ctx = {
        "work_order_number": work_order_number,
        "filename": filename,
        "service_address": service_address,
        "tenant_names": tenant_names,
        "assigned_to_name": assigned_to_name,
        "assigned_to_phone": assigned_to_phone,
        "priority_name": priority_name,
        "date_assigned": date_assigned_str,
        "service_date": service_date_str,
        "duration_minutes": duration_minutes,
        "inspection_status": inspection_status,
        "tenant_signature_name": tenant_sig_name,
        "tenant_signed_at": tenant_sig_at,
        "tech_signature_name": tech_sig_name,
        "tech_signed_at": tech_sig_at,
        "items": items_list,
        "logo_cid": "readyrentals_logo",
        "logo_url": f"{settings.public_base_url.rstrip('/')}/files/ready_rentals_logo.png",
        "company_name": settings.company_name,
        "company_phone": settings.company_phone,
        "company_phone_digits": _clean_phone(settings.company_phone),
        "company_email": settings.company_email,
        "company_website": settings.company_website,
    }

    html_template = _env.get_template("completed_email.html")
    text_template = _env.get_template("completed_email.txt")

    html_body = html_template.render(ctx)
    text_body = text_template.render(ctx)

    return subject, text_body, html_body


def send_completed_pdf(
    to_email: str | list[str],
    work_order_number: str,
    pdf_bytes: bytes,
    filename: str | None = None,
    work_order: WorkOrder | None = None,
) -> None:
    """Send completed work order PDF report with branded Ready Rentals Online email."""
    settings = get_settings()
    filename = filename or f"{work_order_number}.pdf"
    
    if isinstance(to_email, str):
        to_list = [e.strip() for e in to_email.split(",") if e.strip()]
    else:
        to_list = [e.strip() for e in to_email if e.strip()]

    if not to_list:
        logger.warning("No recipient email specified for work order %s", work_order_number)
        return

    subject, text_body, html_body = render_completion_email_content(
        work_order_number=work_order_number,
        filename=filename,
        work_order=work_order,
    )
    logo_bytes = _load_logo_bytes()

    backend = settings.email_backend
    if backend == "sendgrid" or settings.sendgrid_api_key:
        _send_sendgrid(to_list, subject, text_body, html_body, pdf_bytes, filename, logo_bytes)
        return
    if backend == "smtp":
        _send_smtp(to_list, subject, text_body, html_body, pdf_bytes, filename, logo_bytes)
        return

    _send_log(to_list, subject, text_body, html_body, pdf_bytes, filename, logo_bytes)


def _build_email_message(
    to_list: list[str],
    subject: str,
    text_body: str,
    html_body: str,
    pdf_bytes: bytes,
    filename: str,
    logo_bytes: bytes | None,
) -> EmailMessage:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from}>"
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = subject

    # Plain-text alternative fallback
    msg.set_content(text_body)

    # HTML alternative
    msg.add_alternative(html_body, subtype="html")

    # Embed Ready Rentals Online Logo inline via CID for email footer
    if logo_bytes:
        try:
            html_part = msg.get_payload()[1]
            html_part.add_related(
                logo_bytes,
                maintype="image",
                subtype="png",
                cid="<readyrentals_logo>",
                filename="ready_rentals_logo.png",
            )
        except Exception:
            logger.exception("Failed to attach inline logo to email")

    # Attach the signed PDF report
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=filename,
    )
    return msg


def _send_smtp(
    to_list: list[str],
    subject: str,
    text_body: str,
    html_body: str,
    pdf_bytes: bytes,
    filename: str,
    logo_bytes: bytes | None,
) -> None:
    settings = get_settings()
    msg = _build_email_message(to_list, subject, text_body, html_body, pdf_bytes, filename, logo_bytes)

    is_ssl = settings.smtp_ssl or settings.smtp_port == 465
    if is_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    logger.info("EMAIL (smtp) sent to %s | Subject: %s", to_list, subject)


def _send_sendgrid(
    to_list: list[str],
    subject: str,
    text_body: str,
    html_body: str,
    pdf_bytes: bytes,
    filename: str,
    logo_bytes: bytes | None,
) -> None:
    settings = get_settings()
    attachments: list[dict[str, str]] = [
        {
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "type": "application/pdf",
            "filename": filename,
            "disposition": "attachment",
        }
    ]
    if logo_bytes:
        attachments.append({
            "content": base64.b64encode(logo_bytes).decode("ascii"),
            "type": "image/png",
            "filename": "ready_rentals_logo.png",
            "disposition": "inline",
            "content_id": "readyrentals_logo",
        })

    payload = {
        "personalizations": [{"to": [{"email": email} for email in to_list]}],
        "from": {"email": settings.mail_from, "name": settings.mail_from_name},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": text_body},
            {"type": "text/html", "value": html_body},
        ],
        "attachments": attachments,
    }
    response = httpx.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    logger.info("EMAIL (sendgrid) sent to %s | Subject: %s", to_list, subject)


def _send_log(
    to_list: list[str],
    subject: str,
    text_body: str,
    html_body: str,
    pdf_bytes: bytes,
    filename: str,
    logo_bytes: bytes | None,
) -> None:
    settings = get_settings()
    out = Path(settings.storage_local_dir) / "outbound_mail"
    out.mkdir(parents=True, exist_ok=True)
    
    # Save PDF
    (out / filename).write_bytes(pdf_bytes)

    # Save rendered HTML email for inspection
    base_name = Path(filename).stem
    (out / f"{base_name}_email.html").write_text(html_body, encoding="utf-8")

    # Save full .eml message for client inspection
    msg = _build_email_message(to_list, subject, text_body, html_body, pdf_bytes, filename, logo_bytes)
    (out / f"{base_name}.eml").write_bytes(msg.as_bytes())

    logger.info(
        "EMAIL (log) to %s | Subject: '%s' | Attachment: %s (%d bytes) | Saved to %s",
        to_list,
        subject,
        filename,
        len(pdf_bytes),
        out,
    )
