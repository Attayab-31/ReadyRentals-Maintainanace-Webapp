from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from app.config import get_settings
from app.db import engine
from app.routers import admins, audit_logs, auth, categories, work_orders, worker
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
        title="ReadyRentalsOnline Maintenance API",
        description="ReadyRentalsOnline property-maintenance work order API.",
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
    application.include_router(admins.router)
    application.include_router(audit_logs.router)
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
        _bootstrap_lookups()

    @application.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return application


def _bootstrap_lookups() -> None:
    import logging

    log = logging.getLogger("uvicorn.error")
    try:
        from app.db import init_db
        from app.seed import seed_lookups

        init_db()
        with Session(engine) as session:
            seed_lookups(session)
    except Exception:
        log.exception("Initial lookups seeding failed (run: alembic upgrade head)")


app = create_app()
