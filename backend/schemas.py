from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List
import re
from models import ProjectStatus, InvoiceStatus, TaskStatus, TaskPriority, PaymentTerms, TimeEntryStatus
from btt_constants import BTT_DESC_MAX

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    company_name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Client Schemas
class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = "#10B981"

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    company: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    avatar_color: str
    created_at: datetime
    project_count: Optional[int] = 0
    total_revenue: Optional[float] = 0

    class Config:
        from_attributes = True

# Task Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[TaskStatus] = TaskStatus.TODO
    priority: Optional[TaskPriority] = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    position: Optional[int] = 0

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    position: Optional[int] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime]
    estimated_hours: Optional[float]
    actual_hours: float
    position: int
    completed: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Project Schemas

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[ProjectStatus] = ProjectStatus.PLANNING
    budget: Optional[float] = 0
    deadline: Optional[datetime] = None
    client_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[float] = None
    spent: Optional[float] = None
    deadline: Optional[datetime] = None
    progress: Optional[int] = None
    client_id: Optional[int] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    budget: float
    spent: float
    deadline: Optional[datetime]
    progress: int
    created_at: datetime
    updated_at: datetime
    client_id: Optional[int]
    client_name: Optional[str] = None
    tasks: List[TaskResponse] = []

    class Config:
        from_attributes = True

# Invoice Item Schemas
class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0

class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    position: Optional[int] = None

class InvoiceItemResponse(BaseModel):
    id: int
    description: str
    quantity: float
    unit_price: float
    amount: float
    position: int
    created_at: datetime

    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceCreate(BaseModel):
    client_id: int
    project_id: Optional[int] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[PaymentTerms] = PaymentTerms.NET_30
    tax_rate: Optional[float] = 0
    discount_percent: Optional[float] = 0
    notes: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = []

class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[PaymentTerms] = None
    tax_rate: Optional[float] = None
    discount_percent: Optional[float] = None
    notes: Optional[str] = None
    description: Optional[str] = None
    amount_paid: Optional[float] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    status: InvoiceStatus

    # Dates
    issue_date: datetime
    due_date: datetime
    paid_date: Optional[datetime]
    sent_date: Optional[datetime]

    # Payment
    payment_terms: PaymentTerms

    # Amounts
    subtotal: float
    tax_rate: float
    tax_amount: float
    discount_percent: float
    discount_amount: float
    total: float
    amount_paid: float
    amount_due: float

    # Content
    notes: Optional[str]
    description: Optional[str]

    # Relationships
    created_at: datetime
    updated_at: datetime
    client_id: int
    project_id: Optional[int]
    client_name: Optional[str] = None
    project_name: Optional[str] = None
    items: List[InvoiceItemResponse] = []

    class Config:
        from_attributes = True

class InvoicePayment(BaseModel):
    """Schema for recording a payment"""
    amount: float
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None

# Activity Schemas
class ActivityResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_name: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Dashboard Schemas
class DashboardStats(BaseModel):
    total_revenue: float
    pending_invoices: float
    active_projects: int
    total_clients: int
    revenue_change: float
    projects_change: int
    monthly_revenue: List[dict]
    project_status_distribution: List[dict]
    recent_activities: List[ActivityResponse]


# ==================== TimeEntry Schemas (BTT, PRD NX-PRD-BTT-2026-08) ====================

def _validate_duration_minutes(value):
    """Validate a BTT duration.

    :param value: raw input (before Pydantic coercion); numeric strings are coerced.
    :return: duration as a positive int number of minutes.
    :raises ValueError: with code BTT_E001 when the value is not a positive integer.
    """
    if isinstance(value, bool):
        raise ValueError("BTT_E001: duration_minutes must be a positive integer")
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            value = int(stripped)
        else:
            raise ValueError("BTT_E001: duration_minutes must be a positive integer")
    if not isinstance(value, int) or value <= 0:
        raise ValueError("BTT_E001: duration_minutes must be a positive integer (> 0)")
    return value


