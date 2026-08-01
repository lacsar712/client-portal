/**
 * BTT API service (PRD NX-PRD-BTT-2026-08 ch.5.1).
 * The only module that talks to /api/time-entries; pages never call axios directly.
 * Reuses the shared authenticated axios instance from AuthContext.
 */
import { api } from '../context/AuthContext';

/**
 * Build query params, dropping empty values.
 * @param {object} filters - raw filter object.
 * @returns {object} params with only non-empty values.
 */
function buildParams(filters) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      params[key] = value;
    }
  });
  return params;
}

/**
 * List time entries of the current user (GET /api/time-entries).
 * @param {{project_id?: number|string, status?: string, date_from?: string, date_to?: string, billable?: boolean}} [filters] - optional filters.
 * @returns {Promise<Array<object>>} time entries ordered by work_date desc, id desc.
 */
export async function listTimeEntries(filters = {}) {
  const res = await api.get('/time-entries', { params: buildParams(filters) });
  return res.data;
}

/**
 * Fetch a single time entry (GET /api/time-entries/{id}).
 * @param {number} id - time entry id.
 * @returns {Promise<object>} the time entry.
 */
export async function getTimeEntry(id) {
  const res = await api.get(`/time-entries/${id}`);
  return res.data;
}

/**
 * Create a draft time entry (POST /api/time-entries).
 * @param {{project_id: number, work_date: string, duration_minutes: number, description: string, billable?: boolean, hourly_rate_cents?: number|null}} payload - entry data; amounts in integer cents.
 * @returns {Promise<object>} the created entry (status "draft").
 */
export async function createTimeEntry(payload) {
  const res = await api.post('/time-entries', payload);
  return res.data;
}

/**
 * Update a draft time entry (PUT /api/time-entries/{id}); only draft entries are editable.
 * @param {number} id - time entry id.
 * @param {object} payload - partial entry fields (project_id, work_date, duration_minutes, description, billable, hourly_rate_cents).
 * @returns {Promise<object>} the updated entry.
 */
export async function updateTimeEntry(id, payload) {
  const res = await api.put(`/time-entries/${id}`, payload);
  return res.data;
}

/**
 * Delete a time entry (DELETE /api/time-entries/{id}); only draft/rejected entries are deletable.
 * @param {number} id - time entry id.
 * @returns {Promise<object>} deletion confirmation message.
 */
export async function deleteTimeEntry(id) {
  const res = await api.delete(`/time-entries/${id}`);
  return res.data;
}

/**
 * Move a time entry through the status machine (POST /api/time-entries/{id}/transition).
 * @param {number} id - time entry id.
 * @param {string} toStatus - target status: "draft" | "submitted" | "approved" | "rejected" (never "written_off").
 * @param {string} [rejectReason] - optional reason stored when rejecting.
 * @returns {Promise<object>} the updated entry.
 */
export async function transitionTimeEntry(id, toStatus, rejectReason) {
  const body = { to_status: toStatus };
  if (rejectReason) body.reject_reason = rejectReason;
  const res = await api.post(`/time-entries/${id}/transition`, body);
  return res.data;
}

/**
 * Fetch the 7-day week view (GET /api/time-entries/week?week_start=...).
 * @param {string} weekStart - ISO Monday in YYYY-MM-DD format; other weekdays fail with BTT_E008.
 * @returns {Promise<{week_start: string, days: Array<{date: string, total_minutes: number, entries: Array<object>}>}>}
 *   week payload with exactly 7 days ascending from week_start.
 */
export async function getTimeEntriesWeek(weekStart) {
  const res = await api.get('/time-entries/week', { params: { week_start: weekStart } });
  return res.data;
}

/**
 * Write off an approved billable entry as one invoice line (POST /api/time-entries/{id}/write-off).
 * @param {number} id - time entry id.
 * @param {number} invoiceId - target invoice id (must belong to the current user).
 * @returns {Promise<object>} the updated entry (status "written_off", with invoice_id/written_off_at set).
 */
export async function writeOffTimeEntry(id, invoiceId) {
  const res = await api.post(`/time-entries/${id}/write-off`, { invoice_id: invoiceId });
  return res.data;
}

/**
 * Fetch the Dashboard "Billable Time" summary (GET /api/time-entries/stats/summary).
 * @returns {Promise<{week_approved_unwritten_minutes: number, month_written_off_amount_cents: number}>}
 *   week approved-unwritten minutes and this month's written-off amount in integer cents.
 */
export async function getTimeEntriesStatsSummary() {
  const res = await api.get('/time-entries/stats/summary');
  return res.data;
}

/**
 * Extract a BTT error code and message from an axios error (PRD appendix F).
 * @param {unknown} err - error thrown by axios.
 * @returns {{code: string|null, message: string}} the BTT code (e.g. "BTT_E002") when present, plus a readable message.
 */
export function extractBttError(err) {
  const detail = err?.response?.data?.detail;

  // Structured form: {"detail": {"code": "BTT_E002", "message": "..."}}
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    if (detail.code) {
      return { code: detail.code, message: detail.message || detail.code };
    }
  }

  // String form containing the code substring.
  if (typeof detail === 'string') {
    const match = detail.match(/BTT_E\d{3}/);
    return { code: match ? match[0] : null, message: detail };
  }

  // FastAPI 422 validation form: [{"loc": [...], "msg": "..."}]
  if (Array.isArray(detail)) {
    const message = detail.map((d) => d?.msg).filter(Boolean).join('; ') || 'Validation error';
    const match = message.match(/BTT_E\d{3}/);
    return { code: match ? match[0] : null, message };
  }

  return { code: null, message: err?.message || 'Request failed' };
}
