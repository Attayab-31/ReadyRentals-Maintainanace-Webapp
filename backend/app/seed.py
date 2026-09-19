from sqlmodel import Session, select

from app.models import ChecklistCategory, Priority

DEFAULT_PRIORITIES = [
    ("emergency", "Emergency", 4),
    ("urgent", "Urgent", 24),
    ("standard", "Standard", 72),
]

DEFAULT_CATEGORIES = [
    "Interior Surfaces",
    "Exterior Roof",
    "Mechanical Equipment",
    "Concrete Components",
    "Handrails/Guardrails",
    "Tub/Plumbing",
    "Other",
]


def seed_lookups(session: Session) -> None:
    for code, name, hours in DEFAULT_PRIORITIES:
        if session.exec(select(Priority).where(Priority.code == code)).first() is None:
            session.add(Priority(code=code, name=name, hour_target=hours))
    for name in DEFAULT_CATEGORIES:
        if session.exec(select(ChecklistCategory).where(ChecklistCategory.name == name)).first() is None:
            session.add(ChecklistCategory(name=name))
    session.commit()
