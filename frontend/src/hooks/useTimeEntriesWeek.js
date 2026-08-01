/**
 * State orchestration hook for the BTT week-view page (PRD NX-PRD-BTT-2026-08
 * ch.5.2, ch.10). Owns week navigation, fetching and quick-create; delegates
 * HTTP to services/ so the page stays free of request logic.
 */
import { useCallback, useEffect, useState } from 'react';
import { getTimeEntriesWeek, createTimeEntry, extractBttError } from '../services/timeEntriesApi';
import { listProjects } from '../services/projectsApi';
import { mondayOfWeekIso, addDaysIso } from '../utils/bttTime';

/**
 * Orchestrate week-view data: a 7-day grid starting at an ISO Monday.
 * @returns {{
 *   weekStart: string, days: Array<object>, projects: Array<object>,
 *   loading: boolean, error: {code: string|null, message: string}|null,
 *   refresh: function, goPrevWeek: function, goNextWeek: function, goCurrentWeek: function,
 *   createEntry: function
 * }} state and actions for the week page.
 */
export function useTimeEntriesWeek() {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekIso(new Date()));
  const [days, setDays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTimeEntriesWeek(weekStart);
      setDays(data.days);
      setError(null);
    } catch (err) {
      setError(extractBttError(err));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => console.error('Failed to fetch projects:', err));
  }, []);

  // Week navigation always shifts by whole weeks, so weekStart stays an ISO Monday.
  const goPrevWeek = useCallback(() => setWeekStart((w) => addDaysIso(w, -7)), []);
  const goNextWeek = useCallback(() => setWeekStart((w) => addDaysIso(w, 7)), []);
  const goCurrentWeek = useCallback(() => setWeekStart(mondayOfWeekIso(new Date())), []);

  /**
   * Quick-create a draft entry (prefilled work_date comes from the page) then refresh the grid.
   * @param {object} payload - create payload (project_id, work_date, duration_minutes, description, billable, hourly_rate_cents).
   * @returns {Promise<{ok: boolean, error?: {code: string|null, message: string}}>} result object; errors are returned, not thrown.
   */
  const createEntry = useCallback(
    async (payload) => {
      try {
        await createTimeEntry(payload);
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractBttError(err) };
      }
    },
    [refresh]
  );

  return {
    weekStart,
    days,
    projects,
    loading,
    error,
    refresh,
    goPrevWeek,
    goNextWeek,
    goCurrentWeek,
    createEntry,
  };
}
