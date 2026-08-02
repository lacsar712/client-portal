import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchTimeEntries,
  fetchProjects as apiFetchProjects,
  fetchInvoices as apiFetchInvoices,
  createTimeEntry as apiCreate,
  updateTimeEntry as apiUpdate,
  deleteTimeEntry as apiDelete,
  transitionTimeEntry as apiTransition,
  writeOffTimeEntry as apiWriteOff,
  extractBttError
} from '../services/timeEntriesApi';

/**
 * @typedef {Object} TimeEntry
 * @property {number} id
 * @property {number} owner_id
 * @property {number} project_id
 * @property {string} work_date
 * @property {number} duration_minutes
 * @property {string} description
 * @property {boolean} billable
 * @property {number|null} hourly_rate_cents
 * @property {string} status
 * @property {string|null} reject_reason
 * @property {number|null} invoice_id
 * @property {string|null} written_off_at
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} [project_name]
 * @property {number|null} [amount_cents]
 */

/**
 * React hook that encapsulates BTT list state, filters and all CRUD /
 * transition operations. Components never call axios directly.
 *
 * @returns {{
 *   entries: TimeEntry[],
 *   loading: boolean,
 *   filters: Object,
 *   setFilters: (f: Object) => void,
 *   refresh: () => Promise<void>,
 *   createEntry: (payload: Object) => Promise<TimeEntry>,
 *   updateEntry: (id:number, payload:Object) => Promise<TimeEntry>,
 *   removeEntry: (id:number) => Promise<void>,
 *   transition: (id:number, toStatus:string, rejectReason?:string) => Promise<TimeEntry>,
 *   writeOff: (id:number, invoiceId:number) => Promise<TimeEntry>,
 *   invoices: Array,
 *   error: {code:string, message:string}|null,
 *   clearError: () => void
 * }}
 */
export function useTimeEntries() {
  const { api } = useAuth();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project_id: '',
    status: 'all',
    date_from: '',
    date_to: '',
    billable: 'all'
  });
  const [error, setError] = useState(null);

  /** Clear the last error visible in the UI. */
  const clearError = useCallback(() => setError(null), []);

  /** Load projects once (for the filter/project dropdown). */
  useEffect(() => {
    let cancelled = false;
    apiFetchProjects(api)
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch((err) => { if (!cancelled) setError(extractBttError(err)); });
    return () => { cancelled = true; };
  }, [api]);

  /** Load invoices once (for the write-off selector). */
  useEffect(() => {
    let cancelled = false;
    apiFetchInvoices(api)
      .then((data) => { if (!cancelled) setInvoices(data); })
      .catch(() => { /* invoices are optional for list view */ });
    return () => { cancelled = true; };
  }, [api]);

  /** Reload the list using the current filters. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeEntries(api, filters);
      setEntries(data);
    } catch (err) {
      setError(extractBttError(err));
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Create a new draft entry and prepend it to the list.
   * @param {Object} payload - Entry fields.
   * @returns {Promise<TimeEntry>} The created entry.
   */
  const createEntry = useCallback(async (payload) => {
    setError(null);
    try {
      const created = await apiCreate(api, payload);
      setEntries((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api]);

  /**
   * Update a draft entry and replace it in the list.
   * @param {number} id - Entry id.
   * @param {Object} payload - Fields to update.
   * @returns {Promise<TimeEntry>} The updated entry.
   */
  const updateEntry = useCallback(async (id, payload) => {
    setError(null);
    try {
      const updated = await apiUpdate(api, id, payload);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api]);

  /**
   * Delete a draft/rejected entry and remove it from the list.
   * @param {number} id - Entry id.
   * @returns {Promise<void>}
   */
  const removeEntry = useCallback(async (id) => {
    setError(null);
    try {
      await apiDelete(api, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api]);

  /**
   * Run a state-machine transition on an entry.
   * @param {number} id - Entry id.
   * @param {string} toStatus - Target status literal.
   * @param {string} [rejectReason] - Optional rejection reason.
   * @returns {Promise<TimeEntry>} The updated entry.
   */
  const transition = useCallback(async (id, toStatus, rejectReason) => {
    setError(null);
    try {
      const updated = await apiTransition(api, id, toStatus, rejectReason);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api]);

  /**
   * Write off an approved billable entry onto an invoice.
   * @param {number} id - Entry id.
   * @param {number} invoiceId - Target invoice id.
   * @returns {Promise<TimeEntry>} The updated entry (status ``written_off``).
   */
  const writeOff = useCallback(async (id, invoiceId) => {
    setError(null);
    try {
      const updated = await apiWriteOff(api, id, invoiceId);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api]);

  return {
    entries,
    projects,
    invoices,
    loading,
    filters,
    setFilters,
    refresh,
    createEntry,
    updateEntry,
    removeEntry,
    transition,
    writeOff,
    error,
    clearError
  };
}

export default useTimeEntries;
