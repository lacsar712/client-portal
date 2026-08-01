"""
Shared invoice helpers.

Extracted from main.py so that both the classic invoice routes and the BTT
write-off router recalculate totals with one single implementation
(PRD NX-PRD-BTT-2026-08 ch.12: no parallel/duplicated business logic).
"""
from sqlalchemy.orm import Session

import models


def calculate_invoice_totals(invoice: models.Invoice, db: Session) -> None:
    """Recalculate and persist an invoice's derived totals from its line items.

    :param invoice: the Invoice ORM row to update in place.
    :param db: SQLAlchemy session used to query items and commit.
    :return: None; the invoice row fields (subtotal, discount_amount,
             tax_amount, total, amount_due) are updated and committed.
    """
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
