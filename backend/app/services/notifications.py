from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_worker_link(phone: str, share_url: str, work_order_number: str) -> None:
    """Text (or log) the single-use-token technician link."""
    body = (
        f"ReadyRentalsOnline work order {work_order_number} assigned to you. "
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


def send_completed_pdf(
    to_email: str,
    work_order_number: str,
    pdf_bytes: bytes,
    filename: str | None = None,
) -> None:
    settings = get_settings()
    filename = filename or f"{work_order_number}.pdf"
    subject = f"ReadyRentalsOnline | Work order {work_order_number} completed"
    text = (
        f"Your ReadyRentalsOnline work order {work_order_number} has been signed by the resident and technician. "
        "The completed maintenance report is attached."
    )
    backend = settings.email_backend
    if backend == "sendgrid" or settings.sendgrid_api_key:
        _send_sendgrid(to_email, subject, text, pdf_bytes, filename)
        return
    if backend == "smtp":
        _send_smtp(to_email, subject, text, pdf_bytes, filename)
        return
    out = Path(settings.storage_local_dir) / "outbound_mail"
    out.mkdir(parents=True, exist_ok=True)
    (out / filename).write_bytes(pdf_bytes)
    logger.info("EMAIL (log) to %s subject=%s attachment=%s",
                to_email, subject, filename)


def _send_smtp(
    to_email: str, subject: str, text: str, pdf_bytes: bytes, filename: str
) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_attachment(pdf_bytes, maintype="application",
                       subtype="pdf", filename=filename)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def _send_sendgrid(
    to_email: str, subject: str, text: str, pdf_bytes: bytes, filename: str
) -> None:
    import base64

    settings = get_settings()
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": settings.mail_from, "name": settings.mail_from_name},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text}],
        "attachments": [
            {
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "type": "application/pdf",
                "filename": filename,
                "disposition": "attachment",
            }
        ],
    }
    response = httpx.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
