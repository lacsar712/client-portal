/**
 * React hook orchestrating BTT time-entry state.
 *
 * Encapsulates all API interaction and error normalization so that
 * `pages/TimeEntries.jsx` remains a pure presentation component and never
 * imports axios/fetch directly (PRD 0.13).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  listTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  transitionTimeEntry,
  writeOffTimeEntry,
  listProjects,
  listInvoices,
} from '../services/timeEntriesApi';
import { extractBttError } from '../utils/bttMoney';

/**
 * @typedef {Object} TimeEntry
 * @property {number} id
 * @property {number} project_id
 * @property {string} [project_name]
 * @property {string} work_date
 * @property {number} duration_minutes
 * @property {string} description
 * @property {boolean} billable
 * @property {number|null} hourly_rate_cents
 * @property {number|null} amount_cents
 * @property {string} status
 * @property {string|null} reject_reason
 */

/**
 * @typedef {Object} BttError
 * @property {string|null} code - Frozen code such as `BTT_E002`, or null.
 * @property {string} message - Human-readable message.
 */

/** Empty filter set. */
const EMPTY_FILTERS = Object.freeze({
  project_id: '',
  status: '',
  date_from: '',
  date_to: '',
  billable: '',
});

/**
 * Provide state and actions for the time-entry list page.
 *
 * @returns {{
 *   entries: TimeEntry[],
 *   projects: Array<Object>,
 *   loading: boolean,
 *   filters: Object,
 *   setFilters: (patch: Object) => void,
 *   saving: boolean,
 *   error: BttError|null,
 *   clearError: () => void,
 *   refresh: () => Promise<void>,
 *   createEntry: (payload: Object) => Promise<TimeEntry>,
 *   updateEntry: (id: number, payload: Object) => Promise<TimeEntry>,
 *   removeEntry: (id: number) => Promise<void>,
 *   transition: (id: number, toStatus: string, rejectReason?: string) => Promise<TimeEntry>,
 *   writeOff: (id: number, invoiceId: number) => Promise<TimeEntry>,
 *   invoices: Array<Object>,
 * }}
 */
export function useTimeEntries() {
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFiltersState] = useState(EMPTY_FILTERS);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const setFilters = useCallback((patch) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      const data = await listTimeEntries(cleanFilters);
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(extractBttError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [projectData, invoiceData] = await Promise.all([listProjects(), listInvoices()]);
        if (active) {
          setProjects(projectData);
          setInvoices(invoiceData);
        }
      } catch (err) {
        if (active) setError(extractBttError(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runMutation = useCallback(async (fn) => {
    setSaving(true);
    setError(null);
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (err) {
      const normalized = extractBttError(err);
      setError(normalized);
      throw normalized;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const createEntry = useCallback(
    (payload) => runMutation(() => createTimeEntry(payload)),
    [runMutation]
  );

  const updateEntry = useCallback(
    (id, payload) => runMutation(() => updateTimeEntry(id, payload)),
    [runMutation]
  );

  const removeEntry = useCallback(
    (id) => runMutation(() => deleteTimeEntry(id)),
    [runMutation]
  );

  const transition = useCallback(
    (id, toStatus, rejectReason) =>
      runMutation(() => transitionTimeEntry(id, toStatus, rejectReason)),
    [runMutation]
  );

  const writeOff = useCallback(
    (id, invoiceId) => runMutation(() => writeOffTimeEntry(id, invoiceId)),
    [runMutation]
  );

  return {
    entries,
    projects,
    invoices,
    loading,
    filters,
    setFilters,
    saving,
    error,
    clearError,
    refresh,
    createEntry,
    updateEntry,
    removeEntry,
    transition,
    writeOff,
  };
}
