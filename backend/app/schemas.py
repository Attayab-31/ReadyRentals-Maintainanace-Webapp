from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from app.models import UserRole, WorkOrderStatus
from app.time_utils import as_utc


def duration_minutes_between(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    start_utc = as_utc(start)
    end_utc = as_utc(end)
    if start_utc is None or end_utc is None:
        return None
    return int((end_utc - start_utc).total_seconds() // 60)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterOwnerRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6)
    owner_code: str = Field(min_length=1)


class CurrentUserRead(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str


class AdminCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6)


class AdminUserRead(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    work_orders_count: int = 0


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    role: UserRole



class PriorityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    hour_target: int


class ChecklistCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ChecklistCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool


class WorkOrderItemCreate(BaseModel):
    category: str = Field(min_length=1, max_length=128)
    details: str = ""
    resolved: bool = False


class WorkOrderItemUpdate(BaseModel):
    category: Optional[str] = Field(default=None, max_length=128)
    tech_notes: Optional[str] = None
    resolved: Optional[bool] = None
    before_photo_skipped: Optional[bool] = None
    after_photo_skipped: Optional[bool] = None
    sort_order: Optional[int] = None


class WorkOrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_order_id: int
    category: str
    details: str
    tech_notes: str = ""
    before_photo_url: Optional[str] = None
    after_photo_url: Optional[str] = None
    before_photo_skipped: bool = False
    after_photo_skipped: bool = False
    resolved: bool
    sort_order: int


class WorkOrderCreate(BaseModel):
    assigned_to_name: str = Field(min_length=1, max_length=255)
    assigned_to_phone: str = Field(min_length=7, max_length=32)
    date_assigned: date
    service_address: str = Field(min_length=1, max_length=512)
    tenant_names: str = Field(min_length=1, max_length=512)
    tenant_phone: Optional[str] = None
    priority: str = Field(description="emergency | urgent | standard")
    service_date: Optional[date] = None
    items: list[WorkOrderItemCreate] = Field(default_factory=list)


class WorkOrderUpdate(BaseModel):
    assigned_to_name: Optional[str] = None
    assigned_to_phone: Optional[str] = None
    date_assigned: Optional[date] = None
    service_address: Optional[str] = None
    tenant_names: Optional[str] = None
    tenant_phone: Optional[str] = None
    priority: Optional[str] = None
    service_date: Optional[date] = None
    items: Optional[list[WorkOrderItemCreate]] = None


class WorkOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_order_number: str
    created_by_user_id: int
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    assigned_to_name: str
    assigned_to_phone: str
    date_assigned: date
    service_address: str
    tenant_names: str
    tenant_phone: Optional[str] = None
    priority: PriorityRead
    status: WorkOrderStatus
    service_date: Optional[date] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    if_incomplete_explanation: Optional[str] = None
    entire_unit_inspected: Optional[bool] = None
    inspection_results: Optional[str] = None
    tenant_signature_url: Optional[str] = None
    tenant_signature_name: Optional[str] = None
    tenant_signature_at: Optional[datetime] = None
    tech_signature_url: Optional[str] = None
    tech_signature_name: Optional[str] = None
    tech_signature_at: Optional[datetime] = None
    pdf_url: Optional[str] = None
    worker_notified_at: Optional[datetime] = None
    worker_notify_error: Optional[str] = None
    manager_notified_at: Optional[datetime] = None
    manager_notify_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[WorkOrderItemRead] = Field(default_factory=list)
    worker_share_url: Optional[str] = None

    @computed_field
    @property
    def duration_minutes(self) -> Optional[int]:
        return duration_minutes_between(self.start_time, self.end_time)

    @computed_field
    @property
    def within_target(self) -> Optional[bool]:
        duration = self.duration_minutes
        if duration is None:
            return None
        return duration <= self.priority.hour_target * 60


class WorkOrderCreateResponse(WorkOrderRead):
    worker_access_token: str
    worker_share_url: str
    worker_notified_at: Optional[datetime] = None
    worker_notify_error: Optional[str] = None
    manager_notified_at: Optional[datetime] = None
    manager_notify_error: Optional[str] = None


class WorkerWorkOrderRead(BaseModel):
    """Status-gated view for the token-based worker/tenant flow."""

    model_config = ConfigDict(from_attributes=True)

    work_order_number: str
    status: WorkOrderStatus
    assigned_to_name: str
    date_assigned: date
    service_address: str
    tenant_names: str
    tenant_phone: Optional[str] = None
    priority: Optional[PriorityRead] = None
    service_date: Optional[date] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    within_target: Optional[bool] = None
    items: list[WorkOrderItemRead] = Field(default_factory=list)
    if_incomplete_explanation: Optional[str] = None
    entire_unit_inspected: Optional[bool] = None
    inspection_results: Optional[str] = None
    tenant_signature_name: Optional[str] = None
    tenant_signature_at: Optional[datetime] = None
    tenant_signature_url: Optional[str] = None
    tenant_signed: bool = False
    tech_signature_name: Optional[str] = None
    tech_signature_at: Optional[datetime] = None
    tech_signature_url: Optional[str] = None
    tech_signed: bool = False
    pdf_url: Optional[str] = None
    tenant_disclaimer: str = (
        "Tenant confirms to be satisfied with repairs and does not know of any "
        "outstanding hazardous conditions."
    )


class SaveProgressRequest(BaseModel):
    entire_unit_inspected: Optional[bool] = None
    inspection_results: Optional[str] = None


class CompleteWorkOrderRequest(BaseModel):
    entire_unit_inspected: bool
    inspection_results: Optional[str] = None
    if_incomplete_explanation: Optional[str] = None


class SignRequest(BaseModel):
    signer: Literal["tenant", "tech"]
    name: str = Field(min_length=1, max_length=255)
    signature_png_base64: str = Field(min_length=8)


class MessageResponse(BaseModel):
    detail: str
