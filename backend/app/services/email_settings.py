from sqlmodel import Session, select

from app.config import get_settings
from app.models import ApplicationSetting, User, UserRole


def get_completion_cc_emails(session: Session) -> list[str]:
    """Return the configured completion-report CCs, falling back to owner emails."""
    app_settings = session.get(ApplicationSetting, 1)
    if app_settings and app_settings.completion_email_cc:
        return [app_settings.completion_email_cc.strip().lower()]

    addresses = [
        owner.email.strip().lower()
        for owner in session.exec(select(User).where(User.role == UserRole.owner)).all()
        if owner.email and owner.email.strip()
    ]
    configured_owner_email = get_settings().owner_email
    if configured_owner_email and configured_owner_email.strip():
        addresses.append(configured_owner_email.strip().lower())
    return list(dict.fromkeys(addresses))
