from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from app.config import get_settings
from app.db import get_session
from app.schemas import (
    CompleteWorkOrderRequest,
    SaveProgressRequest,
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
        tech_notes=payload.tech_notes,
        resolved=payload.resolved,
        category=payload.category,
        before_photo_skipped=payload.before_photo_skipped,
        after_photo_skipped=payload.after_photo_skipped,
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


@router.post("/{token}/progress", response_model=WorkerWorkOrderRead)
def save_progress(
    token: str,
    payload: SaveProgressRequest = Body(default_factory=SaveProgressRequest),
    session: Session = Depends(get_session),
) -> WorkerWorkOrderRead:
    wo = svc.get_by_token(session, token)
    return svc.worker_view(svc.save_progress(session, wo, payload))


@router.post("/{token}/complete", response_model=WorkerWorkOrderRead)
def complete_job(
    token: str,
    payload: CompleteWorkOrderRequest,
    session: Session = Depends(get_session),
) -> WorkerWorkOrderRead:
    wo = svc.get_by_token(session, token)
    return svc.worker_view(svc.complete_work_order(session, wo, payload))


@router.post("/{token}/sign", response_model=WorkerWorkOrderRead)
def sign_job(
    token: str,
    payload: SignRequest,
    background_tasks: BackgroundTasks,
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
    if wo.status.value == "signed_off":
        background_tasks.add_task(svc.send_completion_email, wo.id, session.get_bind())
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
