"""Work-order domain logic: lifecycle, computed SLA fields, token links."""

from __future__ import annotations

import secrets
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.config import get_settings
from app.models import (
    ChecklistCategory,
    Priority,
    User,
    UserRole,
    WorkOrder,
    WorkOrderItem,
    WorkOrderStatus,
)
from app.time_utils import utcnow
from app.schemas import (
    CompleteWorkOrderRequest,
    SaveProgressRequest,
    WorkOrderCreate,
    WorkOrderItemCreate,
    WorkOrderRead,
    WorkOrderUpdate,
    WorkerWorkOrderRead,
    duration_minutes_between,
)
from app.services import notifications
from app.services.pdf import generate_pdf
from app.services.storage import Storage, get_storage, unique_key

logger = logging.getLogger(__name__)


class DomainError(HTTPException):
    def __init__(self, detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=code, detail=detail)


def worker_share_url(token: str) -> str:
    settings = get_settings()
    base = (settings.frontend_base_url or settings.public_base_url).strip().rstrip('/')
    return f"{base}/wo/{token}"


def _load_priority(session: Session, code: str) -> Priority:
    priority = session.exec(select(Priority).where(
        Priority.code == code.lower())).first()
    if priority is None:
        raise DomainError(f"Unknown priority '{code}'")
    return priority


def _assert_category(session: Session, name: str) -> None:
    found = session.exec(
        select(ChecklistCategory).where(
            ChecklistCategory.name == name,
            ChecklistCategory.is_active,
        )
    ).first()
    if found is None:
        raise DomainError(f"Unknown checklist category '{name}'")


