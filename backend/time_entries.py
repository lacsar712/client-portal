"""
BTT (Billable Time Tracking) - TimeEntry API router.

Implements PRD NX-PRD-BTT-2026-08 chapters 0, 3, 4 and 5.1: authenticated
CRUD plus status-machine transitions, mounted at /api/time-entries via
main.py (`app.include_router`). M2 (week view) and M3 (write-off) endpoints
are added in later milestones on top of these same contracts.
"""
import logging
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from btt_constants import (
    BTT_MAX_MINUTES_PER_DAY,
    BTT_E002,
    BTT_E003,
    BTT_E004,
    BTT_E005,
    BTT_E006,
    BTT_E007,
    BTT_E008,
)
from database import get_db
from invoice_utils import calculate_invoice_totals

logger = logging.getLogger("btt")

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"])

# Legal transitions of the TimeEntry status machine (PRD ch.4.1).
# approved -> written_off is deliberately absent: it is only reachable via the
# dedicated write-off API (M3), never via the transition endpoint.
_ALLOWED_TRANSITIONS = frozenset({
    (models.TimeEntryStatus.DRAFT, models.TimeEntryStatus.SUBMITTED),
    (models.TimeEntryStatus.SUBMITTED, models.TimeEntryStatus.APPROVED),
    (models.TimeEntryStatus.SUBMITTED, models.TimeEntryStatus.REJECTED),
    (models.TimeEntryStatus.REJECTED, models.TimeEntryStatus.DRAFT),
})

# Statuses whose entries may be deleted (PRD ch.4.3).
_DELETABLE_STATUSES = frozenset({
    models.TimeEntryStatus.DRAFT,
    models.TimeEntryStatus.REJECTED,
})


