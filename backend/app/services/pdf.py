from __future__ import annotations

import base64
import logging
from datetime import date, datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import get_settings
from app.models import WorkOrder
from app.services.storage import Storage, get_storage

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
ASSETS_DIR = TEMPLATES_DIR / "assets"
LOGO_PNG_PATH = ASSETS_DIR / "ready_rentals_logo.png"

TENANT_DISCLAIMER = (
    "Tenant confirms to be satisfied with repairs and does not know of any "
    "outstanding hazardous conditions."
)

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def get_logo_data_uri() -> str:
    if LOGO_PNG_PATH.exists():
        try:
            b64 = base64.b64encode(LOGO_PNG_PATH.read_bytes()).decode("ascii")
            return f"data:image/png;base64,{b64}"
        except Exception:
            logger.warning("Could not read logo at %s", LOGO_PNG_PATH)
    return ""


def _data_uri(storage: Storage, url: str | None) -> str | None:
    if not url:
        return None
    try:
        data = storage.read_bytes(url)
    except Exception:
        logger.warning("Could not embed image %s", url)
        return None
    b64 = base64.b64encode(data).decode("ascii")
    mime = "image/png"
    lower = url.lower()
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        mime = "image/jpeg"
    elif lower.endswith(".gif"):
        mime = "image/gif"
    elif lower.endswith(".webp"):
        mime = "image/webp"
    return f"data:{mime};base64,{b64}"


def _as_local(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone()


def _fmt_dt(value: datetime | None) -> str:
    value = _as_local(value)
    if value is None:
        return ""
    tz_name = value.strftime('%Z') or 'Local'
    return f"{value.strftime('%b')} {value.day}, {value.year} {value.strftime('%I:%M %p')} {tz_name}"


def _fmt_time(value: datetime | None) -> str:
    value = _as_local(value)
    if value is None:
        return ""
    tz_name = value.strftime('%Z') or 'Local'
    return f"{value.strftime('%I:%M %p').lstrip('0')} {tz_name}"


def _fmt_date(value: date | None) -> str:
    if value is None:
        return ""
    return f"{value.strftime('%b')} {value.day}, {value.year}"


def render_html(work_order: WorkOrder, storage: Storage | None = None) -> str:
    storage = storage or get_storage()
    template = _env.get_template("work_order.html")
    items = []
    for item in sorted(work_order.items, key=lambda i: i.sort_order):
        items.append(
            {
                "sort_order": item.sort_order,
                "category": item.category,
                "details": item.details,
                "tech_notes": item.tech_notes,
                "resolved": "Y" if item.resolved else "N",
                "before_photo": _data_uri(storage, item.before_photo_url),
                "after_photo": _data_uri(storage, item.after_photo_url),
                "before_skipped": item.before_photo_skipped,
                "after_skipped": item.after_photo_skipped,
            }
        )
    priority = work_order.priority
    duration = None
    within = None
    if work_order.start_time and work_order.end_time:
        from app.schemas import duration_minutes_between

        duration = duration_minutes_between(
            work_order.start_time, work_order.end_time)
        if priority and duration is not None:
            within = duration <= priority.hour_target * 60
    settings = get_settings()
    return template.render(
        wo=work_order,
        items=items,
        logo_uri=get_logo_data_uri(),
        company_name=settings.company_name,
        company_phone=settings.company_phone,
        company_email=settings.company_email,
        company_website=settings.company_website,
        priority_name=priority.name if priority else "",
        priority_hours=priority.hour_target if priority else "",
        date_assigned=_fmt_date(work_order.date_assigned),
        created_at=_fmt_dt(work_order.created_at),
        updated_at=_fmt_dt(work_order.updated_at),
        start_time=_fmt_time(work_order.start_time),
        end_time=_fmt_time(work_order.end_time),
        duration_minutes=duration,
        within_target=within,
        tenant_signature=_data_uri(storage, work_order.tenant_signature_url),
        tech_signature=_data_uri(storage, work_order.tech_signature_url),
        tenant_signed_at=_fmt_dt(work_order.tenant_signature_at),
        tech_signed_at=_fmt_dt(work_order.tech_signature_at),
        disclaimer=TENANT_DISCLAIMER,
        inspected="Y" if work_order.entire_unit_inspected else (
            "N" if work_order.entire_unit_inspected is False else ""
        ),
    )


def generate_pdf(work_order: WorkOrder, storage: Storage | None = None) -> bytes:
    html = render_html(work_order, storage=storage)
    from weasyprint import HTML

    return HTML(string=html, base_url=str(TEMPLATES_DIR)).write_pdf()
