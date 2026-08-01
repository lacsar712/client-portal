/**
 * State orchestration hook for the BTT time-entries list page.
 * Owns fetching, filter state and mutations; delegates HTTP to services/
 * (PRD NX-PRD-BTT-2026-08 ch.0.13: pages contain no request logic).
 */
import { useCallback, useEffect, useState } from 'react';
import * as timeEntriesApi from '../services/timeEntriesApi';
import { listProjects } from '../services/projectsApi';
import { listInvoices } from '../services/invoicesApi';

/**
 * Orchestrate time-entry data for the list page.
 * @param {object} [initialFilters] - optional initial filters (e.g. {status: 'approved'} from a query param).
 * @returns {{
 *   entries: Array<object>, projects: Array<object>, invoices: Array<object>,
 *   loading: boolean, error: {code: string|null, message: string}|null,
 *   filters: object, setFilters: function, refresh: function,
 *   createEntry: function, updateEntry: function, deleteEntry: function,
 *   transitionEntry: function, writeOffEntry: function
 * }} state and actions for the page.
 */
export function useTimeEntries(initialFilters = {}) {
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    project_id: '',
    status: '',
    date_from: '',
    date_to: '',
    ...initialFilters,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await timeEntriesApi.listTimeEntries(filters);
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(timeEntriesApi.extractBttError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => console.error('Failed to fetch projects:', err));
    listInvoices()
      .then(setInvoices)
      .catch((err) => console.error('Failed to fetch invoices:', err));
  }, []);

  /**
   * Run a mutation then refresh the list.
   * @param {function(): Promise<*>} mutation - service call to execute.
   * @returns {Promise<{ok: boolean, error?: {code: string|null, message: string}}>} result object; errors are returned, not thrown.
   */
  const runMutation = useCallback(
    async (mutation) => {
      try {
        await mutation();
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: timeEntriesApi.extractBttError(err) };
      }
    },
    [refresh]
  );

  const createEntry = useCallback(
    (payload) => runMutation(() => timeEntriesApi.createTimeEntry(payload)),
    [runMutation]
  );

  const updateEntry = useCallback(
    (id, payload) => runMutation(() => timeEntriesApi.updateTimeEntry(id, payload)),
    [runMutation]
  );

  const deleteEntry = useCallback(
    (id) => runMutation(() => timeEntriesApi.deleteTimeEntry(id)),
    [runMutation]
  );

  const transitionEntry = useCallback(
    (id, toStatus, rejectReason) =>
      runMutation(() => timeEntriesApi.transitionTimeEntry(id, toStatus, rejectReason)),
    [runMutation]
  );

  const writeOffEntry = useCallback(
    (id, invoiceId) => runMutation(() => timeEntriesApi.writeOffTimeEntry(id, invoiceId)),
    [runMutation]
  );

  return {
    entries,
    projects,
    invoices,
    loading,
    error,
    filters,
    setFilters,
    refresh,
    createEntry,
    updateEntry,
    deleteEntry,
    transitionEntry,
    writeOffEntry,
  };
}
