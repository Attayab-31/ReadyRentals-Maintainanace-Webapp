from typing import Literal

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from app.config import get_settings
from app.db import get_session
from app.schemas import (
    CompleteWorkOrderRequest,
    SignRequest,
    WorkOrderItemRead,
    WorkOrderItemUpdate,
    WorkerWorkOrderRead,
)
from app.services import work_orders as svc

router = APIRouter(prefix="/wo", tags=["worker"])


@router.get("/{token}", response_model=WorkerWorkOrderRead)
def get_worker_work_order(token: str, session: Session = Depends(get_session)) -> WorkerWorkOrderRead:
    return svc.worker_view(svc.get_by_token(session, token))


@router.post("/{token}/start", response_model=WorkerWorkOrderRead)
def start_job(token: str, session: Session = Depends(get_session)) -> WorkerWorkOrderRead:
    wo = svc.get_by_token(session, token)
    return svc.worker_view(svc.start_work_order(session, wo))


@router.patch("/{token}/items/{item_id}", response_model=WorkOrderItemRead)
def patch_item(
    token: str,
    item_id: int,
    payload: WorkOrderItemUpdate,
    session: Session = Depends(get_session),
) -> WorkOrderItemRead:
    wo = svc.get_by_token(session, token)
    item = svc.update_item(
        session,
        wo,
        item_id,
        details=payload.details,
        resolved=payload.resolved,
        category=payload.category,
    )
    return WorkOrderItemRead.model_validate(item)


@router.post("/{token}/items/{item_id}/photo", response_model=WorkOrderItemRead)
async def upload_photo(
    token: str,
    item_id: int,
    slot: Literal["before", "after"] = Query(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> WorkOrderItemRead:
    settings = get_settings()
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Photos must be PNG, JPG, or WEBP images.",
        )
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Photo exceeds the {settings.max_upload_mb} MB upload limit.",
        )
    wo = svc.get_by_token(session, token)
    item = svc.attach_photo(
        session,
        wo,
        item_id,
        slot=slot,
        data=data,
        filename=file.filename or f"{slot}.jpg",
        content_type=file.content_type,
    )
    return WorkOrderItemRead.model_validate(item)


@router.post("/{token}/complete", response_model=WorkerWorkOrderRead)
def complete_job(
    token: str,
    payload: CompleteWorkOrderRequest = Body(
        default_factory=CompleteWorkOrderRequest),
    session: Session = Depends(get_session),
) -> WorkerWorkOrderRead:
    wo = svc.get_by_token(session, token)
    return svc.worker_view(svc.complete_work_order(session, wo, payload))


@router.post("/{token}/sign", response_model=WorkerWorkOrderRead)
def sign_job(
    token: str,
    payload: SignRequest,
    session: Session = Depends(get_session),
) -> WorkerWorkOrderRead:
    wo = svc.get_by_token(session, token)
    wo = svc.sign_work_order(
        session,
        wo,
        signer=payload.signer,
        name=payload.name,
        signature_png_base64=payload.signature_png_base64,
    )
    return svc.worker_view(wo)


@router.get("/{token}/pdf")
def worker_pdf(token: str, session: Session = Depends(get_session)) -> Response:
    wo = svc.get_by_token(session, token)
    data = svc.pdf_bytes(wo)
    filename = f"{wo.work_order_number}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
