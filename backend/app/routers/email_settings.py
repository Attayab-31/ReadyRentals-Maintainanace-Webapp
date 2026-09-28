from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.db import get_session
from app.models import ApplicationSetting, User
from app.schemas import CompletionEmailSettingsRead, CompletionEmailSettingsUpdate
from app.security import require_owner
from app.services import audit as audit_svc
from app.services.email_settings import get_completion_cc_emails

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/completion-email", response_model=CompletionEmailSettingsRead)
def get_completion_email_settings(
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
) -> CompletionEmailSettingsRead:
    settings = session.get(ApplicationSetting, 1)
    return CompletionEmailSettingsRead(
        completion_email_cc=settings.completion_email_cc if settings else None,
        effective_cc_emails=get_completion_cc_emails(session),
    )


@router.put("/completion-email", response_model=CompletionEmailSettingsRead)
def update_completion_email_settings(
    payload: CompletionEmailSettingsUpdate,
    request: Request,
    session: Session = Depends(get_session),
    owner: User = Depends(require_owner),
) -> CompletionEmailSettingsRead:
    settings = session.get(ApplicationSetting, 1)
    if settings is None:
        settings = ApplicationSetting()

    completion_email_cc = (
        str(payload.completion_email_cc).strip().lower()
        if payload.completion_email_cc
        else None
    )
    settings.completion_email_cc = completion_email_cc
    settings.updated_at = datetime.now(timezone.utc)
    session.add(settings)
    audit_svc.record_audit_log(
        session,
        actor=owner,
        action="settings.completion_email_updated",
        entity_type="application_settings",
        entity_id="1",
        entity_name="Completion email CC",
        description=(
            "Updated the completion email CC override"
            if completion_email_cc
            else "Restored owner email addresses for completion email CC"
        ),
        details={"override_enabled": completion_email_cc is not None},
        request=request,
    )
    session.commit()
    session.refresh(settings)
    return CompletionEmailSettingsRead(
        completion_email_cc=settings.completion_email_cc,
        effective_cc_emails=get_completion_cc_emails(session),
    )
