/**
 * Invoices API service. Reuses the shared authenticated axios instance so that
 * BTT pages/modals never call axios directly (PRD NX-PRD-BTT-2026-08 ch.0.13).
 */
import { api } from '../context/AuthContext';

/**
 * List all invoices of the current user (GET /api/invoices).
 * @returns {Promise<Array<object>>} invoices with id, invoice_number, status, client_name, total, etc.
 */
export async function listInvoices() {
  const res = await api.get('/invoices');
  return res.data;
}
