from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db import get_session
from app.models import User
from app.schemas import AuditLogListResponse, AuditLogStats
from app.security import require_owner
from app.services import audit as audit_svc

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
    actor_id: Optional[int] = Query(default=None),
    actor_role: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AuditLogListResponse:
    items, total = audit_svc.query_audit_logs(
        session,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=AuditLogStats)
def get_audit_stats(
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
) -> AuditLogStats:
    data = audit_svc.get_audit_stats(session)
    return AuditLogStats.model_validate(data)