def _btt_error(status_code: int, code: str, message: str) -> HTTPException:
    """Build an HTTPException carrying a structured BTT error code (PRD appendix F).

    :param status_code: HTTP status code of the response.
    :param code: BTT error code literal, e.g. "BTT_E002".
    :param message: human-readable explanation.
    :return: HTTPException whose detail is {"code": code, "message": message}.
    """
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _get_owned_entry(entry_id: int, db: Session, current_user: models.User) -> models.TimeEntry:
    """Load a time entry owned by the current user.

    :param entry_id: primary key of the time entry.
    :param db: SQLAlchemy session.
    :param current_user: authenticated user.
    :return: the owned TimeEntry row.
    :raises HTTPException: 404 when missing or owned by another user.
    """
    entry = db.query(models.TimeEntry).filter(
        models.TimeEntry.id == entry_id,
        models.TimeEntry.owner_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return entry


def _get_owned_project(project_id: int, db: Session, current_user: models.User) -> models.Project:
    """Load a project owned by the current user.

    :param project_id: primary key of the project.
    :param db: SQLAlchemy session.
    :param current_user: authenticated user.
    :return: the owned Project row.
    :raises HTTPException: 404 with code BTT_E006 when missing or not owned.
    """
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise _btt_error(404, BTT_E006, "Project does not exist or does not belong to the current user")
    return project


def _daily_minutes_sum(db: Session, owner_id: int, work_date: str, exclude_entry_id: Optional[int] = None) -> int:
    """Sum booked minutes for one owner and day, excluding rejected entries (PRD ch.0.8).

    :param db: SQLAlchemy session.
    :param owner_id: owner user id.
    :param work_date: day in YYYY-MM-DD format.
    :param exclude_entry_id: optional entry id to ignore (used on update).
    :return: total non-rejected duration_minutes already booked on that day.
    """
    query = db.query(func.coalesce(func.sum(models.TimeEntry.duration_minutes), 0)).filter(
        models.TimeEntry.owner_id == owner_id,
        models.TimeEntry.work_date == work_date,
        models.TimeEntry.status != models.TimeEntryStatus.REJECTED,
    )
    if exclude_entry_id is not None:
        query = query.filter(models.TimeEntry.id != exclude_entry_id)
    return int(query.scalar() or 0)


def _assert_daily_limit(db: Session, owner_id: int, work_date: str, additional_minutes: int, exclude_entry_id: Optional[int] = None) -> None:
    """Enforce BTT_MAX_MINUTES_PER_DAY for one owner and day.

    :param db: SQLAlchemy session.
    :param owner_id: owner user id.
    :param work_date: day in YYYY-MM-DD format.
    :param additional_minutes: minutes the pending change would add.
    :param exclude_entry_id: optional entry id to ignore (used on update).
    :raises HTTPException: 400 with code BTT_E002 when the day would exceed the limit.
    """
    current = _daily_minutes_sum(db, owner_id, work_date, exclude_entry_id)
    if current + additional_minutes > BTT_MAX_MINUTES_PER_DAY:
        raise _btt_error(
            400,
            BTT_E002,
            f"Daily limit of {BTT_MAX_MINUTES_PER_DAY} minutes exceeded for {work_date} "
            f"({current} minutes already booked)",
        )


def _compute_amount_cents(entry: models.TimeEntry) -> Optional[int]:
    """Compute the derived billable amount using integer math only (PRD ch.3.2).

    :param entry: TimeEntry row.
    :return: (duration_minutes * hourly_rate_cents) // 60, or None when the
             entry is non-billable or has no hourly rate.
    """
    if not entry.billable or entry.hourly_rate_cents is None:
        return None
    return (entry.duration_minutes * entry.hourly_rate_cents) // 60


def _to_response(entry: models.TimeEntry, db: Session) -> schemas.TimeEntryResponse:
    """Build the API response for a time entry, including derived fields.

    :param entry: TimeEntry row.
    :param db: SQLAlchemy session (used to resolve the project name).
    :return: TimeEntryResponse with amount_cents and project_name populated.
    """
    project = db.query(models.Project).filter(models.Project.id == entry.project_id).first()
    return schemas.TimeEntryResponse(
        **{k: v for k, v in entry.__dict__.items() if not k.startswith("_")},
        amount_cents=_compute_amount_cents(entry),
        project_name=project.name if project else None,
    )


def _parse_week_start(week_start: str) -> List[str]:
    """Validate an ISO-Monday week_start and expand it into 7 calendar days.

    :param week_start: query param, expected as "YYYY-MM-DD" falling on a Monday.
    :return: list of exactly 7 "YYYY-MM-DD" strings, ascending, starting at week_start.
    :raises HTTPException: 422 on malformed dates; 400 with code BTT_E008 when
            the date is valid but not a Monday (PRD ch.5.2 / ch.0.9).
    """
    candidate = week_start.strip() if isinstance(week_start, str) else ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate):
        raise HTTPException(status_code=422, detail="week_start must be a valid date in YYYY-MM-DD format")
    try:
        start = datetime.strptime(candidate, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="week_start must be a valid date in YYYY-MM-DD format")
    if start.weekday() != 0:  # Monday is 0
        raise _btt_error(400, BTT_E008, f"week_start {candidate} is not an ISO Monday")
    return [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]


# ==================== M1 endpoints (PRD ch.5.1) ====================

