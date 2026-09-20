from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
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
from app.services import work_orders as svc

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.post("", response_model=WorkOrderCreateResponse, status_code=201)
def create_work_order(
    payload: WorkOrderCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_manager),
) -> WorkOrderCreateResponse:
    wo = svc.create_work_order(session, payload, user)
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
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
) -> WorkOrderRead:
    wo = svc.get_work_order(session, work_order_id)
    return svc.to_read(svc.update_work_order(session, wo, payload))


@router.delete("/{work_order_id}", response_model=MessageResponse)
def delete_work_order(
    work_order_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    svc.delete_work_order(session, wo)
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
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
) -> MessageResponse:
    wo = svc.get_work_order(session, work_order_id)
    url = svc.resend_worker_link(wo)
    return MessageResponse(detail=f"Technician link sent: {url}")


@router.post("/{work_order_id}/regenerate-link")
def regenerate_link(
    work_order_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
) -> dict[str, str]:
    wo = svc.get_work_order(session, work_order_id)
    updated = svc.regenerate_worker_link(session, wo)
    return {
        "worker_access_token": updated.worker_access_token,
        "worker_share_url": svc.worker_share_url(updated.worker_access_token),
    }