def next_work_order_number(session: Session) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"WO-{today}-"
    latest = session.exec(
        select(WorkOrder.work_order_number)
        .where(col(WorkOrder.work_order_number).like(f"{prefix}%"))
        .order_by(col(WorkOrder.work_order_number).desc())
    ).first()
    seq = 1
    if latest:
        try:
            seq = int(latest.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def to_read(wo: WorkOrder) -> WorkOrderRead:
    data = WorkOrderRead.model_validate(wo)
    if wo.created_by:
        data.created_by_name = wo.created_by.name
        data.created_by_email = wo.created_by.email
    storage = get_storage()
    for item in data.items:
        if item.before_photo_url:
            item.before_photo_url = storage.download_url(item.before_photo_url)
        if item.after_photo_url:
            item.after_photo_url = storage.download_url(item.after_photo_url)
    for field in ("tenant_signature_url", "tech_signature_url", "pdf_url"):
        value = getattr(data, field)
        if value:
            setattr(data, field, storage.download_url(value))
    data.worker_share_url = worker_share_url(wo.worker_access_token)
    return data


def to_create_response(wo: WorkOrder):
    from app.schemas import WorkOrderCreateResponse

    read_data = to_read(wo)
    payload = read_data.model_dump(
        exclude={"duration_minutes", "within_target"}
    )
    payload["worker_access_token"] = wo.worker_access_token
    payload["worker_share_url"] = worker_share_url(wo.worker_access_token)
    return WorkOrderCreateResponse.model_validate(payload)


def get_work_order(session: Session, work_order_id: int) -> WorkOrder:
    wo = session.exec(
        select(WorkOrder)
        .options(selectinload(WorkOrder.items), selectinload(WorkOrder.priority), selectinload(WorkOrder.created_by))
        .where(WorkOrder.id == work_order_id)
    ).first()
    if wo is None:
        raise DomainError("Work order not found", status.HTTP_404_NOT_FOUND)
    return wo


def get_by_token(session: Session, token: str) -> WorkOrder:
    wo = session.exec(
        select(WorkOrder)
        .options(selectinload(WorkOrder.items), selectinload(WorkOrder.priority), selectinload(WorkOrder.created_by))
        .where(WorkOrder.worker_access_token == token)
    ).first()
    if wo is None:
        raise DomainError("Work order not found", status.HTTP_404_NOT_FOUND)
    return wo


def worker_view(wo: WorkOrder) -> WorkerWorkOrderRead:
    """Return only fields appropriate for the current status."""
    duration = duration_minutes_between(wo.start_time, wo.end_time)
    storage = get_storage()
    items = []
    for item in wo.items:
        item_data = item.model_dump()
        for field in ("before_photo_url", "after_photo_url"):
            if item_data.get(field):
                item_data[field] = storage.download_url(item_data[field])
        items.append(item_data)

    base = {
        "work_order_number": wo.work_order_number,
        "status": wo.status,
        "assigned_to_name": wo.assigned_to_name,
        "date_assigned": wo.date_assigned,
        "service_address": wo.service_address,
        "tenant_names": wo.tenant_names,
        "tenant_phone": wo.tenant_phone,
        "priority": wo.priority,
        "service_date": wo.service_date,
        "items": items,
        "tenant_disclaimer": (
            "Tenant confirms to be satisfied with repairs and does not know of any "
            "outstanding hazardous conditions."
        ),
    }
    if wo.status == WorkOrderStatus.assigned:
        return WorkerWorkOrderRead.model_validate(base)

    base["start_time"] = wo.start_time
    if wo.status == WorkOrderStatus.in_progress:
        base["entire_unit_inspected"] = wo.entire_unit_inspected
        base["inspection_results"] = wo.inspection_results
        return WorkerWorkOrderRead.model_validate(base)

    base.update(
        {
            "end_time": wo.end_time,
            "duration_minutes": duration,
            "within_target": (
                None
                if duration is None or not wo.priority
                else duration <= wo.priority.hour_target * 60
            ),
            "if_incomplete_explanation": wo.if_incomplete_explanation,
            "entire_unit_inspected": wo.entire_unit_inspected,
            "inspection_results": wo.inspection_results,
            "tenant_signature_name": wo.tenant_signature_name,
            "tenant_signature_at": wo.tenant_signature_at,
            "tenant_signature_url": (
                storage.download_url(wo.tenant_signature_url)
                if wo.tenant_signature_url else None
            ),
            "tenant_signed": bool(wo.tenant_signature_url),
            "tech_signature_name": wo.tech_signature_name,
            "tech_signature_at": wo.tech_signature_at,
            "tech_signature_url": (
                storage.download_url(wo.tech_signature_url)
                if wo.tech_signature_url else None
            ),
            "tech_signed": bool(wo.tech_signature_url),
        }
    )
    if wo.status == WorkOrderStatus.signed_off:
        base["pdf_url"] = storage.download_url(
            wo.pdf_url) if wo.pdf_url else None
    return WorkerWorkOrderRead.model_validate(base)


def create_work_order(session: Session, payload: WorkOrderCreate, user: User) -> WorkOrder:
    priority = _load_priority(session, payload.priority)
    for item in payload.items:
        _assert_category(session, item.category)

    last_error: Exception | None = None
    for _ in range(25):
        wo = WorkOrder(
            work_order_number=next_work_order_number(session),
            created_by_user_id=user.id,
            assigned_to_name=payload.assigned_to_name,
            assigned_to_phone=payload.assigned_to_phone,
            date_assigned=payload.date_assigned,
            service_address=payload.service_address,
            tenant_names=payload.tenant_names,
            tenant_phone=payload.tenant_phone,
            priority_id=priority.id,
            status=WorkOrderStatus.assigned,
            service_date=payload.service_date,
            worker_access_token=secrets.token_urlsafe(32),
        )
        session.add(wo)
        session.flush()
        for idx, item in enumerate(payload.items, start=1):
            session.add(
                WorkOrderItem(
                    work_order_id=wo.id,
                    category=item.category,
                    details=item.details,
                    resolved=item.resolved,
                    sort_order=idx,
                )
            )
        try:
            session.commit()
            break
        except IntegrityError:
            last_error = IntegrityError(
                "work_order_number collision", None, None)
            session.rollback()
    else:
        raise DomainError(
            "Could not create a unique work order number, please retry")

    return get_work_order(session, wo.id)


def send_initial_worker_notification(work_order_id: int, bind: object) -> None:
    """Deliver the technician link after the create response has been sent."""
    with Session(bind) as session:
        wo = get_work_order(session, work_order_id)
        try:
            notifications.send_worker_link(
                wo.assigned_to_phone,
                worker_share_url(wo.worker_access_token),
                wo.work_order_number,
            )
            wo.worker_notified_at = utcnow()
            wo.worker_notify_error = None
        except Exception as exc:
            logger.exception("Failed to notify worker for %s", wo.work_order_number)
            wo.worker_notified_at = None
            wo.worker_notify_error = str(exc)
        session.add(wo)
        session.commit()


def replace_items(session: Session, wo: WorkOrder, items: list[WorkOrderItemCreate]) -> None:
    for existing in list(wo.items):
        session.delete(existing)
    session.flush()
    for idx, item in enumerate(items, start=1):
        _assert_category(session, item.category)
        session.add(
            WorkOrderItem(
                work_order_id=wo.id,
                category=item.category,
                details=item.details,
                resolved=item.resolved,
                sort_order=idx,
            )
        )


def update_work_order(session: Session, wo: WorkOrder, payload: WorkOrderUpdate) -> WorkOrder:
    raise DomainError(
        "Work orders are locked after creation and cannot be edited.",
        status.HTTP_409_CONFLICT,
    )


def delete_work_order(session: Session, wo: WorkOrder, user: Optional[User] = None) -> None:
    is_owner = user is not None and user.role == UserRole.owner
    if wo.status == WorkOrderStatus.signed_off and not is_owner:
        raise DomainError(
            "Completed work orders cannot be deleted",
            status.HTTP_409_CONFLICT,
        )
    storage = get_storage()
    prefix = f"work-orders/{wo.id}/"
    try:
        storage.delete_prefix(prefix)
    except Exception as exc:
        logger.exception(
            "Work order %s delete aborted because file cleanup failed", wo.id)
        if not is_owner:
            raise DomainError(
                "Work order delete aborted because attached files could not be cleaned up",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc
    try:
        session.delete(wo)
        session.commit()
    except Exception:
        session.rollback()
        raise


def list_work_orders(
    session: Session,
    *,
    status_filter: Optional[WorkOrderStatus] = None,
    overdue: Optional[bool] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    address: Optional[str] = None,
    assigned_by_id: Optional[int] = None,
) -> list[WorkOrder]:
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.items),
            selectinload(WorkOrder.priority),
            selectinload(WorkOrder.created_by),
        )
        .order_by(col(WorkOrder.created_at).desc())
    )
    if status_filter:
        stmt = stmt.where(WorkOrder.status == status_filter)
    if date_from:
        stmt = stmt.where(WorkOrder.date_assigned >= date_from)
    if date_to:
        stmt = stmt.where(WorkOrder.date_assigned <= date_to)
    if address:
        stmt = stmt.where(col(WorkOrder.service_address).ilike(f"%{address}%"))
    if assigned_by_id is not None:
        stmt = stmt.where(WorkOrder.created_by_user_id == assigned_by_id)
    rows = list(session.exec(stmt).unique().all())
    if overdue is None:
        return rows
    now = datetime.now(timezone.utc)
    filtered: list[WorkOrder] = []
    for wo in rows:
        is_overdue = _is_overdue(wo, now)
        if overdue and is_overdue:
            filtered.append(wo)
        elif not overdue and not is_overdue:
            filtered.append(wo)
    return filtered