@router.post("", response_model=schemas.TimeEntryResponse)
def create_time_entry(
    entry: schemas.TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a time entry in status draft (validates project, duration, daily limit)."""
    _get_owned_project(entry.project_id, db, current_user)
    _assert_daily_limit(db, current_user.id, entry.work_date, entry.duration_minutes)

    db_entry = models.TimeEntry(
        **entry.model_dump(),
        status=models.TimeEntryStatus.DRAFT,
        owner_id=current_user.id,
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    logger.info("btt_entry_created id=%s owner=%s", db_entry.id, current_user.id)
    return _to_response(db_entry, db)


@router.get("", response_model=List[schemas.TimeEntryResponse])
def list_time_entries(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    billable: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List the current user's time entries, newest first (work_date desc, id desc)."""
    query = db.query(models.TimeEntry).filter(models.TimeEntry.owner_id == current_user.id)
    if project_id is not None:
        query = query.filter(models.TimeEntry.project_id == project_id)
    if status:
        query = query.filter(models.TimeEntry.status == status)
    if date_from:
        query = query.filter(models.TimeEntry.work_date >= date_from)
    if date_to:
        query = query.filter(models.TimeEntry.work_date <= date_to)
    if billable is not None:
        query = query.filter(models.TimeEntry.billable == billable)

    entries = query.order_by(
        models.TimeEntry.work_date.desc(),
        models.TimeEntry.id.desc(),
    ).all()
    return [_to_response(entry, db) for entry in entries]


# ==================== M2 endpoints (PRD ch.5.2) ====================

@router.get("/week", response_model=schemas.TimeEntryWeekResponse)
def get_time_entries_week(
    week_start: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the 7-day week view starting at an ISO Monday (PRD ch.10.2).

    Days are exactly 7, ascending; each day's total_minutes sums only
    non-rejected entries, mirroring the daily-limit semantics of ch.0.8.
    """
    week_dates = _parse_week_start(week_start)

    entries = db.query(models.TimeEntry).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.work_date >= week_dates[0],
        models.TimeEntry.work_date <= week_dates[-1],
    ).order_by(
        models.TimeEntry.work_date.asc(),
        models.TimeEntry.id.asc(),
    ).all()

    entries_by_date = {}
    for entry in entries:
        entries_by_date.setdefault(entry.work_date, []).append(entry)

    days = []
    for date_str in week_dates:
        day_entries = entries_by_date.get(date_str, [])
        total = sum(
            e.duration_minutes
            for e in day_entries
            if e.status != models.TimeEntryStatus.REJECTED
        )
        days.append(schemas.TimeEntryWeekDay(
            date=date_str,
            total_minutes=total,
            entries=[_to_response(e, db) for e in day_entries],
        ))

    return schemas.TimeEntryWeekResponse(week_start=week_dates[0], days=days)


# NOTE for later milestones: register fixed-path routes ("/week" for M2,
# "/stats/summary" for M3) ABOVE this parameter route, otherwise "week"/"stats"
# would be parsed as entry_id.
@router.get("/{entry_id}", response_model=schemas.TimeEntryResponse)
def get_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Fetch a single time entry owned by the current user."""
    entry = _get_owned_entry(entry_id, db, current_user)
    return _to_response(entry, db)


@router.put("/{entry_id}", response_model=schemas.TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    entry_update: schemas.TimeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a draft time entry; non-draft entries are rejected with BTT_E004 (PRD ch.4.3)."""
    entry = _get_owned_entry(entry_id, db, current_user)
    if entry.status != models.TimeEntryStatus.DRAFT:
        raise _btt_error(
            409,
            BTT_E004,
            f"Only draft entries can be edited (current status: {entry.status.value})",
        )

    update_data = entry_update.model_dump(exclude_unset=True)

    if "project_id" in update_data:
        _get_owned_project(update_data["project_id"], db, current_user)

    new_work_date = update_data.get("work_date", entry.work_date)
    new_duration = update_data.get("duration_minutes", entry.duration_minutes)
    _assert_daily_limit(db, current_user.id, new_work_date, new_duration, exclude_entry_id=entry.id)

    for key, value in update_data.items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)


@router.delete("/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a time entry; only draft and rejected entries are deletable (PRD ch.4.3)."""
    entry = _get_owned_entry(entry_id, db, current_user)
    if entry.status not in _DELETABLE_STATUSES:
        raise _btt_error(
            409,
            BTT_E003,
            f"Entries in status '{entry.status.value}' cannot be deleted",
        )

    db.delete(entry)
    db.commit()
    return {"message": "Time entry deleted successfully"}


@router.post("/{entry_id}/transition", response_model=schemas.TimeEntryResponse)
def transition_time_entry(
    entry_id: int,
    payload: schemas.TimeEntryTransition,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Move a time entry through the status machine (PRD ch.4); written_off is not allowed here."""
    entry = _get_owned_entry(entry_id, db, current_user)
    to_status = payload.to_status

    if to_status == models.TimeEntryStatus.WRITTEN_OFF:
        raise _btt_error(
            409,
            BTT_E003,
            "written_off can only be reached via the dedicated write-off API",
        )
    if (entry.status, to_status) not in _ALLOWED_TRANSITIONS:
        raise _btt_error(
            409,
            BTT_E003,
            f"Illegal transition: {entry.status.value} -> {to_status.value}",
        )

    entry.status = to_status
    if to_status == models.TimeEntryStatus.REJECTED:
        entry.reject_reason = (payload.reject_reason or "").strip() or None
    elif to_status == models.TimeEntryStatus.DRAFT:
        entry.reject_reason = None

    db.commit()
    db.refresh(entry)

    logger.info(
        "btt_transition id=%s owner=%s to=%s",
        entry.id, current_user.id, to_status.value,
    )
    return _to_response(entry, db)


# ==================== M3 endpoints (PRD ch.5.3, ch.8, ch.9) ====================

@router.post("/{entry_id}/write-off", response_model=schemas.TimeEntryResponse)
def write_off_time_entry(
    entry_id: int,
    payload: schemas.TimeEntryWriteOff,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Write off an approved billable entry as one invoice line (PRD ch.8).

    Preconditions: approved + billable (BTT_E005) and hourly_rate_cents > 0
    (BTT_E007). Idempotent per ch.8.4: an already written_off entry fails with
    BTT_E003 and never appends a duplicate invoice line.
    """
    entry = _get_owned_entry(entry_id, db, current_user)

    if entry.status == models.TimeEntryStatus.WRITTEN_OFF:
        raise _btt_error(409, BTT_E003, "Entry is already written_off")
    if entry.status != models.TimeEntryStatus.APPROVED or not entry.billable:
        raise _btt_error(409, BTT_E005, "Only approved entries with billable=true can be written off")
    if entry.hourly_rate_cents is None or entry.hourly_rate_cents <= 0:
        raise _btt_error(409, BTT_E007, "Write-off requires a valid hourly_rate_cents (> 0)")

    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == payload.invoice_id,
        models.Invoice.owner_id == current_user.id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # ch.8.2: integer math only, floor to cents.
    amount_cents = (entry.duration_minutes * entry.hourly_rate_cents) // 60
    # ch.8.3: the invoice model stores float dollars; the TimeEntry side keeps cents.
    dollars = amount_cents / 100

    max_position = db.query(func.max(models.InvoiceItem.position)).filter(
        models.InvoiceItem.invoice_id == invoice.id
    ).scalar() or -1

    db.add(models.InvoiceItem(
        invoice_id=invoice.id,
        description=f"BTT#{entry.id} {entry.work_date} · {entry.description[:80]}",
        quantity=1,
        unit_price=dollars,
        amount=round(dollars, 2),
        position=max_position + 1,
    ))

    entry.status = models.TimeEntryStatus.WRITTEN_OFF
    entry.invoice_id = invoice.id
    entry.written_off_at = datetime.utcnow()

    db.commit()
    calculate_invoice_totals(invoice, db)
    db.refresh(entry)

    logger.info(
        "btt_writeoff_success id=%s invoice=%s amount_cents=%s",
        entry.id, invoice.id, amount_cents,
    )
    return _to_response(entry, db)


@router.get("/stats/summary", response_model=schemas.TimeEntryStatsSummary)
def get_time_entries_stats_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Metrics for the Dashboard "Billable Time" card (PRD ch.9).

    Boundaries use UTC consistently with the stored written_off_at timestamps.
    """
    now = datetime.utcnow()
    week_monday_str = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    today_str = now.strftime("%Y-%m-%d")

    week_minutes = db.query(func.coalesce(func.sum(models.TimeEntry.duration_minutes), 0)).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.status == models.TimeEntryStatus.APPROVED,
        models.TimeEntry.work_date >= week_monday_str,
        models.TimeEntry.work_date <= today_str,
    ).scalar() or 0

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    written_off_entries = db.query(models.TimeEntry).filter(
        models.TimeEntry.owner_id == current_user.id,
        models.TimeEntry.status == models.TimeEntryStatus.WRITTEN_OFF,
        models.TimeEntry.written_off_at >= month_start,
        models.TimeEntry.written_off_at <= now,
    ).all()
    month_amount_cents = sum(
        (e.duration_minutes * (e.hourly_rate_cents or 0)) // 60
        for e in written_off_entries
    )

    return schemas.TimeEntryStatsSummary(
        week_approved_unwritten_minutes=int(week_minutes),
        month_written_off_amount_cents=int(month_amount_cents),
    )
