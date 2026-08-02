/**
 * API service for the BTT (Billable Time Tracking) module.
 *
 * This is the ONLY module permitted to make HTTP calls for time entries.
 * Pages must consume it through `hooks/useTimeEntries.js` and never import
 * axios/fetch directly (PRD 0.13 / 12.3).
 */
import { api } from '../context/AuthContext';

const BASE = '/time-entries';

/**
 * Build a query string from filter parameters, dropping empty values.
 *
 * @param {Object} filters - Query parameters.
 * @param {number|string} [filters.project_id] - Optional project id.
 * @param {string} [filters.status] - Optional status literal.
 * @param {string} [filters.date_from] - Optional inclusive start date (YYYY-MM-DD).
 * @param {string} [filters.date_to] - Optional inclusive end date (YYYY-MM-DD).
 * @param {boolean|string} [filters.billable] - Optional billable flag.
 * @returns {string} The query string (including leading "?" when non-empty).
 */
function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch the current user's time entries.
 *
 * @param {Object} [filters] - Optional filters.
 * @returns {Promise<Array<Object>>} Resolves to an array of time entry objects.
 */
export async function listTimeEntries(filters) {
  const res = await api.get(`${BASE}${buildQuery(filters)}`);
  return res.data;
}

/**
 * Fetch a single time entry by id.
 *
 * @param {number} id - Entry id.
 * @returns {Promise<Object>} The time entry object.
 */
export async function getTimeEntry(id) {
  const res = await api.get(`${BASE}/${id}`);
  return res.data;
}

/**
 * Create a new draft time entry.
 *
 * @param {Object} payload - Entry fields.
 * @param {number} payload.project_id
 * @param {string} payload.work_date - ISO YYYY-MM-DD.
 * @param {number} payload.duration_minutes
 * @param {string} payload.description
 * @param {boolean} [payload.billable]
 * @param {number|null} [payload.hourly_rate_cents]
 * @returns {Promise<Object>} The created entry.
 */
export async function createTimeEntry(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

/**
 * Update an existing (draft) time entry.
 *
 * @param {number} id - Entry id.
 * @param {Object} payload - Fields to update.
 * @returns {Promise<Object>} The updated entry.
 */
export async function updateTimeEntry(id, payload) {
  const res = await api.put(`${BASE}/${id}`, payload);
  return res.data;
}

/**
 * Delete a draft or rejected time entry.
 *
 * @param {number} id - Entry id.
 * @returns {Promise<void>} Resolves when deletion succeeds.
 */
export async function deleteTimeEntry(id) {
  await api.delete(`${BASE}/${id}`);
}

/**
 * Execute a state-machine transition.
 *
 * @param {number} id - Entry id.
 * @param {string} toStatus - Target status literal (never `written_off` here).
 * @param {string} [rejectReason] - Optional reason when rejecting.
 * @returns {Promise<Object>} The updated entry.
 */
export async function transitionTimeEntry(id, toStatus, rejectReason) {
  const body = { to_status: toStatus };
  if (rejectReason !== undefined && rejectReason !== null) {
    body.reject_reason = rejectReason;
  }
  const res = await api.post(`${BASE}/${id}/transition`, body);
  return res.data;
}

/**
 * Fetch the seven-day week grid starting at an ISO Monday.
 *
 * Backend returns exactly 7 day buckets per PRD 10.2 and rejects non-Mondays
 * with BTT_E008 (PRD 5.2 / 0.9).
 *
 * @param {string} weekStart - ISO Monday (`YYYY-MM-DD`).
 * @returns {Promise<{week_start: string, days: Array<{date: string, total_minutes: number, entries: Array<Object>}>}>}
 */
export async function getWeek(weekStart) {
  const res = await api.get(`${BASE}/week`, {
    params: { week_start: weekStart },
  });
  return res.data;
}

/**
 * Write an approved billable entry off onto an invoice (M3, PRD 8).
 *
 * @param {number} id - Entry id.
 * @param {number} invoiceId - Target invoice id (must belong to the user).
 * @returns {Promise<Object>} The updated (written_off) entry.
 */
export async function writeOffTimeEntry(id, invoiceId) {
  const res = await api.post(`${BASE}/${id}/write-off`, { invoice_id: invoiceId });
  return res.data;
}

/**
 * Fetch BTT summary metrics for the Dashboard (M3, PRD 5.3 / 9).
 *
 * @returns {Promise<{week_approved_unwritten_minutes: number, month_written_off_amount_cents: number}>}
 */
export async function getStatsSummary() {
  const res = await api.get(`${BASE}/stats/summary`);
  return res.data;
}

/**
 * Fetch all projects owned by the current user (used to populate the project picker).
 *
 * @returns {Promise<Array<Object>>} Resolves to an array of project objects.
 */
export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}

/**
 * Fetch all invoices owned by the current user (used by the write-off picker).
 *
 * @returns {Promise<Array<Object>>} Resolves to an array of invoice objects.
 */
export async function listInvoices() {
  const res = await api.get('/invoices');
  return res.data;
}