def _is_overdue(wo: WorkOrder, now: datetime) -> bool:
    if wo.status in {WorkOrderStatus.signed_off, WorkOrderStatus.completed_pending_signoff}:
        return False
    if not wo.priority:
        return False
    assigned_dt = datetime.combine(
        wo.date_assigned, datetime.min.time(), tzinfo=timezone.utc)
    deadline = assigned_dt + timedelta(hours=wo.priority.hour_target)
    return now > deadline


def assert_not_locked(wo: WorkOrder) -> None:
    if wo.status == WorkOrderStatus.signed_off:
        raise DomainError("Work order is completed and locked for writes")


def start_work_order(session: Session, wo: WorkOrder) -> WorkOrder:
    if wo.status != WorkOrderStatus.assigned:
        raise DomainError(
            "Work order can only be started once from status 'assigned'")
    wo.start_time = utcnow()
    wo.status = WorkOrderStatus.in_progress
    wo.updated_at = utcnow()
    session.add(wo)
    session.commit()
    return get_work_order(session, wo.id)


def update_item(
    session: Session,
    wo: WorkOrder,
    item_id: int,
    *,
    tech_notes: Optional[str] = None,
    resolved: Optional[bool] = None,
    category: Optional[str] = None,
    before_photo_skipped: Optional[bool] = None,
    after_photo_skipped: Optional[bool] = None,
) -> WorkOrderItem:
    assert_not_locked(wo)
    if wo.status != WorkOrderStatus.in_progress:
        raise DomainError("Items can only be updated after the job is started")
    item = next((i for i in wo.items if i.id == item_id), None)
    if item is None:
        raise DomainError("Item not found", status.HTTP_404_NOT_FOUND)
    if category is not None:
        _assert_category(session, category)
        item.category = category
    if tech_notes is not None:
        item.tech_notes = tech_notes
    if resolved is not None:
        item.resolved = resolved
    if before_photo_skipped is not None:
        item.before_photo_skipped = before_photo_skipped
    if after_photo_skipped is not None:
        item.after_photo_skipped = after_photo_skipped
    wo.updated_at = utcnow()
    session.add(item)
    session.add(wo)
    session.commit()
    session.refresh(item)
    return item


