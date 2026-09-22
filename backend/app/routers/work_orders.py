from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import Response
from sqlmodel import Session

from app.db import get_session
from app.models import User, WorkOrderStatus
from app.schemas import (
    MessageResponse,
    WorkOrderCreate,
    WorkOrderCreateResponse,
    WorkOrderRead,
    WorkOrderUpdate,
)
from app.security import require_manager
from app.services import audit as audit_svc
from app.services import work_orders as svc

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.post("", response_model=WorkOrderCreateResponse, status_code=201)
def create_work_order(
    payload: WorkOrderCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user: User = Depends(require_manager),
) -> WorkOrderCreateResponse:
    wo = svc.create_work_order(session, payload, user)
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


@router.get("", response_model=list[WorkOrderRead])
def list_work_orders(
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
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
    _: User = Depends(require_manager),
) -> WorkOrderRead:
    return svc.to_read(svc.get_work_order(session, work_order_id))


@router.patch("/{work_order_id}", response_model=WorkOrderRead)
def patch_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_manager),
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
    user: User = Depends(require_manager),
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
        action="work_order.delete",
        entity_type="work_order",
        entity_id=work_order_id,
        entity_name=wo_number,
        description=f"Deleted work order {wo_number} ({wo_address})",
        details={
            "work_order_number": wo_number,
            "service_address": wo_address,
            "assigned_to_name": wo_tech,
            "status": wo_status,
        },
        request=request,
    )
    session.commit()
    return MessageResponse(detail="Deleted")


@router.get("/{work_order_id}/pdf")
def download_pdf(
    work_order_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
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
    user: User = Depends(require_manager),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    url = svc.resend_worker_link(wo)
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
    user: User = Depends(require_manager),
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
