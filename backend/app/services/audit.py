"""Audit logging service for tracking administrative operations."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timezone
from typing import Any, Optional

from fastapi import Request
from sqlmodel import Session, col, func, select

from app.models import AuditLog, User
from app.time_utils import utcnow

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def record_audit_log(
    session: Session,
    *,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: str | int | None = None,
    entity_name: str | None = None,
    description: str,
    details: dict[str, Any] | None = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Record an immutable audit log entry for an administrative action."""
    if ip_address is None and request is not None:
        ip_address = get_client_ip(request)

    role_val = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    details_str = json.dumps(details, default=str) if details is not None else None

    entry = AuditLog(
        actor_id=actor.id,
        actor_name=actor.name,
        actor_email=actor.email,
        actor_role=role_val,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        entity_name=entity_name,
        description=description,
        details=details_str,
        ip_address=ip_address,
        created_at=utcnow(),
    )
    session.add(entry)
    session.flush()
    return entry


def query_audit_logs(
    session: Session,
    *,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    stmt = select(AuditLog)

    if actor_id is not None:
        stmt = stmt.where(AuditLog.actor_id == actor_id)

    if actor_role is not None and actor_role.strip():
        stmt = stmt.where(AuditLog.actor_role == actor_role.strip().lower())

    if action is not None and action.strip():
        stmt = stmt.where(AuditLog.action == action.strip())

    if entity_type is not None and entity_type.strip():
        stmt = stmt.where(AuditLog.entity_type == entity_type.strip())

    if date_from is not None:
        start_dt = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        stmt = stmt.where(AuditLog.created_at >= start_dt)

    if date_to is not None:
        end_dt = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        stmt = stmt.where(AuditLog.created_at <= end_dt)

    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            col(AuditLog.description).ilike(pattern)
            | col(AuditLog.entity_name).ilike(pattern)
            | col(AuditLog.actor_name).ilike(pattern)
            | col(AuditLog.actor_email).ilike(pattern)
            | col(AuditLog.entity_id).ilike(pattern)
            | col(AuditLog.action).ilike(pattern)
        )

    # Count matching records
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.exec(count_stmt).one()

    # Query page
    paged_stmt = stmt.order_by(col(AuditLog.created_at).desc()).offset(offset).limit(limit)
    items = list(session.exec(paged_stmt).all())

    return items, total


def get_audit_stats(session: Session) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)

    total_events = session.exec(select(func.count(AuditLog.id))).one()

    admin_today = session.exec(
        select(func.count(AuditLog.id)).where(
            AuditLog.actor_role == "admin",
            AuditLog.created_at >= today_start,
        )
    ).one()

    wo_actions = session.exec(
        select(func.count(AuditLog.id)).where(
            AuditLog.entity_type == "work_order"
        )
    ).one()

    unique_admins = session.exec(
        select(func.count(func.distinct(AuditLog.actor_id))).where(
            AuditLog.actor_role == "admin",
            AuditLog.actor_id.is_not(None),
        )
    ).one()

    # Breakdown by top actions
    action_rows = session.exec(
        select(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    ).all()
    action_breakdown = {row[0]: row[1] for row in action_rows}

    return {
        "total_events": total_events,
        "admin_actions_today": admin_today,
        "work_order_actions": wo_actions,
        "unique_active_admins": unique_admins,
        "action_breakdown": action_breakdown,
    }
