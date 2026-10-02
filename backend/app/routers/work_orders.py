import json
from datetime import date
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from pydantic import ValidationError
from sqlmodel import Session

from app.config import get_settings
from app.db import get_session
from app.models import User, WorkOrderStatus
from app.schemas import (
    MessageResponse,
    RecycleBinListResponse,
    WorkOrderCreate,
    WorkOrderCreateResponse,
    WorkOrderRead,
    WorkOrderUpdate,
)
from app.security import require_office_user, require_owner
from app.services import audit as audit_svc
from app.services import work_orders as svc

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.get("/recycle-bin", response_model=RecycleBinListResponse)
def list_recycle_bin(
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
    deleted_from: Optional[date] = Query(default=None),
    deleted_to: Optional[date] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=255),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> RecycleBinListResponse:
    if deleted_from and deleted_to and deleted_from > deleted_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deleted_from must be on or before deleted_to",
        )
    items, total = svc.list_deleted_work_orders(
        session,
        deleted_from=deleted_from,
        deleted_to=deleted_to,
        search=search,
        limit=limit,
        offset=offset,
    )
    return RecycleBinListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/recycle-bin/{work_order_id}/restore", response_model=MessageResponse)
def restore_work_order(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_owner),
) -> MessageResponse:
    wo = svc.get_deleted_work_order(session, work_order_id)
    wo_number = wo.work_order_number
    svc.restore_work_order(session, wo)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.restore",
        entity_type="work_order",
        entity_id=work_order_id,
        entity_name=wo_number,
        description=f"Restored work order {wo_number} from the recycle bin",
        details={"work_order_number": wo_number},
        request=request,
    )
    session.commit()
    return MessageResponse(detail="Work order restored")


@router.delete("/recycle-bin/{work_order_id}", response_model=MessageResponse)
def permanently_delete_work_order(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_owner),
) -> MessageResponse:
    wo = svc.get_deleted_work_order(session, work_order_id)
    wo_number = wo.work_order_number
    wo_address = wo.service_address
    svc.permanently_delete_work_order(session, wo)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.permanently_delete",
        entity_type="work_order",
        entity_id=work_order_id,
        entity_name=wo_number,
        description=f"Permanently deleted work order {wo_number} ({wo_address})",
        details={"work_order_number": wo_number, "service_address": wo_address},
        request=request,
    )
    session.commit()
    return MessageResponse(detail="Work order permanently deleted")


def _create_work_order(
    payload: WorkOrderCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session,
    user: User,
    before_photos: Optional[dict[int, tuple[bytes, str, str | None]]] = None,
) -> WorkOrderCreateResponse:
    wo = svc.create_work_order(session, payload, user, before_photos=before_photos)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.create",
        entity_type="work_order",
        entity_id=wo.id,
        entity_name=wo.work_order_number,
        description=f"Created work order {wo.work_order_number} for {wo.service_address} (Assigned to: {wo.assigned_to_name})",
        details={
            "work_order_number": wo.work_order_number,
            "service_address": wo.service_address,
            "assigned_to_name": wo.assigned_to_name,
            "assigned_to_phone": wo.assigned_to_phone,
            "assigned_to_email": wo.assigned_to_email,
            "priority": wo.priority.name if wo.priority else payload.priority,
            "tenant_names": wo.tenant_names,
            "items_count": len(wo.items),
            "items": [item.category for item in wo.items],
        },
        request=request,
    )
    session.commit()
    background_tasks.add_task(svc.send_initial_worker_notification, wo.id, session.get_bind())
    return svc.to_create_response(wo)


@router.post("", response_model=WorkOrderCreateResponse, status_code=201)
def create_work_order(
    payload: WorkOrderCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> WorkOrderCreateResponse:
    return _create_work_order(payload, request, background_tasks, session, user)


@router.post("/with-photos", response_model=WorkOrderCreateResponse, status_code=201)
async def create_work_order_with_photos(
    request: Request,
    background_tasks: BackgroundTasks,
    payload_json: str = Form(..., alias="payload"),
    photo_indices_json: str = Form(default="[]", alias="photo_indices"),
    photos: list[UploadFile] = File(default=[]),
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> WorkOrderCreateResponse:
    try:
        payload = WorkOrderCreate.model_validate(json.loads(payload_json))
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        detail = (
            jsonable_encoder(exc.errors(include_url=False))
            if isinstance(exc, ValidationError)
            else "Invalid work-order payload."
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        ) from exc

    try:
        photo_indices = json.loads(photo_indices_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="photo_indices must be a JSON array.",
        ) from exc

    if (
        not isinstance(photo_indices, list)
        or len(photo_indices) != len(photos)
        or any(
            type(index) is not int or index < 0 or index >= len(payload.items)
            for index in photo_indices
        )
        or len(set(photo_indices)) != len(photo_indices)
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Each uploaded photo must map to one unique work-item index.",
        )

    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    before_photos: dict[int, tuple[bytes, str, str | None]] = {}
    for index, file in zip(photo_indices, photos):
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/png", "image/jpeg", "image/webp"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photos must be PNG, JPG, or WEBP images.",
            )
        data = await file.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Photo exceeds the {settings.max_upload_mb} MB upload limit.",
            )
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded before photos cannot be empty.",
            )
        before_photos[index] = (
            data,
            file.filename or f"before-{index}.jpg",
            content_type,
        )

    return _create_work_order(
        payload,
        request,
        background_tasks,
        session,
        user,
        before_photos=before_photos,
    )


