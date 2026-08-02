import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchTimeEntriesWeek,
  createTimeEntry as apiCreate,
  fetchProjects as apiFetchProjects,
  extractBttError
} from '../services/timeEntriesApi';
import { getMonday, addDays } from '../utils/bttMoney';

/**
 * React hook that drives the BTT week view (M2).
 *
 * Owns the ``weekStart`` cursor, the 7-day payload, the project list (for the
 * quick-create modal) and all mutation operations. It reuses the same
 * service module as ``useTimeEntries`` — no parallel API layer.
 *
 * @returns {{
 *   weekStart: string,
 *   days: Array,
 *   projects: Array,
 *   loading: boolean,
 *   error: {code:string, message:string}|null,
 *   goPrevWeek: () => void,
 *   goNextWeek: () => void,
 *   goThisWeek: () => void,
 *   refresh: () => Promise<void>,
 *   createDraft: (payload: Object) => Promise<Object>,
 *   clearError: () => void
 * }}
 */
export function useTimeEntriesWeek() {
  const { api } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [days, setDays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Clear the last visible error. */
  const clearError = useCallback(() => setError(null), []);

  /** Load projects once for the quick-create dropdown. */
  useEffect(() => {
    let cancelled = false;
    apiFetchProjects(api)
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch((err) => { if (!cancelled) setError(extractBttError(err)); });
    return () => { cancelled = true; };
  }, [api]);

  /** Reload the week grid for the current ``weekStart``. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeEntriesWeek(api, weekStart);
      setDays(data.days);
    } catch (err) {
      setError(extractBttError(err));
    } finally {
      setLoading(false);
    }
  }, [api, weekStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Move the cursor back exactly 7 days (result is still a Monday). */
  const goPrevWeek = useCallback(() => {
    setWeekStart((ws) => addDays(ws, -7));
  }, []);

  /** Move the cursor forward exactly 7 days (result is still a Monday). */
  const goNextWeek = useCallback(() => {
    setWeekStart((ws) => addDays(ws, 7));
  }, []);

  /** Jump to the current real-world week's Monday. */
  const goThisWeek = useCallback(() => {
    setWeekStart(getMonday(new Date()));
  }, []);

  /**
   * Create a draft entry (typically from a day-cell "+") and refresh the grid.
   * @param {Object} payload - Entry fields matching TimeEntryCreate.
   * @returns {Promise<Object>} The created entry.
   */
  const createDraft = useCallback(async (payload) => {
    setError(null);
    try {
      const created = await apiCreate(api, payload);
      await refresh();
      return created;
    } catch (err) {
      const e = extractBttError(err);
      setError(e);
      throw e;
    }
  }, [api, refresh]);

  return {
    weekStart,
    days,
    projects,
    loading,
    error,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
    refresh,
    createDraft,
    clearError
  };
}

export default useTimeEntriesWeek;
