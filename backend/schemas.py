from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import ProjectStatus, InvoiceStatus, TaskStatus, TaskPriority, PaymentTerms

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
