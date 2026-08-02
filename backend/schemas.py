from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import ProjectStatus, InvoiceStatus, TaskStatus, TaskPriority, PaymentTerms, TimeEntryStatus

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

# ==================== Time Entry Schemas (BTT) ====================

class TimeEntryCreate(BaseModel):
    """Payload for creating a draft time entry (PRD 5.1).

    Fields: project_id (owned by user), work_date (YYYY-MM-DD), duration_minutes
    (>0), description (1..500 after trim), optional billable (default True) and
    hourly_rate_cents (integer cents, >= 0). Validation of value ranges and the
    daily 1440-minute cap happens in the route layer so proper BTT error codes
    can be returned.
    """
    project_id: int
    work_date: str
    duration_minutes: int
    description: str
    billable: Optional[bool] = True
    hourly_rate_cents: Optional[int] = None

class TimeEntryUpdate(BaseModel):
    """Payload for editing a draft time entry (PRD 4.3 — draft only).

    All fields optional; only supplied fields are updated. Non-draft edits are
    rejected in the route layer with BTT_E004.
    """
    project_id: Optional[int] = None
    work_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    billable: Optional[bool] = None
    hourly_rate_cents: Optional[int] = None

class TimeEntryTransition(BaseModel):
    """Payload for a state-machine transition (PRD 5.1.6).

    `to_status` must be a legal target (never `written_off` — that uses the
    dedicated write-off endpoint). `reject_reason` is optional and only stored
    when transitioning to `rejected`.
    """
    to_status: TimeEntryStatus
    reject_reason: Optional[str] = None

class TimeEntryWriteOff(BaseModel):
    """Payload for writing off an approved billable entry to an invoice (M3)."""
    invoice_id: int

class TimeEntryStatsSummary(BaseModel):
    """Billable-time dashboard metrics (PRD 5.3.9 / chapter 9).

    Attributes:
        week_approved_unwritten_minutes: Minutes of `approved` (not yet
            written-off) entries dated this week (Monday..today).
        month_written_off_amount_cents: Total written-off amount in integer
            cents for entries written off during the current month.
    """
    week_approved_unwritten_minutes: int
    month_written_off_amount_cents: int

class TimeEntryResponse(BaseModel):
    """Serialized time entry with derived read-only `amount_cents` (PRD 3.2)."""
    id: int
    owner_id: int
    project_id: int
    project_name: Optional[str] = None
    work_date: str
    duration_minutes: int
    description: str
    billable: bool
    hourly_rate_cents: Optional[int]
    status: str
    reject_reason: Optional[str]
    invoice_id: Optional[int]
    written_off_at: Optional[datetime]
    amount_cents: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
