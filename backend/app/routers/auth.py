from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.models import User, UserRole
from app.schemas import CurrentUserRead, LoginRequest, RegisterOwnerRequest, TokenResponse
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.services import audit as audit_svc

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/owner-setup-status")
def get_owner_setup_status(session: Session = Depends(get_session)) -> dict[str, bool]:
    owner_exists = session.exec(select(User.id).where(User.role == UserRole.owner)).first() is not None
    return {"available": not owner_exists}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, session: Session = Depends(get_session)) -> TokenResponse:
    email = str(payload.email).strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    try:
        ok = verify_password(payload.password, user.hashed_password)
    except ValueError:
        ok = False
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="auth.login",
        entity_type="user_session",
        entity_id=user.id,
        entity_name=user.name,
        description=f"{user.name} ({role_str}) logged in",
        details={"email": user.email, "role": role_str},
        request=request,
    )
    session.commit()
    return TokenResponse(access_token=create_access_token(user))


@router.post("/register-owner", response_model=TokenResponse)
def register_owner(
    payload: RegisterOwnerRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> TokenResponse:
    settings = get_settings()
    if not settings.owner_code or payload.owner_code.strip() != settings.owner_code.strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid owner code")

    email = str(payload.email).strip().lower()

    # Only one owner account is allowed to be initialized
    existing_owner = session.exec(select(User).where(User.role == UserRole.owner)).first()
    if existing_owner and existing_owner.email != email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An owner account has already been registered. Please sign in or contact the system owner.",
        )

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        try:
            ok = verify_password(payload.password, existing.hashed_password)
        except ValueError:
            ok = False
        if ok:
            existing.role = UserRole.owner
            existing.name = payload.name.strip()
            session.add(existing)
            audit_svc.record_audit_log(
                session,
                actor=existing,
                action="auth.register_owner",
                entity_type="user_account",
                entity_id=existing.id,
                entity_name=existing.name,
                description=f"Account owner {existing.name} ({existing.email}) claimed owner account",
                details={"email": existing.email, "role": "owner"},
                request=request,
            )
            session.commit()
            session.refresh(existing)
            return TokenResponse(access_token=create_access_token(existing))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        name=payload.name.strip(),
        role=UserRole.owner,
    )
    session.add(user)
    session.flush()
    audit_svc.record_audit_log(
        session,
        actor=user,
        action="auth.register_owner",
        entity_type="user_account",
        entity_id=user.id,
        entity_name=user.name,
        description=f"Account owner {user.name} ({user.email}) registered owner account",
        details={"email": user.email, "role": "owner"},
        request=request,
    )
    session.commit()
    session.refresh(user)
    return TokenResponse(access_token=create_access_token(user))


@router.get("/me", response_model=CurrentUserRead)
def get_me(current_user: User = Depends(get_current_user)) -> CurrentUserRead:
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    return CurrentUserRead(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=role_val,
    )
