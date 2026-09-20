from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, func, select

from app.db import get_session
from app.models import User, UserRole, WorkOrder
from app.schemas import AdminCreate, AdminUserRead, MessageResponse
from app.security import hash_password, require_owner

router = APIRouter(prefix="/admins", tags=["admins"])


@router.get("", response_model=list[AdminUserRead])
def list_admins(
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
) -> list[AdminUserRead]:
    users = session.exec(
        select(User).where(col(User.role).in_([UserRole.owner, UserRole.admin, UserRole.manager]))
    ).all()

    results: list[AdminUserRead] = []
    for u in users:
        count = session.exec(
            select(func.count(WorkOrder.id)).where(WorkOrder.created_by_user_id == u.id)
        ).one()
        role_val = u.role.value if hasattr(u.role, "value") else str(u.role)
        results.append(
            AdminUserRead(
                id=u.id,
                email=u.email,
                name=u.name,
                role=role_val,
                work_orders_count=count,
            )
        )
    return results


@router.post("", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_owner),
) -> AdminUserRead:
    email = str(payload.email).strip().lower()
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_admin = User(
        email=email,
        hashed_password=hash_password(payload.password),
        name=payload.name.strip(),
        role=UserRole.admin,
    )
    session.add(new_admin)
    session.commit()
    session.refresh(new_admin)

    return AdminUserRead(
        id=new_admin.id,
        email=new_admin.email,
        name=new_admin.name,
        role=new_admin.role.value if hasattr(new_admin.role, "value") else str(new_admin.role),
        work_orders_count=0,
    )


@router.delete("/{admin_id}", response_model=MessageResponse)
def delete_admin(
    admin_id: int,
    session: Session = Depends(get_session),
    current_owner: User = Depends(require_owner),
) -> MessageResponse:
    if admin_id == current_owner.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own owner account",
        )

    target_user = session.get(User, admin_id)
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin account not found",
        )

    # Reassign any work orders created by this admin to the owner so data and foreign keys are preserved
    assigned_orders = session.exec(
        select(WorkOrder).where(WorkOrder.created_by_user_id == admin_id)
    ).all()
    for order in assigned_orders:
        order.created_by_user_id = current_owner.id
        order.created_by = current_owner
        session.add(order)
    target_user.work_orders = []
    session.flush()

    session.delete(target_user)
    session.commit()

    return MessageResponse(
        detail=f"Admin account '{target_user.name}' has been deleted and their work orders reassigned to owner."
    )