def attach_photo(
    session: Session,
    wo: WorkOrder,
    item_id: int,
    slot: str,
    data: bytes,
    filename: str,
    content_type: str | None,
    storage: Storage | None = None,
) -> WorkOrderItem:
    assert_not_locked(wo)
    if wo.status != WorkOrderStatus.in_progress:
        raise DomainError(
            "Photos can only be uploaded after the job is started")
    if slot not in {"before", "after"}:
        raise DomainError("slot must be 'before' or 'after'")
    item = next((i for i in wo.items if i.id == item_id), None)
    if item is None:
        raise DomainError("Item not found", status.HTTP_404_NOT_FOUND)
    storage = storage or get_storage()
    key = unique_key(f"work-orders/{wo.id}/items/{item.id}/{slot}", filename)
    url = storage.save(data, key, content_type=content_type)
    if slot == "before":
        item.before_photo_url = url
        item.before_photo_skipped = False
    else:
        item.after_photo_url = url
        item.after_photo_skipped = False
    wo.updated_at = utcnow()
    session.add(item)
    session.add(wo)
    try:
        session.commit()
    except Exception:
        session.rollback()
        try:
            storage.delete(url)
        except Exception:
            logger.exception("Failed to clean up uploaded photo %s", url)
        raise
    session.refresh(item)
    return item


def _photo_slot_ok(item: WorkOrderItem, slot: str) -> bool:
    if slot == "before":
        return bool(item.before_photo_url) or item.before_photo_skipped
    return bool(item.after_photo_url) or item.after_photo_skipped


def save_progress(session: Session, wo: WorkOrder, payload: SaveProgressRequest) -> WorkOrder:
    """Persist in-progress inspection answers without finishing the job."""
    assert_not_locked(wo)
    if wo.status != WorkOrderStatus.in_progress:
        raise DomainError("Progress can only be saved while the job is in progress")
    if payload.entire_unit_inspected is not None:
        wo.entire_unit_inspected = payload.entire_unit_inspected
    if payload.inspection_results is not None:
        wo.inspection_results = payload.inspection_results
    wo.updated_at = utcnow()
    session.add(wo)
    session.commit()
    return get_work_order(session, wo.id)


