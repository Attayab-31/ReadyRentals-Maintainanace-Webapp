from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine
from app.models import User
from app.routers import auth, categories, work_orders, worker
from app.security import hash_password
from app.services.storage import get_storage

STATIC_UI_DIR = Path(__file__).resolve().parent / "static_ui"


def _cors_allow_origins(settings) -> list[str]:
    """Test UI may use *. Production React app must list explicit origins."""
    if settings.enable_test_ui:
        return ["*"]
    return [part.strip() for part in settings.cors_origins.split(",") if part.strip()]


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Maintenance Work Orders",
        description="Property-maintenance work order API replacing the paper service form.",
        version="1.0.0",
    )
    cors_origins = _cors_allow_origins(settings)
    if cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    application.include_router(auth.router)
    application.include_router(work_orders.router)
    application.include_router(categories.router)
    application.include_router(worker.router)

    if settings.storage_backend == "local":
        storage_dir = Path(settings.storage_local_dir)
        storage_dir.mkdir(parents=True, exist_ok=True)
        application.mount(
            "/files", StaticFiles(directory=str(storage_dir)), name="files")
    else:
        @application.get("/files/{key:path}")
        def private_file(key: str) -> RedirectResponse:
            return RedirectResponse(get_storage().download_url(key))

    if settings.enable_test_ui and STATIC_UI_DIR.is_dir():
        application.mount(
            "/testui",
            StaticFiles(directory=str(STATIC_UI_DIR), html=True),
            name="testui",
        )

    @application.on_event("startup")
    def _startup() -> None:
        get_storage()
        _bootstrap_admin()

    @application.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return application


def _bootstrap_admin() -> None:
    import logging

    settings = get_settings()
    if not settings.admin_email or not settings.admin_password:
        return
    log = logging.getLogger("uvicorn.error")
    try:
        from app.models import UserRole

        with Session(engine) as session:
            existing = session.exec(
                select(User).where(User.email == settings.admin_email.lower())
            ).first()
            if existing:
                log.info("Admin user already present: %s", existing.email)
                return
            session.add(
                User(
                    email=settings.admin_email.lower(),
                    hashed_password=hash_password(settings.admin_password),
                    name=settings.admin_name,
                    role=UserRole.admin,
                )
            )
            session.commit()
            log.info("Created bootstrap admin %s",
                     settings.admin_email.lower())
    except Exception:
        log.exception("Admin bootstrap failed (run: alembic upgrade head)")


app = create_app()
