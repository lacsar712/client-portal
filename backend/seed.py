"""
Database seeder - Creates demo user and data on startup
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from auth import get_password_hash
import models

# Demo user credentials
DEMO_EMAIL = "demo@nexus.com"
DEMO_PASSWORD = "demo123"
DEMO_NAME = "Demo User"
DEMO_COMPANY = "Nexus Demo"


def seed_database():
    """Seed database with demo data if empty"""

    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if demo user exists
        existing_user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()

        if existing_user:
            print(f"Demo user already exists: {DEMO_EMAIL}")
            return

        print("Seeding database with demo data...")

        # Create demo user
        demo_user = models.User(
            email=DEMO_EMAIL,
            hashed_password=get_password_hash(DEMO_PASSWORD),
            full_name=DEMO_NAME,
            company_name=DEMO_COMPANY
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

        print(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

        # Create sample clients
        clients_data = [
            {"name": "Acme Corporation", "email": "contact@acme.com", "company": "Acme Corp", "phone": "+1 555-0101", "avatar_color": "#10B981"},
            {"name": "TechStart Inc", "email": "hello@techstart.io", "company": "TechStart", "phone": "+1 555-0102", "avatar_color": "#6366F1"},
            {"name": "Design Studio", "email": "info@designstudio.com", "company": "Design Studio", "phone": "+1 555-0103", "avatar_color": "#F59E0B"},
            {"name": "Global Services", "email": "contact@globalservices.com", "company": "Global Services Ltd", "phone": "+1 555-0104", "avatar_color": "#EF4444"},
            {"name": "StartupXYZ", "email": "team@startupxyz.com", "company": "StartupXYZ", "phone": "+1 555-0105", "avatar_color": "#8B5CF6"},
        ]

        created_clients = []
        for client_data in clients_data:
            client = models.Client(**client_data, owner_id=demo_user.id)
            db.add(client)
            db.commit()
            db.refresh(client)
            created_clients.append(client)

        print(f"Created {len(created_clients)} clients")

        # Create sample projects
        projects_data = [
            {"name": "E-commerce Platform", "description": "Full-stack e-commerce solution with React and FastAPI", "status": models.ProjectStatus.IN_PROGRESS, "budget": 15000, "spent": 8500, "progress": 65, "client_id": created_clients[0].id, "deadline": datetime.now() + timedelta(days=30)},
            {"name": "Mobile App Redesign", "description": "UI/UX overhaul for iOS and Android application", "status": models.ProjectStatus.REVIEW, "budget": 8000, "spent": 7200, "progress": 90, "client_id": created_clients[1].id, "deadline": datetime.now() + timedelta(days=7)},
            {"name": "API Integration", "description": "Third-party API integration with payment gateways", "status": models.ProjectStatus.PLANNING, "budget": 5000, "spent": 0, "progress": 10, "client_id": created_clients[2].id, "deadline": datetime.now() + timedelta(days=45)},
            {"name": "Dashboard Analytics", "description": "Business intelligence dashboard with real-time metrics", "status": models.ProjectStatus.IN_PROGRESS, "budget": 12000, "spent": 4000, "progress": 35, "client_id": created_clients[0].id, "deadline": datetime.now() + timedelta(days=60)},
            {"name": "Brand Website", "description": "Corporate website redesign with CMS", "status": models.ProjectStatus.COMPLETED, "budget": 6000, "spent": 5800, "progress": 100, "client_id": created_clients[3].id, "deadline": datetime.now() - timedelta(days=10)},
            {"name": "CRM System", "description": "Custom CRM system for sales team", "status": models.ProjectStatus.IN_PROGRESS, "budget": 20000, "spent": 12000, "progress": 55, "client_id": created_clients[4].id, "deadline": datetime.now() + timedelta(days=90)},
        ]

        created_projects = []
        for project_data in projects_data:
            project = models.Project(**project_data, owner_id=demo_user.id)
            db.add(project)
            db.commit()
            db.refresh(project)
            created_projects.append(project)

        print(f"Created {len(created_projects)} projects")

        # Create sample tasks for each project
        tasks_by_project = {
            "E-commerce Platform": [
                {"title": "Set up project architecture", "description": "Initialize FastAPI backend with proper folder structure and dependencies", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 4, "actual_hours": 3.5, "position": 1},
                {"title": "Design database schema", "description": "Create SQLAlchemy models for products, users, orders, and payments", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 6, "actual_hours": 5, "position": 2},
                {"title": "Implement user authentication", "description": "JWT-based auth with registration, login, and password reset", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 8, "actual_hours": 10, "position": 3},
                {"title": "Build product catalog API", "description": "CRUD endpoints for products with filtering and pagination", "status": models.TaskStatus.IN_PROGRESS, "priority": models.TaskPriority.HIGH, "estimated_hours": 12, "actual_hours": 6, "position": 4, "due_date": datetime.now() + timedelta(days=5)},
                {"title": "Shopping cart functionality", "description": "Add to cart, update quantities, remove items", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.HIGH, "estimated_hours": 8, "position": 5, "due_date": datetime.now() + timedelta(days=10)},
                {"title": "Payment gateway integration", "description": "Integrate Stripe for payment processing", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.URGENT, "estimated_hours": 16, "position": 6, "due_date": datetime.now() + timedelta(days=15)},
                {"title": "Order management system", "description": "Order placement, tracking, and history", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 10, "position": 7, "due_date": datetime.now() + timedelta(days=20)},
                {"title": "Admin dashboard", "description": "Dashboard for managing products and orders", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.LOW, "estimated_hours": 12, "position": 8, "due_date": datetime.now() + timedelta(days=25)},
            ],
            "Mobile App Redesign": [
                {"title": "User research & interviews", "description": "Conduct 10 user interviews to understand pain points", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 8, "actual_hours": 10, "position": 1},
                {"title": "Competitive analysis", "description": "Analyze top 5 competitor apps for best practices", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 4, "actual_hours": 5, "position": 2},
                {"title": "Create wireframes", "description": "Low-fidelity wireframes for all main screens", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 12, "actual_hours": 14, "position": 3},
                {"title": "Design system setup", "description": "Create color palette, typography, and component library", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 8, "actual_hours": 6, "position": 4},
                {"title": "High-fidelity mockups", "description": "Detailed designs for iOS and Android", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 20, "actual_hours": 22, "position": 5},
                {"title": "Interactive prototype", "description": "Figma prototype for user testing", "status": models.TaskStatus.IN_PROGRESS, "priority": models.TaskPriority.HIGH, "estimated_hours": 6, "actual_hours": 4, "position": 6, "due_date": datetime.now() + timedelta(days=3)},
                {"title": "Client review & revisions", "description": "Present designs and incorporate feedback", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 4, "position": 7, "due_date": datetime.now() + timedelta(days=5)},
            ],
            "API Integration": [
                {"title": "Requirements gathering", "description": "Document all third-party APIs to be integrated", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 3, "actual_hours": 2, "position": 1},
                {"title": "API documentation review", "description": "Review Stripe, Twilio, and SendGrid API docs", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.HIGH, "estimated_hours": 4, "position": 2, "due_date": datetime.now() + timedelta(days=7)},
                {"title": "Set up sandbox environments", "description": "Configure test accounts for all services", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 2, "position": 3, "due_date": datetime.now() + timedelta(days=10)},
                {"title": "Implement Stripe integration", "description": "Payment processing with webhooks", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.URGENT, "estimated_hours": 12, "position": 4, "due_date": datetime.now() + timedelta(days=20)},
                {"title": "Implement Twilio SMS", "description": "SMS notifications for order updates", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 6, "position": 5, "due_date": datetime.now() + timedelta(days=30)},
                {"title": "Implement SendGrid emails", "description": "Transactional email templates and sending", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 8, "position": 6, "due_date": datetime.now() + timedelta(days=35)},
            ],
            "Dashboard Analytics": [
                {"title": "Define KPIs and metrics", "description": "Work with stakeholders to identify key metrics", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 4, "actual_hours": 6, "position": 1},
                {"title": "Data source analysis", "description": "Identify and document all data sources", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 3, "actual_hours": 4, "position": 2},
                {"title": "ETL pipeline design", "description": "Design data extraction and transformation flow", "status": models.TaskStatus.IN_PROGRESS, "priority": models.TaskPriority.HIGH, "estimated_hours": 8, "actual_hours": 3, "position": 3, "due_date": datetime.now() + timedelta(days=7)},
                {"title": "Build data models", "description": "Create aggregated tables for dashboard queries", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.HIGH, "estimated_hours": 10, "position": 4, "due_date": datetime.now() + timedelta(days=14)},
                {"title": "Frontend chart components", "description": "Reusable React chart components with Recharts", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 12, "position": 5, "due_date": datetime.now() + timedelta(days=21)},
                {"title": "Real-time data updates", "description": "WebSocket integration for live metrics", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.LOW, "estimated_hours": 8, "position": 6, "due_date": datetime.now() + timedelta(days=35)},
                {"title": "Export functionality", "description": "PDF and CSV export for reports", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.LOW, "estimated_hours": 6, "position": 7, "due_date": datetime.now() + timedelta(days=45)},
            ],
            "Brand Website": [
                {"title": "Content strategy", "description": "Define sitemap and content requirements", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 4, "actual_hours": 4, "position": 1},
                {"title": "Homepage design", "description": "Hero section, features, testimonials", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 8, "actual_hours": 10, "position": 2},
                {"title": "Inner pages design", "description": "About, Services, Contact, Blog pages", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 12, "actual_hours": 14, "position": 3},
                {"title": "CMS setup", "description": "Configure headless CMS for content management", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 6, "actual_hours": 5, "position": 4},
                {"title": "Frontend development", "description": "Build responsive React frontend", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 20, "actual_hours": 18, "position": 5},
                {"title": "SEO optimization", "description": "Meta tags, schema markup, sitemap", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 4, "actual_hours": 3, "position": 6},
                {"title": "Performance optimization", "description": "Image optimization, code splitting, caching", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 4, "actual_hours": 4, "position": 7},
            ],
            "CRM System": [
                {"title": "Requirements documentation", "description": "Gather and document all CRM requirements", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 6, "actual_hours": 8, "position": 1},
                {"title": "Database design", "description": "Design schema for contacts, deals, activities", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.URGENT, "estimated_hours": 8, "actual_hours": 10, "position": 2},
                {"title": "Contact management module", "description": "CRUD for contacts with custom fields", "status": models.TaskStatus.COMPLETED, "priority": models.TaskPriority.HIGH, "estimated_hours": 16, "actual_hours": 14, "position": 3},
                {"title": "Deal pipeline feature", "description": "Kanban board for sales pipeline", "status": models.TaskStatus.IN_PROGRESS, "priority": models.TaskPriority.HIGH, "estimated_hours": 20, "actual_hours": 12, "position": 4, "due_date": datetime.now() + timedelta(days=14)},
                {"title": "Activity tracking", "description": "Log calls, emails, meetings with contacts", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 12, "position": 5, "due_date": datetime.now() + timedelta(days=28)},
                {"title": "Email integration", "description": "Sync with Gmail/Outlook for email tracking", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.MEDIUM, "estimated_hours": 16, "position": 6, "due_date": datetime.now() + timedelta(days=42)},
                {"title": "Reporting dashboard", "description": "Sales reports and forecasting", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.LOW, "estimated_hours": 14, "position": 7, "due_date": datetime.now() + timedelta(days=56)},
                {"title": "Mobile app companion", "description": "React Native app for field sales", "status": models.TaskStatus.TODO, "priority": models.TaskPriority.LOW, "estimated_hours": 40, "position": 8, "due_date": datetime.now() + timedelta(days=90)},
            ],
        }

        for project in created_projects:
            if project.name in tasks_by_project:
                for task_data in tasks_by_project[project.name]:
                    task = models.Task(**task_data, project_id=project.id)
                    # Set completed based on status for backward compatibility
                    task.completed = 1 if task.status == models.TaskStatus.COMPLETED else 0
                    db.add(task)

        db.commit()
        print(f"Created tasks for all projects")

        # Create sample invoices with line items
        invoices_with_items = [
            {
                "invoice": {
                    "invoice_number": "INV-2026-0001",
                    "status": models.InvoiceStatus.PAID,
                    "client_id": created_clients[0].id,
                    "project_id": created_projects[0].id,
                    "issue_date": datetime.now() - timedelta(days=60),
                    "due_date": datetime.now() - timedelta(days=30),
                    "paid_date": datetime.now() - timedelta(days=25),
                    "sent_date": datetime.now() - timedelta(days=58),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 10,
                    "notes": "Thank you for your business! Payment is due within 30 days.",
                    "description": "E-commerce Platform - Phase 1 Development"
                },
                "items": [
                    {"description": "Backend API Development", "quantity": 40, "unit_price": 75},
                    {"description": "Database Design & Setup", "quantity": 8, "unit_price": 85},
                    {"description": "User Authentication System", "quantity": 16, "unit_price": 75},
                    {"description": "Project Setup & Configuration", "quantity": 4, "unit_price": 65},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0002",
                    "status": models.InvoiceStatus.PAID,
                    "client_id": created_clients[1].id,
                    "project_id": created_projects[1].id,
                    "issue_date": datetime.now() - timedelta(days=45),
                    "due_date": datetime.now() - timedelta(days=15),
                    "paid_date": datetime.now() - timedelta(days=10),
                    "sent_date": datetime.now() - timedelta(days=43),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 8.5,
                    "notes": "Design deliverables included. Revisions as per contract.",
                    "description": "Mobile App Redesign - Initial Design Phase"
                },
                "items": [
                    {"description": "User Research & Analysis", "quantity": 12, "unit_price": 95},
                    {"description": "Wireframe Design (15 screens)", "quantity": 1, "unit_price": 1200},
                    {"description": "High-Fidelity Mockups", "quantity": 15, "unit_price": 85},
                    {"description": "Design System Creation", "quantity": 1, "unit_price": 800},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0003",
                    "status": models.InvoiceStatus.SENT,
                    "client_id": created_clients[0].id,
                    "project_id": created_projects[0].id,
                    "issue_date": datetime.now() - timedelta(days=5),
                    "due_date": datetime.now() + timedelta(days=25),
                    "sent_date": datetime.now() - timedelta(days=4),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 10,
                    "discount_percent": 5,
                    "notes": "Phase 2 development milestone. 5% early payment discount applied.",
                    "description": "E-commerce Platform - Phase 2 Development"
                },
                "items": [
                    {"description": "Product Catalog Module", "quantity": 24, "unit_price": 75},
                    {"description": "Shopping Cart Implementation", "quantity": 20, "unit_price": 75},
                    {"description": "Checkout Flow Development", "quantity": 16, "unit_price": 80},
                    {"description": "Payment Gateway Integration", "quantity": 12, "unit_price": 90},
                    {"description": "Order Management System", "quantity": 18, "unit_price": 75},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0004",
                    "status": models.InvoiceStatus.DRAFT,
                    "client_id": created_clients[2].id,
                    "project_id": created_projects[2].id,
                    "issue_date": datetime.now(),
                    "due_date": datetime.now() + timedelta(days=30),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 10,
                    "notes": "Initial setup and planning phase.",
                    "description": "API Integration - Project Setup"
                },
                "items": [
                    {"description": "Requirements Analysis", "quantity": 8, "unit_price": 95},
                    {"description": "API Documentation Review", "quantity": 6, "unit_price": 75},
                    {"description": "Development Environment Setup", "quantity": 4, "unit_price": 65},
                    {"description": "Project Planning & Architecture", "quantity": 6, "unit_price": 95},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0005",
                    "status": models.InvoiceStatus.OVERDUE,
                    "client_id": created_clients[3].id,
                    "project_id": created_projects[4].id,
                    "issue_date": datetime.now() - timedelta(days=35),
                    "due_date": datetime.now() - timedelta(days=5),
                    "sent_date": datetime.now() - timedelta(days=34),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 8,
                    "notes": "Final payment for completed website. Please remit payment immediately.",
                    "description": "Brand Website - Final Deliverables"
                },
                "items": [
                    {"description": "Final Development & Testing", "quantity": 20, "unit_price": 75},
                    {"description": "Performance Optimization", "quantity": 8, "unit_price": 85},
                    {"description": "SEO Implementation", "quantity": 6, "unit_price": 80},
                    {"description": "Content Migration", "quantity": 10, "unit_price": 55},
                    {"description": "Training & Documentation", "quantity": 4, "unit_price": 95},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0006",
                    "status": models.InvoiceStatus.SENT,
                    "client_id": created_clients[4].id,
                    "project_id": created_projects[5].id,
                    "issue_date": datetime.now() - timedelta(days=10),
                    "due_date": datetime.now() + timedelta(days=20),
                    "sent_date": datetime.now() - timedelta(days=9),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 10,
                    "notes": "CRM System - Milestone 1 completion. Next milestone upon approval.",
                    "description": "CRM System - Milestone 1"
                },
                "items": [
                    {"description": "Database Architecture", "quantity": 16, "unit_price": 95},
                    {"description": "Contact Management Module", "quantity": 32, "unit_price": 75},
                    {"description": "User Interface Development", "quantity": 40, "unit_price": 70},
                    {"description": "API Development", "quantity": 24, "unit_price": 80},
                    {"description": "Testing & QA", "quantity": 12, "unit_price": 65},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0007",
                    "status": models.InvoiceStatus.PAID,
                    "client_id": created_clients[1].id,
                    "project_id": created_projects[1].id,
                    "issue_date": datetime.now() - timedelta(days=75),
                    "due_date": datetime.now() - timedelta(days=60),
                    "paid_date": datetime.now() - timedelta(days=58),
                    "sent_date": datetime.now() - timedelta(days=74),
                    "payment_terms": models.PaymentTerms.NET_15,
                    "tax_rate": 8.5,
                    "notes": "Initial consultation and discovery phase.",
                    "description": "Mobile App - Consultation & Discovery"
                },
                "items": [
                    {"description": "Initial Consultation (2 sessions)", "quantity": 4, "unit_price": 150},
                    {"description": "Competitive Analysis Report", "quantity": 1, "unit_price": 950},
                    {"description": "User Persona Development", "quantity": 1, "unit_price": 650},
                    {"description": "Project Roadmap Creation", "quantity": 1, "unit_price": 800},
                ]
            },
            {
                "invoice": {
                    "invoice_number": "INV-2026-0008",
                    "status": models.InvoiceStatus.PARTIALLY_PAID,
                    "client_id": created_clients[0].id,
                    "project_id": created_projects[3].id,
                    "issue_date": datetime.now() - timedelta(days=20),
                    "due_date": datetime.now() + timedelta(days=10),
                    "sent_date": datetime.now() - timedelta(days=19),
                    "payment_terms": models.PaymentTerms.NET_30,
                    "tax_rate": 10,
                    "notes": "Dashboard Analytics - Initial development phase.",
                    "description": "Dashboard Analytics - Phase 1"
                },
                "items": [
                    {"description": "Data Pipeline Development", "quantity": 20, "unit_price": 85},
                    {"description": "Chart Components (8 types)", "quantity": 1, "unit_price": 1600},
                    {"description": "Real-time Data Integration", "quantity": 16, "unit_price": 90},
                    {"description": "Dashboard Layout & UX", "quantity": 12, "unit_price": 75},
                ]
            },
        ]

        created_invoices = []
        for inv_data in invoices_with_items:
            # Create invoice
            invoice = models.Invoice(**inv_data["invoice"], owner_id=demo_user.id)
            db.add(invoice)
            db.commit()
            db.refresh(invoice)

            # Add items and calculate totals
            subtotal = 0
            for idx, item_data in enumerate(inv_data["items"]):
                amount = round(item_data["quantity"] * item_data["unit_price"], 2)
                item = models.InvoiceItem(
                    invoice_id=invoice.id,
                    description=item_data["description"],
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    amount=amount,
                    position=idx
                )
                db.add(item)
                subtotal += amount

            # Calculate totals
            discount_amount = subtotal * (invoice.discount_percent / 100) if invoice.discount_percent else 0
            taxable = subtotal - discount_amount
            tax_amount = taxable * (invoice.tax_rate / 100) if invoice.tax_rate else 0
            total = taxable + tax_amount

            invoice.subtotal = round(subtotal, 2)
            invoice.discount_amount = round(discount_amount, 2)
            invoice.tax_amount = round(tax_amount, 2)
            invoice.total = round(total, 2)

            # Set amount paid based on status
            if invoice.status == models.InvoiceStatus.PAID:
                invoice.amount_paid = invoice.total
                invoice.amount_due = 0
            elif invoice.status == models.InvoiceStatus.PARTIALLY_PAID:
                invoice.amount_paid = round(invoice.total * 0.5, 2)  # 50% paid
                invoice.amount_due = round(invoice.total - invoice.amount_paid, 2)
            else:
                invoice.amount_paid = 0
                invoice.amount_due = invoice.total

            db.commit()
            created_invoices.append(invoice)

        print(f"Created {len(created_invoices)} invoices with line items")

        # Create sample activities
        activities_data = [
            {"action": "created", "entity_type": "project", "entity_name": "E-commerce Platform", "created_at": datetime.now() - timedelta(hours=2)},
            {"action": "updated", "entity_type": "invoice", "entity_name": "INV-2024-0001", "details": "Marked as paid", "created_at": datetime.now() - timedelta(hours=4)},
            {"action": "created", "entity_type": "client", "entity_name": "Acme Corporation", "created_at": datetime.now() - timedelta(hours=6)},
            {"action": "updated", "entity_type": "project", "entity_name": "Mobile App Redesign", "details": "Status changed to Review", "created_at": datetime.now() - timedelta(hours=8)},
            {"action": "created", "entity_type": "invoice", "entity_name": "INV-2024-0003", "created_at": datetime.now() - timedelta(hours=10)},
            {"action": "created", "entity_type": "project", "entity_name": "CRM System", "created_at": datetime.now() - timedelta(hours=12)},
            {"action": "updated", "entity_type": "project", "entity_name": "Brand Website", "details": "Marked as completed", "created_at": datetime.now() - timedelta(hours=24)},
            {"action": "created", "entity_type": "client", "entity_name": "StartupXYZ", "created_at": datetime.now() - timedelta(hours=48)},
        ]

        for activity_data in activities_data:
            activity = models.Activity(**activity_data, user_id=demo_user.id)
            db.add(activity)

        db.commit()
        print(f"Created {len(activities_data)} activities")

        print("\n" + "="*50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print(f"Demo Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print("="*50 + "\n")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