@router.get("", response_model=list[WorkOrderRead])
def list_work_orders(
    session: Session = Depends(get_session),
    _: User = Depends(require_office_user),
    status: Optional[WorkOrderStatus] = Query(default=None),
    overdue: Optional[bool] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    address: Optional[str] = Query(default=None),
    assigned_by_id: Optional[int] = Query(default=None),
) -> list[WorkOrderRead]:
    rows = svc.list_work_orders(
        session,
        status_filter=status,
        overdue=overdue,
        date_from=date_from,
        date_to=date_to,
        address=address,
        assigned_by_id=assigned_by_id,
    )
    return [svc.to_read(wo) for wo in rows]


@router.get("/{work_order_id}", response_model=WorkOrderRead)
def get_work_order(
    work_order_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_office_user),
) -> WorkOrderRead:
    return svc.to_read(svc.get_work_order(session, work_order_id))


@router.patch("/{work_order_id}", response_model=WorkOrderRead)
def patch_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> WorkOrderRead:
    wo = svc.get_work_order(session, work_order_id)
    changed_dict = payload.model_dump(exclude_unset=True)
    changed_fields = list(changed_dict.keys())
    updated = svc.update_work_order(session, wo, payload)
    fields_desc = ", ".join(changed_fields) if changed_fields else "no changes"
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.update",
        entity_type="work_order",
        entity_id=updated.id,
        entity_name=updated.work_order_number,
        description=f"Updated work order {updated.work_order_number} ({fields_desc})",
        details={
            "work_order_number": updated.work_order_number,
            "changed_fields": changed_fields,
            "service_address": updated.service_address,
            "assigned_to_name": updated.assigned_to_name,
        },
        request=request,
    )
    session.commit()
    return svc.to_read(updated)


@router.delete("/{work_order_id}", response_model=MessageResponse)
def delete_work_order(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    wo_number = wo.work_order_number
    wo_address = wo.service_address
    wo_tech = wo.assigned_to_name
    wo_status = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
    svc.delete_work_order(session, wo, user=user)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.trash",
        entity_type="work_order",
        entity_id=work_order_id,
        entity_name=wo_number,
        description=f"Moved work order {wo_number} ({wo_address}) to the recycle bin",
        details={
            "work_order_number": wo_number,
            "service_address": wo_address,
            "assigned_to_name": wo_tech,
            "status": wo_status,
        },
        request=request,
    )
    session.commit()
    return MessageResponse(detail="Moved to recycle bin")


@router.get("/{work_order_id}/pdf")
def download_pdf(
    work_order_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_office_user),
) -> Response:
    wo = svc.get_work_order(session, work_order_id)
    data = svc.pdf_bytes(wo)
    filename = f"{wo.work_order_number}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{work_order_id}/resend", response_model=MessageResponse)
def resend_link(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    try:
        url = svc.resend_worker_link(wo)
    except RuntimeError as exc:
        session.add(wo)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SMS could not be sent. Use Share link to deliver the worker link manually.",
        ) from exc
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.resend_link",
        entity_type="work_order",
        entity_id=wo.id,
        entity_name=wo.work_order_number,
        description=f"Resent technician link for {wo.work_order_number} to {wo.assigned_to_name} ({wo.assigned_to_phone})",
        details={
            "work_order_number": wo.work_order_number,
            "assigned_to_name": wo.assigned_to_name,
            "assigned_to_phone": wo.assigned_to_phone,
        },
        request=request,
    )
    session.commit()
    return MessageResponse(detail=f"Technician link sent: {url}")


@router.post("/{work_order_id}/regenerate-link")
def regenerate_link(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
) -> dict[str, str]:
    wo = svc.get_work_order(session, work_order_id)
    updated = svc.regenerate_worker_link(session, wo)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.regenerate_link",
        entity_type="work_order",
        entity_id=updated.id,
        entity_name=updated.work_order_number,
        description=f"Regenerated technician access link for {updated.work_order_number}",
        details={"work_order_number": updated.work_order_number},
        request=request,
    )
    session.commit()
    return {
        "worker_access_token": updated.worker_access_token,
        "worker_share_url": svc.worker_share_url(updated.worker_access_token),
    }


@router.post("/{work_order_id}/send-email", response_model=MessageResponse)
def send_email_report(
    work_order_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_office_user),
    to_email: Optional[str] = Query(None, description="Optional override recipient email"),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    if wo.status != WorkOrderStatus.signed_off or not wo.pdf_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Work order must be signed off with a finalized PDF before emailing.",
        )
    recipients = svc.send_completion_email(wo.id, session.get_bind(), target_email=to_email)
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not send email: no recipient owner or work-order creator email was found.",
        )
    to_recipient = recipients[0]
    cc_recipients = recipients[1:]
    cc_str = ", ".join(cc_recipients) or "none"
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="work_order.send_email",
        entity_type="work_order",
        entity_id=wo.id,
        entity_name=wo.work_order_number,
        description=(
            f"Sent completed maintenance report for {wo.work_order_number} "
            f"to {to_recipient}; cc: {cc_str}"
        ),
        details={
            "work_order_number": wo.work_order_number,
            "to": [to_recipient],
            "cc": cc_recipients,
            "recipients": recipients,
        },
        request=request,
    )
    session.commit()
    return MessageResponse(
        detail=f"Completed report emailed to {to_recipient}; cc: {cc_str}"
    )
