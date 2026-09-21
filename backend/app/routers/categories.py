from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import ChecklistCategory, User
from app.schemas import ChecklistCategoryCreate, ChecklistCategoryRead, MessageResponse
from app.security import require_manager
from app.services import audit as audit_svc

router = APIRouter(prefix="/checklist-categories",
                   tags=["checklist-categories"])


@router.get("", response_model=list[ChecklistCategoryRead])
def list_categories(
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
) -> list[ChecklistCategory]:
    return list(
        session.exec(
            select(ChecklistCategory)
            .where(ChecklistCategory.is_active)
            .order_by(col(ChecklistCategory.name))
        ).all()
    )


@router.post("", response_model=ChecklistCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: ChecklistCategoryCreate,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_manager),
) -> ChecklistCategory:
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Category name cannot be blank",
        )
    existing = session.exec(
        select(ChecklistCategory).where(ChecklistCategory.name.ilike(name))
    ).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            session.add(existing)
            audit_svc.record_audit_log(
                session,
                actor=user,
                action="category.create",
                entity_type="checklist_category",
                entity_id=existing.id,
                entity_name=existing.name,
                description=f"Re-activated checklist category '{existing.name}'",
                details={"category_name": existing.name},
                request=request,
            )
            session.commit()
            session.refresh(existing)
            return existing
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Category already exists")
    category = ChecklistCategory(name=name)
    session.add(category)
    session.flush()
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="category.create",
        entity_type="checklist_category",
        entity_id=category.id,
        entity_name=category.name,
        description=f"Created checklist category '{category.name}'",
        details={"category_name": category.name},
        request=request,
    )
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", response_model=MessageResponse)
def archive_category(
    category_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(require_manager),
) -> MessageResponse:
    category = session.get(ChecklistCategory, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    category.is_active = False
    session.add(category)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="category.archive",
        entity_type="checklist_category",
        entity_id=category.id,
        entity_name=category.name,
        description=f"Archived checklist category '{category.name}'",
        details={"category_name": category.name},
        request=request,
    )
    session.commit()
    return MessageResponse(detail="Category archived")
