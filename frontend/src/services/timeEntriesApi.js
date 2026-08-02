// BTT HTTP service — all axios calls for time entries live here.
// Pages must never import axios directly; they go through useTimeEntries -> this file.

/**
 * @typedef {Object} TimeEntryListFilters
 * @property {number} [project_id] - Filter by project id.
 * @property {string} [status] - Filter by status literal.
 * @property {string} [date_from] - Inclusive start date (YYYY-MM-DD).
 * @property {string} [date_to]   - Inclusive end date (YYYY-MM-DD).
 * @property {boolean} [billable] - Filter by billable flag.
 */

/**
 * Build a query-string object from provided filters, dropping empty values.
 *
 * @param {TimeEntryListFilters} filters - Raw filter values.
 * @returns {Record<string, string|boolean>} Cleaned params for axios.
 */
function buildListParams(filters = {}) {
  /** @type {Record<string, string|boolean>} */
  const params = {};
  if (filters.project_id) params.project_id = filters.project_id;
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.billable !== undefined && filters.billable !== '' && filters.billable !== 'all') {
    params.billable = filters.billable;
  }
  return params;
}

/**
 * Fetch the time-entry list for the current user.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {TimeEntryListFilters} [filters] - Optional query filters.
 * @returns {Promise<Array>} Resolves to an array of TimeEntry JSON objects.
 */
export async function fetchTimeEntries(api, filters) {
  const { data } = await api.get('/time-entries', { params: buildListParams(filters) });
  return data;
}

/**
 * Fetch a single time entry by id.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {number} id - TimeEntry id.
 * @returns {Promise<Object>} The TimeEntry JSON object.
 */
export async function fetchTimeEntry(api, id) {
  const { data } = await api.get(`/time-entries/${id}`);
  return data;
}

/**
 * Create a new draft time entry.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {{project_id:number, work_date:string, duration_minutes:number, description:string, billable?:boolean, hourly_rate_cents?:number|null}} payload
 * @returns {Promise<Object>} The created TimeEntry JSON object.
 */
export async function createTimeEntry(api, payload) {
  const { data } = await api.post('/time-entries', payload);
  return data;
}

/**
 * Update fields on an existing draft time entry.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {number} id - TimeEntry id.
 * @param {Object} payload - Fields to update.
 * @returns {Promise<Object>} The updated TimeEntry JSON object.
 */
export async function updateTimeEntry(api, id, payload) {
  const { data } = await api.put(`/time-entries/${id}`, payload);
  return data;
}

/**
 * Delete a draft or rejected time entry.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {number} id - TimeEntry id.
 * @returns {Promise<void>}
 */
export async function deleteTimeEntry(api, id) {
  await api.delete(`/time-entries/${id}`);
}

/**
 * Execute a state-machine transition on a time entry.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {number} id - TimeEntry id.
 * @param {string} toStatus - Target status literal (must not be ``written_off``).
 * @param {string} [rejectReason] - Optional reason when rejecting.
 * @returns {Promise<Object>} The updated TimeEntry JSON object.
 */
export async function transitionTimeEntry(api, id, toStatus, rejectReason) {
  const body = { to_status: toStatus };
  if (rejectReason) body.reject_reason = rejectReason;
  const { data } = await api.post(`/time-entries/${id}/transition`, body);
  return data;
}

/**
 * Normalise an axios error into a simple ``{code, message}`` object.
 *
 * Recognises:
 * - ``{detail:{code,message}}`` structured BTT errors
 * - legacy string ``detail`` containing a ``BTT_E###`` code
 * - FastAPI 422 validation arrays whose ``msg`` contains a code
 *
 * @param {unknown} err - The caught error.
 * @returns {{code:string, message:string}} A structured error descriptor.
 */
export function extractBttError(err) {
  const detail = err?.response?.data?.detail;

  if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.code) {
    return { code: detail.code, message: detail.message || detail.code };
  }

  if (Array.isArray(detail)) {
    for (const item of detail) {
      const text = item?.msg || JSON.stringify(item);
      const match = text.match(/BTT_E\d{3}/);
      if (match) {
        return { code: match[0], message: text };
      }
    }
    const firstMsg = detail[0]?.msg || 'Validation error';
    return { code: 'BTT_E001', message: firstMsg };
  }

  const text = typeof detail === 'string' ? detail : err?.message || 'Unknown error';
  const match = text.match(/BTT_E\d{3}/);
  return { code: match ? match[0] : 'BTT_E???', message: text };
}

/**
 * Fetch all projects for the current user (used by the project dropdown).
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @returns {Promise<Array<{id:number, name:string}>>} Resolves to a list of project summaries.
 */
export async function fetchProjects(api) {
  const { data } = await api.get('/projects');
  return data;
}

/**
 * Fetch the 7-day week grid for the given Monday.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {string} weekStart - ISO Monday date (``YYYY-MM-DD``).
 * @returns {Promise<{week_start:string, days: Array<{date:string, total_minutes:number, entries: Array}>}>}
 *   Week payload with exactly 7 day buckets.
 */
export async function fetchTimeEntriesWeek(api, weekStart) {
  const { data } = await api.get('/time-entries/week', { params: { week_start: weekStart } });
  return data;
}

/**
 * Write off an approved billable entry onto an invoice.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @param {number} id - TimeEntry id.
 * @param {number} invoiceId - Target invoice id (must belong to current user).
 * @returns {Promise<Object>} The updated TimeEntry with status ``written_off``.
 */
export async function writeOffTimeEntry(api, id, invoiceId) {
  const { data } = await api.post(`/time-entries/${id}/write-off`, { invoice_id: invoiceId });
  return data;
}

/**
 * Fetch BTT summary metrics for the Dashboard.
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @returns {Promise<{week_approved_unwritten_minutes:number, month_written_off_amount_cents:number}>}
 *   Integer-cents / integer-minutes metrics.
 */
export async function fetchTimeEntriesStats(api) {
  const { data } = await api.get('/time-entries/stats/summary');
  return data;
}

/**
 * Fetch all invoices for the current user (used by the write-off selector).
 *
 * @param {import('axios').AxiosInstance} api - Authenticated axios instance.
 * @returns {Promise<Array<{id:number, invoice_number:string, status:string}>>}
 *   A list of invoice summaries.
 */
export async function fetchInvoices(api) {
  const { data } = await api.get('/invoices');
  return data;
}
