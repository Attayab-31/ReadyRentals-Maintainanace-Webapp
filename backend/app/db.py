from collections.abc import Generator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings, normalize_database_url


def _sqlite_connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def build_engine(database_url: str | None = None):
    raw_url = (database_url or "").strip() or get_settings().database_url
    url = normalize_database_url(raw_url)
    connect_args = _sqlite_connect_args(url)
    engine = create_engine(url, echo=False, connect_args=connect_args)
    if url.startswith("sqlite"):

        @event.listens_for(Engine, "connect")
        def _fk_pragma(dbapi_connection, _connection_record):  # noqa: ANN001
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = build_engine()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