def _validate_hourly_rate_cents(value):
    """Validate a BTT hourly rate in integer cents.

    :param value: raw input or None; numeric strings are coerced.
    :return: rate as a non-negative int number of cents, or None.
    :raises ValueError: when the value is not an integer or is negative.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("hourly_rate_cents must be an integer number of cents")
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            value = int(stripped)
        else:
            raise ValueError("hourly_rate_cents must be an integer number of cents")
    if not isinstance(value, int) or value < 0:
        raise ValueError("hourly_rate_cents must be an integer >= 0 (cents)")
    return value


def _validate_work_date_str(value):
    """Validate a BTT work date.

    :param value: raw input, expected as "YYYY-MM-DD".
    :return: normalized "YYYY-MM-DD" string.
    :raises ValueError: when the format is wrong or the date does not exist.
    """
    if not isinstance(value, str):
        raise ValueError("work_date must be a string in YYYY-MM-DD format")
    value = value.strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("work_date must be in YYYY-MM-DD format")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise ValueError("work_date must be a valid calendar date in YYYY-MM-DD format")
    return value


def _validate_description_text(value):
    """Validate a BTT description.

    :param value: raw input string.
    :return: trimmed description.
    :raises ValueError: when the trimmed length is not within 1..BTT_DESC_MAX.
    """
    if not isinstance(value, str):
        raise ValueError("description must be a string")
    value = value.strip()
    if not 1 <= len(value) <= BTT_DESC_MAX:
        raise ValueError(f"description must be 1..{BTT_DESC_MAX} characters after trimming")
    return value


class TimeEntryCreate(BaseModel):
    project_id: int
    work_date: str
    duration_minutes: int
    description: str
    billable: Optional[bool] = True
    hourly_rate_cents: Optional[int] = None

    @field_validator("duration_minutes", mode="before")
    @classmethod
    def _check_duration(cls, v):
        return _validate_duration_minutes(v)

    @field_validator("hourly_rate_cents", mode="before")
    @classmethod
    def _check_rate(cls, v):
        return _validate_hourly_rate_cents(v)

    @field_validator("work_date")
    @classmethod
    def _check_work_date(cls, v):
        return _validate_work_date_str(v)

    @field_validator("description")
    @classmethod
    def _check_description(cls, v):
        return _validate_description_text(v)


class TimeEntryUpdate(BaseModel):
    project_id: Optional[int] = None
    work_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    billable: Optional[bool] = None
    hourly_rate_cents: Optional[int] = None

    @field_validator("duration_minutes", mode="before")
    @classmethod
    def _check_duration(cls, v):
        if v is None:
            return None
        return _validate_duration_minutes(v)

    @field_validator("hourly_rate_cents", mode="before")
    @classmethod
    def _check_rate(cls, v):
        return _validate_hourly_rate_cents(v)

    @field_validator("work_date")
    @classmethod
    def _check_work_date(cls, v):
        if v is None:
            return None
        return _validate_work_date_str(v)

    @field_validator("description")
    @classmethod
    def _check_description(cls, v):
        if v is None:
            return None
        return _validate_description_text(v)


class TimeEntryTransition(BaseModel):
    to_status: TimeEntryStatus
    reject_reason: Optional[str] = None


class TimeEntryWriteOff(BaseModel):
    """Contract for the M3 write-off endpoint (PRD ch.5.3); defined now for stability."""
    invoice_id: int


class TimeEntryResponse(BaseModel):
    id: int
    owner_id: int
    project_id: int
    work_date: str
    duration_minutes: int
    description: str
    billable: bool
    hourly_rate_cents: Optional[int]
    status: TimeEntryStatus
    reject_reason: Optional[str]
    invoice_id: Optional[int]
    written_off_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Derived read-only fields (PRD ch.3.2), not persisted
    amount_cents: Optional[int] = None
    project_name: Optional[str] = None

    class Config:
        from_attributes = True


class TimeEntryWeekDay(BaseModel):
    """One day cell of the week view (PRD ch.10.2)."""
    date: str  # YYYY-MM-DD
    total_minutes: int  # sum of non-rejected entries (aligns with ch.0.8)
    entries: List[TimeEntryResponse] = []


class TimeEntryWeekResponse(BaseModel):
    """Week view response (PRD ch.10.2): exactly 7 days, ascending from week_start."""
    week_start: str  # YYYY-MM-DD, ISO Monday
    days: List[TimeEntryWeekDay]


class TimeEntryStatsSummary(BaseModel):
    """Dashboard "Billable Time" card metrics (PRD ch.5.3, ch.9)."""
    week_approved_unwritten_minutes: int  # this ISO week (Mon..today), status approved
    month_written_off_amount_cents: int  # this calendar month, integer cents
