from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import ChecklistCategory, User
from app.schemas import ChecklistCategoryCreate, ChecklistCategoryRead, MessageResponse
from app.security import require_manager

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
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
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
            session.commit()
            session.refresh(existing)
            return existing
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Category already exists")
    category = ChecklistCategory(name=name)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", response_model=MessageResponse)
def archive_category(
    category_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_manager),
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
    session.commit()
    return MessageResponse(detail="Category archived")