def complete_work_order(
    session: Session, wo: WorkOrder, payload: CompleteWorkOrderRequest
) -> WorkOrder:
    assert_not_locked(wo)
    if wo.status != WorkOrderStatus.in_progress:
        raise DomainError(
            "Work order must be in progress before it can be completed")
    if wo.start_time is None:
        raise DomainError("Cannot complete before start")
    unresolved = [item.category for item in wo.items if not item.resolved]
    if unresolved:
        raise DomainError(
            "Every task must be marked resolved before signatures. "
            "Use Save for later if you still need to return."
        )
    missing_photos = [
        item.category
        for item in wo.items
        if not _photo_slot_ok(item, "before") or not _photo_slot_ok(item, "after")
    ]
    if missing_photos:
        raise DomainError(
            "Each task needs a before and after photo, or No picture selected."
        )
    if payload.entire_unit_inspected is None:
        raise DomainError("Answer whether you inspected the entire property.")
    results = (payload.inspection_results or "").strip()
    if not results:
        raise DomainError("Write the inspection results before finishing the job.")
    wo.end_time = utcnow()
    wo.if_incomplete_explanation = payload.if_incomplete_explanation
    wo.entire_unit_inspected = payload.entire_unit_inspected
    wo.inspection_results = results
    wo.status = WorkOrderStatus.completed_pending_signoff
    wo.updated_at = utcnow()
    session.add(wo)
    session.commit()
    return get_work_order(session, wo.id)


def _decode_png(raw: str) -> bytes:
    payload = raw.strip()
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]
    try:
        data = base64_decode(payload)
    except Exception as exc:
        raise DomainError("Invalid signature image") from exc
    if len(data) < 8:
        raise DomainError("Invalid signature image")
    return data


def base64_decode(payload: str) -> bytes:
    import base64

    return base64.b64decode(payload, validate=False)


