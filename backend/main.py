from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
from typing import List, Optional
import random

from database import engine, get_db, Base
from config import settings
from seed import seed_database
import models
import schemas
from auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and seed data
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield
    # Shutdown: cleanup if needed
    pass


app = FastAPI(
    title=settings.APP_NAME,
    description="A professional client management and project tracking API",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to log activity
def log_activity(db: Session, user_id: int, action: str, entity_type: str, entity_name: str, details: str = None):
    activity = models.Activity(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        details=details
    )
    db.add(activity)
    db.commit()

# ==================== AUTH ROUTES ====================

@app.post("/api/auth/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    db_user = models.User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        company_name=user.company_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# ==================== CLIENT ROUTES ====================

@app.get("/api/clients", response_model=List[schemas.ClientResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    clients = db.query(models.Client).filter(models.Client.owner_id == current_user.id).all()
    result = []
    for client in clients:
        project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
        total_revenue = db.query(func.sum(models.Invoice.total)).filter(
            models.Invoice.client_id == client.id,
            models.Invoice.status == models.InvoiceStatus.PAID
        ).scalar() or 0

        client_dict = {
            **client.__dict__,
            "project_count": project_count,
            "total_revenue": total_revenue
        }
        result.append(schemas.ClientResponse(**client_dict))
    return result

@app.post("/api/clients", response_model=schemas.ClientResponse)
def create_client(
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_client = models.Client(**client.model_dump(), owner_id=current_user.id)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)

    log_activity(db, current_user.id, "created", "client", client.name)

    return schemas.ClientResponse(**db_client.__dict__, project_count=0, total_revenue=0)

@app.get("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
    total_revenue = db.query(func.sum(models.Invoice.total)).filter(
        models.Invoice.client_id == client.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    return schemas.ClientResponse(**client.__dict__, project_count=project_count, total_revenue=total_revenue)

@app.put("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: int,
    client_update: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for key, value in client_update.model_dump(exclude_unset=True).items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)

    log_activity(db, current_user.id, "updated", "client", client.name)

    project_count = db.query(models.Project).filter(models.Project.client_id == client.id).count()
    total_revenue = db.query(func.sum(models.Invoice.total)).filter(
        models.Invoice.client_id == client.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    return schemas.ClientResponse(**client.__dict__, project_count=project_count, total_revenue=total_revenue)

@app.delete("/api/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.owner_id == current_user.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client_name = client.name
    db.delete(client)
    db.commit()

    log_activity(db, current_user.id, "deleted", "client", client_name)

    return {"message": "Client deleted successfully"}

# ==================== PROJECT ROUTES ====================

@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def get_projects(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Project).filter(models.Project.owner_id == current_user.id)
    if status:
        query = query.filter(models.Project.status == status)

    projects = query.all()
    result = []
    for project in projects:
        client_name = None
        if project.client_id:
            client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
            client_name = client.name if client else None

        tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

        result.append(schemas.ProjectResponse(
            **project.__dict__,
            client_name=client_name,
            tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
        ))
    return result

@app.post("/api/projects", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_project = models.Project(**project.model_dump(), owner_id=current_user.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    log_activity(db, current_user.id, "created", "project", project.name)

    client_name = None
    if db_project.client_id:
        client = db.query(models.Client).filter(models.Client.id == db_project.client_id).first()
        client_name = client.name if client else None

    return schemas.ProjectResponse(**db_project.__dict__, client_name=client_name, tasks=[])

@app.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    client_name = None
    if project.client_id:
        client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
        client_name = client.name if client else None

    tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

    return schemas.ProjectResponse(
        **project.__dict__,
        client_name=client_name,
        tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
    )

@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: int,
    project_update: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for key, value in project_update.model_dump(exclude_unset=True).items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)

    log_activity(db, current_user.id, "updated", "project", project.name)

    client_name = None
    if project.client_id:
        client = db.query(models.Client).filter(models.Client.id == project.client_id).first()
        client_name = client.name if client else None

    tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

    return schemas.ProjectResponse(
        **project.__dict__,
        client_name=client_name,
        tasks=[schemas.TaskResponse(**t.__dict__) for t in tasks]
    )

@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_name = project.name
    db.delete(project)
    db.commit()

    log_activity(db, current_user.id, "deleted", "project", project_name)

    return {"message": "Project deleted successfully"}

# Task routes
@app.post("/api/projects/{project_id}/tasks", response_model=schemas.TaskResponse)
def create_task(
    project_id: int,
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get max position for ordering
    max_position = db.query(func.max(models.Task.position)).filter(
        models.Task.project_id == project_id
    ).scalar() or 0

    task_data = task.model_dump()
    task_data["position"] = max_position + 1

    db_task = models.Task(**task_data, project_id=project_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Update project progress
    _update_project_progress(db, project)

    return schemas.TaskResponse(**db_task.__dict__)

@app.get("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return schemas.TaskResponse(**task.__dict__)

@app.put("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)

    # Sync completed field with status for backward compatibility
    if "status" in update_data:
        if update_data["status"] == models.TaskStatus.COMPLETED:
            update_data["completed"] = 1
        else:
            update_data["completed"] = 0

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)

    # Update project progress
    _update_project_progress(db, task.project)

    return schemas.TaskResponse(**task.__dict__)

@app.put("/api/tasks/{task_id}/toggle")
def toggle_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Legacy toggle endpoint - toggles between TODO and COMPLETED"""
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Toggle between TODO and COMPLETED
    if task.status == models.TaskStatus.COMPLETED:
        task.status = models.TaskStatus.TODO
        task.completed = 0
    else:
        task.status = models.TaskStatus.COMPLETED
        task.completed = 1

    db.commit()

    # Update project progress
    project = task.project
    _update_project_progress(db, project)

    return {"completed": task.completed, "status": task.status.value, "project_progress": project.progress}

@app.put("/api/projects/{project_id}/tasks/reorder")
def reorder_tasks(
    project_id: int,
    task_order: List[int],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Reorder tasks by providing new position order"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for position, task_id in enumerate(task_order):
        task = db.query(models.Task).filter(
            models.Task.id == task_id,
            models.Task.project_id == project_id
        ).first()
        if task:
            task.position = position

    db.commit()
    return {"message": "Tasks reordered successfully"}

@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).join(models.Project).filter(
        models.Task.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = task.project
    db.delete(task)
    db.commit()

    # Update project progress
    _update_project_progress(db, project)

    return {"message": "Task deleted successfully"}

def _update_project_progress(db: Session, project: models.Project):
    """Helper function to update project progress based on completed tasks"""
    all_tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()
    if all_tasks:
        completed = sum(1 for t in all_tasks if t.status == models.TaskStatus.COMPLETED)
        project.progress = int((completed / len(all_tasks)) * 100)
    else:
        project.progress = 0
    db.commit()

# ==================== INVOICE ROUTES ====================

def _calculate_invoice_totals(invoice: models.Invoice, db: Session):
    """Calculate invoice totals based on items"""
    items = db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).all()

    subtotal = sum(item.amount for item in items)
    discount_amount = subtotal * (invoice.discount_percent / 100) if invoice.discount_percent else 0
    taxable_amount = subtotal - discount_amount
    tax_amount = taxable_amount * (invoice.tax_rate / 100) if invoice.tax_rate else 0
    total = taxable_amount + tax_amount
    amount_due = total - invoice.amount_paid

    invoice.subtotal = round(subtotal, 2)
    invoice.discount_amount = round(discount_amount, 2)
    invoice.tax_amount = round(tax_amount, 2)
    invoice.total = round(total, 2)
    invoice.amount_due = round(amount_due, 2)

    db.commit()

def _get_invoice_response(invoice: models.Invoice, db: Session) -> schemas.InvoiceResponse:
    """Build invoice response with related data"""
    client = db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
    project = None
    if invoice.project_id:
        project = db.query(models.Project).filter(models.Project.id == invoice.project_id).first()

    items = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.invoice_id == invoice.id
    ).order_by(models.InvoiceItem.position).all()

    return schemas.InvoiceResponse(
        **{k: v for k, v in invoice.__dict__.items() if not k.startswith('_')},
        client_name=client.name if client else None,
        project_name=project.name if project else None,
        items=[schemas.InvoiceItemResponse(**{k: v for k, v in item.__dict__.items() if not k.startswith('_')}) for item in items]
    )

def _calculate_due_date(issue_date: datetime, payment_terms: models.PaymentTerms) -> datetime:
    """Calculate due date based on payment terms"""
    days_map = {
        models.PaymentTerms.DUE_ON_RECEIPT: 0,
        models.PaymentTerms.NET_7: 7,
        models.PaymentTerms.NET_15: 15,
        models.PaymentTerms.NET_30: 30,
        models.PaymentTerms.NET_60: 60,
        models.PaymentTerms.CUSTOM: 30,
    }
    days = days_map.get(payment_terms, 30)
    return issue_date + timedelta(days=days)

@app.get("/api/invoices", response_model=List[schemas.InvoiceResponse])
def get_invoices(
    status: str = None,
    client_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id)
    if status:
        query = query.filter(models.Invoice.status == status)
    if client_id:
        query = query.filter(models.Invoice.client_id == client_id)

    invoices = query.order_by(models.Invoice.created_at.desc()).all()
    return [_get_invoice_response(inv, db) for inv in invoices]

@app.get("/api/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return _get_invoice_response(invoice, db)

@app.post("/api/invoices", response_model=schemas.InvoiceResponse)
def create_invoice(
    invoice: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Generate invoice number
    count = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id).count()
    invoice_number = f"INV-{datetime.now().year}-{str(count + 1).zfill(4)}"

    issue_date = invoice.issue_date or datetime.utcnow()
    payment_terms = invoice.payment_terms or models.PaymentTerms.NET_30
    due_date = invoice.due_date or _calculate_due_date(issue_date, payment_terms)

    # Create invoice without items
    invoice_data = invoice.model_dump(exclude={'items'})
    db_invoice = models.Invoice(
        **invoice_data,
        invoice_number=invoice_number,
        issue_date=issue_date,
        due_date=due_date,
        owner_id=current_user.id
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    # Add items if provided
    if invoice.items:
        for idx, item in enumerate(invoice.items):
            db_item = models.InvoiceItem(
                invoice_id=db_invoice.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=round(item.quantity * item.unit_price, 2),
                position=idx
            )
            db.add(db_item)
        db.commit()

    # Calculate totals
    _calculate_invoice_totals(db_invoice, db)

    log_activity(db, current_user.id, "created", "invoice", invoice_number, f"${db_invoice.total}")

    return _get_invoice_response(db_invoice, db)

@app.put("/api/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_update: schemas.InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = invoice_update.model_dump(exclude_unset=True)

    # Handle status changes
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == models.InvoiceStatus.PAID and not invoice.paid_date:
            update_data["paid_date"] = datetime.utcnow()
            update_data["amount_paid"] = invoice.total
        elif new_status == models.InvoiceStatus.SENT and not invoice.sent_date:
            update_data["sent_date"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(invoice, key, value)

    db.commit()

    # Recalculate totals if tax or discount changed
    if "tax_rate" in update_data or "discount_percent" in update_data or "amount_paid" in update_data:
        _calculate_invoice_totals(invoice, db)

    db.refresh(invoice)

    log_activity(db, current_user.id, "updated", "invoice", invoice.invoice_number)

    return _get_invoice_response(invoice, db)

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_number = invoice.invoice_number
    db.delete(invoice)
    db.commit()

    log_activity(db, current_user.id, "deleted", "invoice", invoice_number)

    return {"message": "Invoice deleted successfully"}

# Invoice status actions
@app.post("/api/invoices/{invoice_id}/send", response_model=schemas.InvoiceResponse)
def send_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = models.InvoiceStatus.SENT
    invoice.sent_date = datetime.utcnow()
    db.commit()
    db.refresh(invoice)

    log_activity(db, current_user.id, "sent", "invoice", invoice.invoice_number)

    return _get_invoice_response(invoice, db)

@app.post("/api/invoices/{invoice_id}/payment", response_model=schemas.InvoiceResponse)
def record_payment(
    invoice_id: int,
    payment: schemas.InvoicePayment,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.amount_paid = invoice.amount_paid + payment.amount
    invoice.amount_due = invoice.total - invoice.amount_paid

    # Update status based on payment
    if invoice.amount_due <= 0:
        invoice.status = models.InvoiceStatus.PAID
        invoice.paid_date = payment.payment_date or datetime.utcnow()
    elif invoice.amount_paid > 0:
        invoice.status = models.InvoiceStatus.PARTIALLY_PAID

    db.commit()
    db.refresh(invoice)

    log_activity(db, current_user.id, "payment", "invoice", invoice.invoice_number, f"${payment.amount}")

    return _get_invoice_response(invoice, db)

@app.post("/api/invoices/{invoice_id}/duplicate", response_model=schemas.InvoiceResponse)
def duplicate_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Generate new invoice number
    count = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id).count()
    invoice_number = f"INV-{datetime.now().year}-{str(count + 1).zfill(4)}"

    # Create new invoice
    new_invoice = models.Invoice(
        invoice_number=invoice_number,
        status=models.InvoiceStatus.DRAFT,
        issue_date=datetime.utcnow(),
        due_date=_calculate_due_date(datetime.utcnow(), invoice.payment_terms),
        payment_terms=invoice.payment_terms,
        tax_rate=invoice.tax_rate,
        discount_percent=invoice.discount_percent,
        notes=invoice.notes,
        description=invoice.description,
        owner_id=current_user.id,
        client_id=invoice.client_id,
        project_id=invoice.project_id
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    # Duplicate items
    items = db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).all()
    for item in items:
        new_item = models.InvoiceItem(
            invoice_id=new_invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.amount,
            position=item.position
        )
        db.add(new_item)
    db.commit()

    _calculate_invoice_totals(new_invoice, db)

    log_activity(db, current_user.id, "duplicated", "invoice", invoice_number, f"from {invoice.invoice_number}")

    return _get_invoice_response(new_invoice, db)

# Invoice items routes
@app.post("/api/invoices/{invoice_id}/items", response_model=schemas.InvoiceItemResponse)
def add_invoice_item(
    invoice_id: int,
    item: schemas.InvoiceItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Get max position
    max_position = db.query(func.max(models.InvoiceItem.position)).filter(
        models.InvoiceItem.invoice_id == invoice_id
    ).scalar() or -1

    db_item = models.InvoiceItem(
        invoice_id=invoice_id,
        description=item.description,
        quantity=item.quantity,
        unit_price=item.unit_price,
        amount=round(item.quantity * item.unit_price, 2),
        position=max_position + 1
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    _calculate_invoice_totals(invoice, db)

    return schemas.InvoiceItemResponse(**{k: v for k, v in db_item.__dict__.items() if not k.startswith('_')})

@app.put("/api/invoices/{invoice_id}/items/{item_id}", response_model=schemas.InvoiceItemResponse)
def update_invoice_item(
    invoice_id: int,
    item_id: int,
    item_update: schemas.InvoiceItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    item = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.id == item_id,
        models.InvoiceItem.invoice_id == invoice_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    # Recalculate amount
    item.amount = round(item.quantity * item.unit_price, 2)

    db.commit()
    db.refresh(item)

    _calculate_invoice_totals(invoice, db)

    return schemas.InvoiceItemResponse(**{k: v for k, v in item.__dict__.items() if not k.startswith('_')})

@app.delete("/api/invoices/{invoice_id}/items/{item_id}")
def delete_invoice_item(
    invoice_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    item = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.id == item_id,
        models.InvoiceItem.invoice_id == invoice_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    _calculate_invoice_totals(invoice, db)

    return {"message": "Item deleted successfully"}

# ==================== BTT (Billable Time Tracking) ROUTES ====================

BTT_ALLOWED_TRANSITIONS = {
    models.TimeEntryStatus.DRAFT: {models.TimeEntryStatus.SUBMITTED},
    models.TimeEntryStatus.SUBMITTED: {models.TimeEntryStatus.APPROVED, models.TimeEntryStatus.REJECTED},
    models.TimeEntryStatus.REJECTED: {models.TimeEntryStatus.DRAFT},
    models.TimeEntryStatus.APPROVED: set(),
    models.TimeEntryStatus.WRITTEN_OFF: set(),
}


def btt_error(code: str, message: str, http_status: int = 400):
    """Raise an HTTPException whose detail contains the BTT error code.

    Args:
        code: BTT error code, e.g. ``BTT_E002``.
        message: Human-readable description.
        http_status: HTTP status code to return.

    Returns:
        None; raises ``HTTPException``.
    """
    raise HTTPException(
        status_code=http_status,
        detail={"code": code, "message": f"{code}: {message}"}
    )


def _compute_amount_cents(entry: models.TimeEntry) -> Optional[int]:
    """Compute the derived amount in cents using integer arithmetic.

    Args:
        entry: The TimeEntry ORM instance.

    Returns:
        ``(duration_minutes * hourly_rate_cents) // 60`` when billable and
        hourly_rate_cents is set, otherwise ``None``.
    """
    if entry.billable and entry.hourly_rate_cents is not None and entry.hourly_rate_cents > 0:
        return (entry.duration_minutes * entry.hourly_rate_cents) // 60
    return None


def _entry_to_response(db: Session, entry: models.TimeEntry) -> schemas.TimeEntryResponse:
    """Build a TimeEntryResponse with project_name and computed amount_cents.

    Args:
        db: Database session.
        entry: The TimeEntry ORM instance.

    Returns:
        A fully populated TimeEntryResponse schema.
    """
    project = db.query(models.Project).filter(models.Project.id == entry.project_id).first()
    return schemas.TimeEntryResponse(
        **{k: v for k, v in entry.__dict__.items() if not k.startswith('_')},
        project_name=project.name if project else None,
        amount_cents=_compute_amount_cents(entry)
    )


def _check_daily_limit(db: Session, owner_id: int, work_date: date, duration_minutes: int, exclude_entry_id: Optional[int] = None):
    """Verify that adding duration_minutes on work_date does not exceed 1440.

    Only non-rejected entries are counted. Raises BTT_E002 on overflow.

    Args:
        db: Database session.
        owner_id: The owning user's id.
        work_date: The date to check.
        duration_minutes: Additional minutes to add.
        exclude_entry_id: Optional entry id to exclude (for updates).
    """
    query = db.query(func.coalesce(func.sum(models.TimeEntry.duration_minutes), 0)).filter(
        models.TimeEntry.owner_id == owner_id,
        models.TimeEntry.work_date == work_date,
        models.TimeEntry.status != models.TimeEntryStatus.REJECTED
    )
    if exclude_entry_id is not None:
        query = query.filter(models.TimeEntry.id != exclude_entry_id)
    existing = query.scalar() or 0
    if existing + duration_minutes > models.BTT_MAX_MINUTES_PER_DAY:
        btt_error("BTT_E002", f"Daily limit of {models.BTT_MAX_MINUTES_PER_DAY} minutes exceeded", 409)


def _validate_project_ownership(db: Session, project_id: int, user_id: int) -> models.Project:
    """Ensure a project exists and belongs to the current user.

    Args:
        db: Database session.
        project_id: Project id to look up.
        user_id: Current user's id.

    Returns:
        The Project ORM instance if valid.

    Raises:
        HTTPException: BTT_E006 if the project is missing or not owned.
    """
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == user_id
    ).first()
    if not project:
        btt_error("BTT_E006", "Project not found or does not belong to current user", 404)
    return project


@app.post("/api/time-entries", response_model=schemas.TimeEntryResponse, status_code=201)
def create_time_entry(
    payload: schemas.TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new draft time entry for the current user.

    Validates duration, description length, project ownership and the
    per-day 1440-minute cap.

    Args:
        payload: TimeEntryCreate request body.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The created TimeEntryResponse.
    """
    _validate_project_ownership(db, payload.project_id, current_user.id)

    desc = payload.description.strip()
    if len(desc) > models.BTT_DESC_MAX:
        btt_error("BTT_E001", f"Description must be at most {models.BTT_DESC_MAX} characters", 400)

    _check_daily_limit(db, current_user.id, payload.work_date, payload.duration_minutes)

    entry = models.TimeEntry(
        owner_id=current_user.id,
        project_id=payload.project_id,
        work_date=payload.work_date,
        duration_minutes=payload.duration_minutes,
        description=desc,
        billable=payload.billable,
        hourly_rate_cents=payload.hourly_rate_cents,
        status=models.TimeEntryStatus.DRAFT
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    print(f"btt_entry_created: id={entry.id} owner={current_user.id}")
    return _entry_to_response(db, entry)


@app.get("/api/time-entries", response_model=List[schemas.TimeEntryResponse])
def list_time_entries(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    billable: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List time entries for the current user with optional filters.

    Results are ordered by ``work_date DESC, id DESC``.

    Args:
        project_id: Filter by project id.
        status: Filter by status literal.
        date_from: Inclusive lower bound for work_date.
        date_to: Inclusive upper bound for work_date.
        billable: Filter by billable flag.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        A list of TimeEntryResponse objects.
    """
    query = db.query(models.TimeEntry).filter(models.TimeEntry.owner_id == current_user.id)
    if project_id is not None:
        query = query.filter(models.TimeEntry.project_id == project_id)
    if status is not None:
        query = query.filter(models.TimeEntry.status == status)
    if date_from is not None:
        query = query.filter(models.TimeEntry.work_date >= date_from)
    if date_to is not None:
        query = query.filter(models.TimeEntry.work_date <= date_to)
    if billable is not None:
        query = query.filter(models.TimeEntry.billable == billable)

    entries = query.order_by(
        models.TimeEntry.work_date.desc(),
        models.TimeEntry.id.desc()
    ).all()
    return [_entry_to_response(db, e) for e in entries]


@app.get("/api/time-entries/week", response_model=schemas.TimeEntryWeekResponse)
def get_time_entries_week(
    week_start: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Return a 7-day week grid starting at ``week_start`` (ISO Monday).

    The response always contains exactly 7 day buckets in ascending date
    order. Each bucket includes the day's total minutes (across all statuses
    including rejected for display) and its entries ordered by id ascending.

    Args:
        week_start: The Monday that starts the week (``YYYY-MM-DD``).
        db: Database session.
        current_user: The authenticated user.

    Returns:
        TimeEntryWeekResponse with ``week_start`` and a 7-element ``days`` array.

    Raises:
        HTTPException: BTT_E008 if ``week_start`` is not an ISO Monday.
    """
    if week_start.weekday() != 0:
        btt_error("BTT_E008", "week_start must be an ISO Monday (weekday() == 0)", 400)

    week_end = week_start + timedelta(days=6)

    rows = db.query(models.TimeEntry).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.work_date >= week_start,
        models.TimeEntry.work_date <= week_end
    ).order_by(
        models.TimeEntry.work_date.asc(),
        models.TimeEntry.id.asc()
    ).all()

    by_date = {}
    for row in rows:
        by_date.setdefault(row.work_date, []).append(row)

    days = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        day_entries = by_date.get(d, [])
        total = sum(e.duration_minutes for e in day_entries)
        days.append(schemas.TimeEntryWeekDay(
            date=d,
            total_minutes=total,
            entries=[_entry_to_response(db, e) for e in day_entries]
        ))

    return schemas.TimeEntryWeekResponse(week_start=week_start, days=days)


@app.get("/api/time-entries/stats/summary", response_model=schemas.TimeEntryStatsSummary)
def get_time_entries_stats_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Return BTT summary metrics for the Dashboard (M3).

    - ``week_approved_unwritten_minutes``: sum of duration_minutes for entries
      created on or after this week's Monday (inclusive) that are ``approved``
      and not yet written off (``invoice_id IS NULL``).
    - ``month_written_off_amount_cents``: sum of integer-cents amounts for
      entries written off during the current calendar month.

    Args:
        db: Database session.
        current_user: The authenticated user.

    Returns:
        TimeEntryStatsSummary with both integer metrics.
    """
    today = date.today()

    # Monday of the current week (weekday() 0 == Monday)
    this_monday = today - timedelta(days=today.weekday())

    week_minutes = db.query(func.coalesce(func.sum(models.TimeEntry.duration_minutes), 0)).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.status == models.TimeEntryStatus.APPROVED,
        models.TimeEntry.invoice_id.is_(None),
        models.TimeEntry.work_date >= this_monday
    ).scalar() or 0

    # First day of current month
    month_start = today.replace(day=1)

    written_off_entries = db.query(models.TimeEntry).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.status == models.TimeEntryStatus.WRITTEN_OFF,
        models.TimeEntry.written_off_at >= datetime.combine(month_start, datetime.min.time())
    ).all()

    month_cents = 0
    for e in written_off_entries:
        amount = _compute_amount_cents(e)
        if amount is not None:
            month_cents += amount

    return schemas.TimeEntryStatsSummary(
        week_approved_unwritten_minutes=int(week_minutes),
        month_written_off_amount_cents=int(month_cents)
    )


@app.get("/api/time-entries/{entry_id}", response_model=schemas.TimeEntryResponse)
def get_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve a single time entry by id.

    Args:
        entry_id: The TimeEntry id.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The TimeEntryResponse.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return _entry_to_response(db, entry)


@app.put("/api/time-entries/{entry_id}", response_model=schemas.TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    payload: schemas.TimeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an editable field on a draft time entry.

    Only ``draft`` entries may be modified. Non-draft edits raise BTT_E004.

    Args:
        entry_id: The TimeEntry id.
        payload: TimeEntryUpdate request body.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The updated TimeEntryResponse.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if entry.status != models.TimeEntryStatus.DRAFT:
        btt_error("BTT_E004", "Only draft entries can be edited", 409)

    update_data = payload.model_dump(exclude_unset=True)

    if "project_id" in update_data and update_data["project_id"] is not None:
        _validate_project_ownership(db, update_data["project_id"], current_user.id)

    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip()
        if len(update_data["description"]) > models.BTT_DESC_MAX:
            btt_error("BTT_E001", f"Description must be at most {models.BTT_DESC_MAX} characters", 400)

    if "duration_minutes" in update_data or "work_date" in update_data:
        new_duration = update_data.get("duration_minutes", entry.duration_minutes)
        new_date = update_data.get("work_date", entry.work_date)
        _check_daily_limit(db, current_user.id, new_date, new_duration, exclude_entry_id=entry.id)

    for key, value in update_data.items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return _entry_to_response(db, entry)


@app.delete("/api/time-entries/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a time entry.

    Only ``draft`` and ``rejected`` entries may be deleted.

    Args:
        entry_id: The TimeEntry id.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        A success message dict.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if entry.status not in (models.TimeEntryStatus.DRAFT, models.TimeEntryStatus.REJECTED):
        btt_error("BTT_E003", "Only draft or rejected entries can be deleted", 409)

    db.delete(entry)
    db.commit()
    return {"message": "Time entry deleted successfully"}


@app.post("/api/time-entries/{entry_id}/transition", response_model=schemas.TimeEntryResponse)
def transition_time_entry(
    entry_id: int,
    payload: schemas.TimeEntryTransition,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Execute a state-machine transition on a time entry.

    ``written_off`` is not reachable through this endpoint; it requires the
    dedicated write-off API (M3).

    Args:
        entry_id: The TimeEntry id.
        payload: TimeEntryTransition body with ``to_status``.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The updated TimeEntryResponse.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    to_status = payload.to_status

    if to_status == models.TimeEntryStatus.WRITTEN_OFF:
        btt_error("BTT_E003", "written_off is only reachable via the write-off API", 409)

    allowed = BTT_ALLOWED_TRANSITIONS.get(entry.status, set())
    if to_status not in allowed:
        btt_error(
            "BTT_E003",
            f"Illegal transition from {entry.status.value} to {to_status.value}",
            409
        )

    entry.status = to_status
    if to_status == models.TimeEntryStatus.REJECTED:
        entry.reject_reason = (payload.reject_reason or "").strip() or None
    elif to_status == models.TimeEntryStatus.DRAFT:
        entry.reject_reason = None

    db.commit()
    db.refresh(entry)

    print(f"btt_transition: id={entry.id} {entry.status.value}")
    return _entry_to_response(db, entry)


@app.post("/api/time-entries/{entry_id}/write-off", response_model=schemas.TimeEntryResponse)
def write_off_time_entry(
    entry_id: int,
    payload: schemas.TimeEntryWriteOff,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Write off an approved billable time entry onto an invoice (M3).

    Preconditions (Chapter 8):
    - entry must belong to current user
    - entry.status must be ``approved``
    - entry.billable must be ``True``
    - entry.hourly_rate_cents must be > 0
    - target invoice must belong to current user
    - entry must not already be written off (idempotency → BTT_E003)

    On success, appends an InvoiceItem with description
    ``BTT#{id} {work_date} · {description truncated to 80 chars}`` and sets
    the entry's status to ``written_off`` with ``invoice_id`` and
    ``written_off_at`` populated.

    Args:
        entry_id: The TimeEntry id.
        payload: TimeEntryWriteOff body with ``invoice_id``.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The updated TimeEntryResponse.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    # Idempotency: already written off
    if entry.status == models.TimeEntryStatus.WRITTEN_OFF or entry.invoice_id is not None:
        btt_error("BTT_E003", "Time entry has already been written off", 409)

    # Must be approved + billable
    if entry.status != models.TimeEntryStatus.APPROVED or not entry.billable:
        btt_error("BTT_E005", "Only approved billable entries can be written off", 409)

    # Must have a valid hourly rate
    if entry.hourly_rate_cents is None or entry.hourly_rate_cents <= 0:
        btt_error("BTT_E007", "hourly_rate_cents must be greater than 0 for write-off", 409)

    # Validate invoice ownership
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == payload.invoice_id,
        models.Invoice.owner_id == current_user.id
    ).first()
    if not invoice:
        btt_error("BTT_E006", "Invoice not found or does not belong to current user", 404)

    # Integer-cents amount (Chapter 8.2)
    amount_cents = (entry.duration_minutes * entry.hourly_rate_cents) // 60
    amount_dollars = round(amount_cents / 100.0, 2)

    # Description format: BTT#{id} {work_date} · {desc ≤ 80 chars}
    truncated_desc = entry.description[:80]
    line_description = f"BTT#{entry.id} {entry.work_date.isoformat()} · {truncated_desc}"

    # Max position for ordering
    max_position = db.query(func.max(models.InvoiceItem.position)).filter(
        models.InvoiceItem.invoice_id == invoice.id
    ).scalar()
    position = (max_position + 1) if max_position is not None else 0

    hours = round(entry.duration_minutes / 60.0, 2)
    rate_dollars = round(entry.hourly_rate_cents / 100.0, 2)

    db_item = models.InvoiceItem(
        invoice_id=invoice.id,
        description=line_description,
        quantity=hours,
        unit_price=rate_dollars,
        amount=amount_dollars,
        position=position
    )
    db.add(db_item)

    # Update entry state
    entry.status = models.TimeEntryStatus.WRITTEN_OFF
    entry.invoice_id = invoice.id
    entry.written_off_at = datetime.utcnow()

    db.commit()

    # Recalculate invoice totals after adding the line item
    db.refresh(invoice)
    _calculate_invoice_totals(invoice, db)

    db.refresh(entry)

    print(f"btt_writeoff_success: id={entry.id} invoice={invoice.id} cents={amount_cents}")
    return _entry_to_response(db, entry)


# ==================== DASHBOARD ROUTES ====================

@app.get("/api/dashboard", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Total revenue (paid invoices)
    total_revenue = db.query(func.sum(models.Invoice.total)).filter(
        models.Invoice.owner_id == current_user.id,
        models.Invoice.status == models.InvoiceStatus.PAID
    ).scalar() or 0

    # Pending invoices amount
    pending_invoices = db.query(func.sum(models.Invoice.total)).filter(
        models.Invoice.owner_id == current_user.id,
        models.Invoice.status.in_([models.InvoiceStatus.SENT, models.InvoiceStatus.DRAFT])
    ).scalar() or 0

    # Active projects count
    active_projects = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id,
        models.Project.status.in_([models.ProjectStatus.IN_PROGRESS, models.ProjectStatus.REVIEW])
    ).count()

    # Total clients
    total_clients = db.query(models.Client).filter(
        models.Client.owner_id == current_user.id
    ).count()

    # Monthly revenue (last 6 months) - simulated for demo
    months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_revenue = [
        {"month": month, "revenue": random.randint(5000, 25000)}
        for month in months
    ]

    # Project status distribution
    status_counts = db.query(
        models.Project.status,
        func.count(models.Project.id)
    ).filter(
        models.Project.owner_id == current_user.id
    ).group_by(models.Project.status).all()

    status_colors = {
        "planning": "#6366F1",
        "in_progress": "#10B981",
        "review": "#F59E0B",
        "completed": "#3B82F6",
        "on_hold": "#EF4444"
    }

    project_status_distribution = [
        {"status": status.value, "count": count, "color": status_colors.get(status.value, "#6B7280")}
        for status, count in status_counts
    ]

    # Recent activities
    activities = db.query(models.Activity).filter(
        models.Activity.user_id == current_user.id
    ).order_by(models.Activity.created_at.desc()).limit(10).all()

    return schemas.DashboardStats(
        total_revenue=total_revenue,
        pending_invoices=pending_invoices,
        active_projects=active_projects,
        total_clients=total_clients,
        revenue_change=12.5,
        projects_change=3,
        monthly_revenue=monthly_revenue,
        project_status_distribution=project_status_distribution,
        recent_activities=[schemas.ActivityResponse(**a.__dict__) for a in activities]
    )

# ==================== SEED DATA ====================

@app.post("/api/seed")
def seed_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Seed demo data for the current user"""

    # Create sample clients
    clients_data = [
        {"name": "Acme Corporation", "email": "contact@acme.com", "company": "Acme Corp", "avatar_color": "#10B981"},
        {"name": "TechStart Inc", "email": "hello@techstart.io", "company": "TechStart", "avatar_color": "#6366F1"},
        {"name": "Design Studio", "email": "info@designstudio.com", "company": "Design Studio", "avatar_color": "#F59E0B"},
        {"name": "Global Services", "email": "contact@globalservices.com", "company": "Global Services Ltd", "avatar_color": "#EF4444"},
    ]

    created_clients = []
    for client_data in clients_data:
        client = models.Client(**client_data, owner_id=current_user.id)
        db.add(client)
        db.commit()
        db.refresh(client)
        created_clients.append(client)

    # Create sample projects
    projects_data = [
        {"name": "E-commerce Platform", "description": "Full-stack e-commerce solution", "status": models.ProjectStatus.IN_PROGRESS, "budget": 15000, "spent": 8500, "progress": 65, "client_id": created_clients[0].id},
        {"name": "Mobile App Redesign", "description": "UI/UX overhaul for mobile application", "status": models.ProjectStatus.REVIEW, "budget": 8000, "spent": 7200, "progress": 90, "client_id": created_clients[1].id},
        {"name": "API Integration", "description": "Third-party API integration project", "status": models.ProjectStatus.PLANNING, "budget": 5000, "spent": 0, "progress": 10, "client_id": created_clients[2].id},
        {"name": "Dashboard Analytics", "description": "Business intelligence dashboard", "status": models.ProjectStatus.IN_PROGRESS, "budget": 12000, "spent": 4000, "progress": 35, "client_id": created_clients[0].id},
        {"name": "Brand Website", "description": "Corporate website redesign", "status": models.ProjectStatus.COMPLETED, "budget": 6000, "spent": 5800, "progress": 100, "client_id": created_clients[3].id},
    ]

    created_projects = []
    for project_data in projects_data:
        project = models.Project(**project_data, owner_id=current_user.id)
        db.add(project)
        db.commit()
        db.refresh(project)
        created_projects.append(project)

    # Create sample invoices
    invoices_data = [
        {
            "invoice_number": "INV-2024-0001",
            "subtotal": 5000,
            "total": 5000,
            "amount_paid": 5000,
            "amount_due": 0,
            "status": models.InvoiceStatus.PAID,
            "client_id": created_clients[0].id,
            "due_date": datetime.now() - timedelta(days=30),
            "paid_date": datetime.now() - timedelta(days=25),
        },
        {
            "invoice_number": "INV-2024-0002",
            "subtotal": 3500,
            "total": 3500,
            "amount_paid": 3500,
            "amount_due": 0,
            "status": models.InvoiceStatus.PAID,
            "client_id": created_clients[1].id,
            "due_date": datetime.now() - timedelta(days=15),
            "paid_date": datetime.now() - timedelta(days=10),
        },
        {
            "invoice_number": "INV-2024-0003",
            "subtotal": 7200,
            "total": 7200,
            "amount_due": 7200,
            "status": models.InvoiceStatus.SENT,
            "client_id": created_clients[0].id,
            "due_date": datetime.now() + timedelta(days=15),
        },
        {
            "invoice_number": "INV-2024-0004",
            "subtotal": 2500,
            "total": 2500,
            "amount_due": 2500,
            "status": models.InvoiceStatus.DRAFT,
            "client_id": created_clients[2].id,
            "due_date": datetime.now() + timedelta(days=30),
        },
        {
            "invoice_number": "INV-2024-0005",
            "subtotal": 4800,
            "total": 4800,
            "amount_due": 4800,
            "status": models.InvoiceStatus.OVERDUE,
            "client_id": created_clients[3].id,
            "due_date": datetime.now() - timedelta(days=5),
        },
    ]

    for invoice_data in invoices_data:
        invoice = models.Invoice(**invoice_data, owner_id=current_user.id)
        db.add(invoice)

    # Create sample activities
    activities_data = [
        {"action": "created", "entity_type": "project", "entity_name": "E-commerce Platform"},
        {"action": "updated", "entity_type": "invoice", "entity_name": "INV-2024-0001", "details": "Marked as paid"},
        {"action": "created", "entity_type": "client", "entity_name": "Acme Corporation"},
        {"action": "updated", "entity_type": "project", "entity_name": "Mobile App Redesign", "details": "Status changed to Review"},
        {"action": "created", "entity_type": "invoice", "entity_name": "INV-2024-0003"},
    ]

    for i, activity_data in enumerate(activities_data):
        activity = models.Activity(
            **activity_data,
            user_id=current_user.id,
            created_at=datetime.now() - timedelta(hours=i*2)
        )
        db.add(activity)

    db.commit()

    return {"message": "Demo data seeded successfully"}

@app.get("/api/health")
def health_check():
    """Health check endpoint for Docker/k8s"""
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
