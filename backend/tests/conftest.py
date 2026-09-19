from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret-must-be-at-least-32-bytes")
os.environ.setdefault("EMAIL_BACKEND", "log")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("ADMIN_EMAIL", "")
os.environ.setdefault("ADMIN_PASSWORD", "")

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.models import User, UserRole
from app.seed import seed_lookups
from app.security import hash_password
from app.services.storage import LocalStorage, set_storage

TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture()
def engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_lookups(session)
        session.add(
            User(
                email="manager@example.com",
                hashed_password=hash_password("secret"),
                name="Pat Manager",
                role=UserRole.manager,
            )
        )
        session.commit()
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture()
def client(engine, tmp_path, monkeypatch):
    set_storage(LocalStorage(tmp_path, "http://testserver"))
    monkeypatch.setattr(
        "app.services.work_orders.generate_pdf",
        lambda work_order, storage=None: b"%PDF-1.4 fake signed work order",
    )

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    set_storage(None)


@pytest.fixture()
def auth_headers(client) -> dict[str, str]:
    response = client.post(
        "/auth/login", json={"email": "manager@example.com", "password": "secret"}
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_work_order_payload(**overrides) -> dict:
    payload = {
        "assigned_to_name": "Alex Tech",
        "assigned_to_phone": "+15555550100",
        "date_assigned": date.today().isoformat(),
        "service_address": "101 Maple St, Springfield",
        "tenant_names": "Jamie Tenant",
        "tenant_phone": "+15555550200",
        "priority": "urgent",
        "service_date": date.today().isoformat(),
        "items": [
            {"category": "Interior Surfaces", "details": "Patch living room wall"},
            {"category": "Tub/Plumbing", "details": "Replace tub caulk"},
        ],
    }
    payload.update(overrides)
    return payload
