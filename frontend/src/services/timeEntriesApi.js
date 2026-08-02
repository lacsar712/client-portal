// API + business-rule layer for the BTT (Billable Time Tracking) module.
// Pages must never call axios/fetch directly (PRD 0.13); they go through this
// service. Uses the shared authenticated axios instance from AuthContext.

import { api } from '../context/AuthContext';

// Frozen route + naming constants (PRD chapter 13).
export const BTT_ROUTE_LIST = '/time-entries';
export const BTT_ROUTE_WEEK = '/time-entries/week';
export const BTT_ERROR_PREFIX = 'BTT_E';
export const BTT_NAV_LABEL = 'Time Tracking';

// Frozen status literals (PRD 0.7 / 13).
export const BTT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WRITTEN_OFF: 'written_off',
};

// Frozen front-end action constants (PRD 0.10).
export const BTT_ACTIONS = {
  CREATE: 'btt/entry/CREATE',
  UPDATE: 'btt/entry/UPDATE',
  SUBMIT: 'btt/entry/SUBMIT',
  APPROVE: 'btt/entry/APPROVE',
  REJECT: 'btt/entry/REJECT',
  WRITEOFF: 'btt/entry/WRITEOFF',
  WEEK_LOAD: 'btt/week/LOAD',
};

/**
 * Extract a BTT error code (e.g. "BTT_E002") from an axios error, if present.
 *
 * Handles both the structured `detail: {code, message}` form and the legacy
 * string-`detail` form that merely contains the code substring (PRD appendix F).
 *
 * @param {unknown} error - The caught axios error.
 * @returns {string|null} The BTT error code, or null when none is found.
 */
export function extractBttErrorCode(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.code) return detail.code;
  if (typeof detail === 'string') {
    const match = detail.match(/BTT_E\d{3}/);
    if (match) return match[0];
  }
  return null;
}

/**
 * Fetch time entries for the current user with optional filters (PRD 5.1.2).
 *
 * @param {{project_id?: number, status?: string, date_from?: string,
 *   date_to?: string, billable?: boolean}} [filters] - Optional query filters.
 * @returns {Promise<Array<object>>} List of time-entry response objects.
 */
export async function fetchTimeEntries(filters = {}) {
  const params = {};
  if (filters.project_id) params.project_id = filters.project_id;
  if (filters.status) params.status = filters.status;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.billable !== undefined && filters.billable !== '') {
    params.billable = filters.billable;
  }
  const res = await api.get('/time-entries', { params });
  return res.data;
}

/**
 * Create a draft time entry (PRD 5.1.1).
 *
 * @param {object} payload - `{ project_id, work_date, duration_minutes,
 *   description, billable?, hourly_rate_cents? }`.
 * @returns {Promise<object>} The created time-entry response object.
 */
export async function createTimeEntry(payload) {
  const res = await api.post('/time-entries', payload);
  return res.data;
}

/**
 * Update a draft time entry (PRD 5.1.4; draft-only fields enforced server-side).
 *
 * @param {number} id - The entry id.
 * @param {object} payload - Partial fields to update.
 * @returns {Promise<object>} The updated time-entry response object.
 */
export async function updateTimeEntry(id, payload) {
  const res = await api.put(`/time-entries/${id}`, payload);
  return res.data;
}

/**
 * Delete a draft or rejected time entry (PRD 5.1.5).
 *
 * @param {number} id - The entry id.
 * @returns {Promise<object>} The API acknowledgement.
 */
export async function deleteTimeEntry(id) {
  const res = await api.delete(`/time-entries/${id}`);
  return res.data;
}

/**
 * Run a state-machine transition on an entry (PRD 5.1.6).
 *
 * @param {number} id - The entry id.
 * @param {string} toStatus - Target status literal (never `written_off`).
 * @param {string} [rejectReason] - Optional reason when rejecting.
 * @returns {Promise<object>} The updated time-entry response object.
 */
export async function transitionTimeEntry(id, toStatus, rejectReason) {
  const res = await api.post(`/time-entries/${id}/transition`, {
    to_status: toStatus,
    reject_reason: rejectReason,
  });
  return res.data;
}

/**
 * Fetch the current user's projects for entry selection/filtering.
 *
 * Kept in this service so the time-tracking pages never call axios directly.
 *
 * @returns {Promise<Array<object>>} List of project objects.
 */
export async function fetchProjectsForEntries() {
  const res = await api.get('/projects');
  return res.data;
}

/**
 * Fetch the Monday-anchored 7-day grid for a week (PRD 5.2 / 10.2).
 *
 * @param {string} weekStart - ISO Monday date (YYYY-MM-DD). A non-Monday value
 *   makes the backend return BTT_E008.
 * @returns {Promise<{week_start: string, days: Array<{date: string,
 *   total_minutes: number, entries: Array<object>}>}>} The frozen week shape
 *   with exactly 7 ascending days.
 */
export async function fetchWeek(weekStart) {
  const res = await api.get('/time-entries/week', { params: { week_start: weekStart } });
  return res.data;
}

/**
 * Write off an approved billable entry to an invoice (PRD 5.3.8 / chapter 8).
 *
 * @param {number} id - The entry id.
 * @param {number} invoiceId - Target invoice id (must belong to the user).
 * @returns {Promise<object>} The updated (now `written_off`) entry.
 */
export async function writeOffTimeEntry(id, invoiceId) {
  const res = await api.post(`/time-entries/${id}/write-off`, { invoice_id: invoiceId });
  return res.data;
}

/**
 * Fetch billable-time dashboard metrics (PRD 5.3.9 / chapter 9).
 *
 * @returns {Promise<{week_approved_unwritten_minutes: number,
 *   month_written_off_amount_cents: number}>} The stats summary.
 */
export async function fetchStatsSummary() {
  const res = await api.get('/time-entries/stats/summary');
  return res.data;
}

/**
 * Fetch the current user's invoices for the write-off target selector.
 *
 * Kept in this service so the time-tracking pages never call axios directly.
 *
 * @returns {Promise<Array<object>>} List of invoice objects.
 */
export async function fetchInvoicesForWriteOff() {
  const res = await api.get('/invoices');
  return res.data;
}