def sign_work_order(
    session: Session,
    wo: WorkOrder,
    signer: str,
    name: str,
    signature_png_base64: str,
    storage: Storage | None = None,
) -> WorkOrder:
    assert_not_locked(wo)
    if wo.status != WorkOrderStatus.completed_pending_signoff:
        raise DomainError(
            "Signatures are only accepted after work is complete"
        )
    if signer not in {"tenant", "tech"}:
        raise DomainError("signer must be 'tenant' or 'tech'")
    if signer == "tenant" and wo.tenant_signature_url:
        raise DomainError("Tenant has already signed")
    if signer == "tech":
        if not wo.tenant_signature_url:
            raise DomainError("Tenant must sign before technician")
        if wo.tech_signature_url:
            raise DomainError("Technician has already signed")
    storage = storage or get_storage()
    png = _decode_png(signature_png_base64)
    key = unique_key(
        f"work-orders/{wo.id}/signatures/{signer}", f"{signer}.png")
    url = storage.save(png, key, content_type="image/png")
    now = utcnow()
    if signer == "tenant":
        wo.tenant_signature_url = url
        wo.tenant_signature_name = name
        wo.tenant_signature_at = now
    else:
        wo.tech_signature_url = url
        wo.tech_signature_name = name
        wo.tech_signature_at = now
    wo.updated_at = now
    session.add(wo)
    finalized_pdf: bytes | None = None
    finalized_pdf_url: str | None = None
    try:
        if wo.tenant_signature_url and wo.tech_signature_url:
            finalized_pdf, finalized_pdf_url = _finalize_signoff(
                session, wo, storage)
        session.commit()
    except Exception as exc:
        session.rollback()
        for stored_url in (url, finalized_pdf_url):
            if stored_url:
                try:
                    storage.delete(stored_url)
                except Exception:
                    logger.exception(
                        "Failed to clean up storage object %s", stored_url)
        raise DomainError(
            "Work order signature or PDF could not be saved atomically",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from exc
    wo = get_work_order(session, wo.id)
    return wo


def send_completion_email(
    work_order_id: int,
    bind: object,
    target_email: str | None = None,
) -> list[str]:
    """Email the completed report to the owner(s) and manager after sign-off has been committed."""
    with Session(bind) as session:
        wo = get_work_order(session, work_order_id)
        if not wo.pdf_url:
            logger.warning("Work order %s has no finalized PDF to email", wo.work_order_number)
            return []

        settings = get_settings()
        recipients: list[str] = []

        if target_email and target_email.strip():
            recipients.append(target_email.strip().lower())
        else:
            # 1. Look for all users with owner role in the database
            db_owners = session.exec(select(User).where(User.role == UserRole.owner)).all()
            for owner in db_owners:
                if owner.email and owner.email.strip():
                    recipients.append(owner.email.strip().lower())

            # 2. Look for owner_email in application settings / env
            if settings.owner_email and settings.owner_email.strip():
                recipients.append(settings.owner_email.strip().lower())

            # 3. Include the manager/creator of the work order if different
            if wo.created_by and wo.created_by.email and wo.created_by.email.strip():
                recipients.append(wo.created_by.email.strip().lower())

        # Deduplicate while preserving order
        unique_recipients = list(dict.fromkeys([r for r in recipients if r]))

        if not unique_recipients:
            logger.warning(
                "No recipient email found for completed work order %s",
                wo.work_order_number,
            )
            wo.manager_notify_error = "No recipient email found for owner or manager"
            session.add(wo)
            session.commit()
            return []

        try:
            pdf_data = pdf_bytes(wo)
            notifications.send_completed_pdf(
                to_email=unique_recipients,
                work_order_number=wo.work_order_number,
                pdf_bytes=pdf_data,
                work_order=wo,
            )
            wo.manager_notified_at = utcnow()
            wo.manager_notify_error = None
            session.add(wo)
            session.commit()
            logger.info(
                "Successfully emailed completed work order %s report to %s",
                wo.work_order_number,
                unique_recipients,
            )
            return unique_recipients
        except Exception as exc:
            wo.manager_notify_error = str(exc)
            session.add(wo)
            session.commit()
            logger.exception(
                "Failed to email completed PDF for %s to %s",
                wo.work_order_number,
                unique_recipients,
            )
            raise


def _finalize_signoff(
    session: Session, wo: WorkOrder, storage: Storage
) -> tuple[bytes, str]:
    wo.status = WorkOrderStatus.signed_off
    pdf_bytes = generate_pdf(wo, storage=storage)
    key = unique_key(f"work-orders/{wo.id}", f"{wo.work_order_number}.pdf")
    wo.pdf_url = storage.save(pdf_bytes, key, content_type="application/pdf")
    wo.updated_at = utcnow()
    session.add(wo)
    assert wo.pdf_url is not None
    return pdf_bytes, wo.pdf_url


def pdf_bytes(wo: WorkOrder, storage: Storage | None = None) -> bytes:
    if wo.status != WorkOrderStatus.signed_off or not wo.pdf_url:
        raise DomainError(
            "PDF is available after both signatures", status.HTTP_409_CONFLICT)
    storage = storage or get_storage()
    if not storage.exists(wo.pdf_url):
        raise DomainError("PDF file not found", status.HTTP_404_NOT_FOUND)
    return storage.read_bytes(wo.pdf_url)


def resend_worker_link(wo: WorkOrder) -> str:
    url = worker_share_url(wo.worker_access_token)
    try:
        notifications.send_worker_link(
            wo.assigned_to_phone, url, wo.work_order_number)
        wo.worker_notified_at = utcnow()
        wo.worker_notify_error = None
    except Exception as exc:
        wo.worker_notify_error = str(exc)
        raise
    return url


def regenerate_worker_link(session: Session, wo: WorkOrder) -> WorkOrder:
    if wo.status == WorkOrderStatus.signed_off:
        raise DomainError(
            "Cannot regenerate a link on a signed-off work order",
            status.HTTP_409_CONFLICT,
        )
    old_token = wo.worker_access_token
    wo.worker_access_token = secrets.token_urlsafe(32)
    wo.updated_at = utcnow()
    session.add(wo)
    session.commit()
    return get_work_order(session, wo.id)
