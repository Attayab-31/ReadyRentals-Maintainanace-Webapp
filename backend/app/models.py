from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from app.time_utils import utcnow


class WorkOrderStatus(str, Enum):
    assigned = "assigned"
    in_progress = "in_progress"
    completed_pending_signoff = "completed_pending_signoff"
    signed_off = "signed_off"


class UserRole(str, Enum):
    owner = "owner"
    admin = "admin"



class Priority(SQLModel, table=True):
    __tablename__ = "priorities"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=32)
    name: str = Field(max_length=64)
    hour_target: int = Field(description="SLA target in hours")

    work_orders: list["WorkOrder"] = Relationship(back_populates="priority")


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=255)
    hashed_password: str
    name: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.admin)

    work_orders: list["WorkOrder"] = Relationship(back_populates="created_by")


class ApplicationSetting(SQLModel, table=True):
    __tablename__ = "application_settings"

    id: int = Field(default=1, primary_key=True)
    completion_email_cc: Optional[str] = Field(default=None, max_length=255)
    updated_at: datetime = Field(default_factory=utcnow)


class ChecklistCategory(SQLModel, table=True):
    __tablename__ = "checklist_categories"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True, max_length=128)
    is_active: bool = Field(default=True, index=True)


class WorkOrder(SQLModel, table=True):
    __tablename__ = "work_orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    work_order_number: str = Field(index=True, unique=True, max_length=32)
    created_by_user_id: int = Field(foreign_key="users.id")
    assigned_to_name: str = Field(max_length=255)
    assigned_to_phone: str = Field(max_length=32)
    assigned_to_email: Optional[str] = Field(default=None, max_length=255)
    date_assigned: date
    service_address: str = Field(max_length=512)
    tenant_names: str = Field(max_length=512)
    tenant_phone: Optional[str] = Field(default=None, max_length=32)
    priority_id: int = Field(foreign_key="priorities.id")
    status: WorkOrderStatus = Field(
        default=WorkOrderStatus.assigned, index=True)
    service_date: Optional[date] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    if_incomplete_explanation: Optional[str] = None
    return_date: Optional[date] = None
    entire_unit_inspected: Optional[bool] = None
    inspection_results: Optional[str] = None
    tenant_signature_url: Optional[str] = None
    tenant_signature_name: Optional[str] = Field(default=None, max_length=255)
    tenant_signature_at: Optional[datetime] = None
    tech_signature_url: Optional[str] = None
    tech_signature_name: Optional[str] = Field(default=None, max_length=255)
    tech_signature_at: Optional[datetime] = None
    worker_access_token: str = Field(index=True, unique=True, max_length=64)
    worker_notified_at: Optional[datetime] = None
    worker_notify_error: Optional[str] = None
    worker_email_notified_at: Optional[datetime] = None
    worker_email_notify_error: Optional[str] = None
    manager_notified_at: Optional[datetime] = None
    manager_notify_error: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = Field(default=None, index=True)

    created_by: Optional[User] = Relationship(back_populates="work_orders")
    priority: Optional[Priority] = Relationship(back_populates="work_orders")
    items: list["WorkOrderItem"] = Relationship(
        back_populates="work_order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class WorkOrderItem(SQLModel, table=True):
    __tablename__ = "work_order_items"
    __table_args__ = (UniqueConstraint("work_order_id", "sort_order"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    work_order_id: int = Field(foreign_key="work_orders.id", index=True)
    category: str = Field(max_length=128)
    details: str = ""
    tech_notes: str = ""
    before_photo_url: Optional[str] = None
    after_photo_url: Optional[str] = None
    before_photo_required: bool = Field(default=False)
    before_photo_skipped: bool = False
    after_photo_skipped: bool = False
    resolved: bool = False
    sort_order: int = 0

    work_order: Optional[WorkOrder] = Relationship(back_populates="items")


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    actor_id: Optional[int] = Field(default=None, index=True)
    actor_name: str = Field(max_length=255)
    actor_email: str = Field(max_length=255, index=True)
    actor_role: str = Field(max_length=32, index=True)
    action: str = Field(max_length=64, index=True)
    entity_type: str = Field(max_length=64, index=True)
    entity_id: Optional[str] = Field(default=None, max_length=128, index=True)
    entity_name: Optional[str] = Field(default=None, max_length=255)
    description: str = Field(max_length=1024)
    details: Optional[str] = Field(default=None)
    ip_address: Optional[str] = Field(default=None, max_length=64)
