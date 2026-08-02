/**
 * React hook for the BTT week view (M2).
 *
 * Reuses the shared `services/timeEntriesApi.js` (and therefore the same
 * `/api/time-entries` contract as M1). No second HTTP layer is introduced.
 * It owns: the current week anchor (always an ISO Monday), the seven-day
 * grid response, project list, and the quick "create draft from a cell" action.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getWeek,
  createTimeEntry,
  listProjects,
} from '../services/timeEntriesApi';
import { getMondayOfWeek, addDaysIso, extractBttError, todayIso } from '../utils/bttMoney';

/**
 * @typedef {Object} WeekDay
 * @property {string} date - ISO YYYY-MM-DD.
 * @property {number} total_minutes
 * @property {Array<Object>} entries
 */

/**
 * Provide state and actions for the week grid page.
 *
 * @param {string} [initialWeekStart] - Optional anchor date; defaults to the
 *   Monday of the current week. Any non-Monday is normalized to its Monday.
 * @returns {{
 *   weekStart: string,
 *   days: WeekDay[],
 *   projects: Array<Object>,
 *   loading: boolean,
 *   saving: boolean,
 *   error: {code: string|null, message: string}|null,
 *   clearError: () => void,
 *   goPrevWeek: () => void,
 *   goNextWeek: () => void,
 *   goThisWeek: () => void,
 *   refresh: () => Promise<void>,
 *   createDraftForDate: (workDate: string, payload: Object) => Promise<Object>,
 *   billableMinutesForDay: (day: WeekDay) => number,
 * }}
 */
export function useTimeEntriesWeek(initialWeekStart) {
  const [weekStart, setWeekStart] = useState(() =>
    getMondayOfWeek(initialWeekStart || todayIso())
  );
  const [days, setDays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWeek(weekStart);
      setDays(data.days || []);
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
    let active = true;
    (async () => {
      try {
        const data = await listProjects();
        if (active) setProjects(data);
      } catch (err) {
        if (active) setError(extractBttError(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const goPrevWeek = useCallback(() => {
    setWeekStart((current) => addDaysIso(current, -7));
  }, []);

  const goNextWeek = useCallback(() => {
    setWeekStart((current) => addDaysIso(current, 7));
  }, []);

  const goThisWeek = useCallback(() => {
    setWeekStart(getMondayOfWeek(todayIso()));
  }, []);

  /**
   * Sum non-rejected minutes for a day to compare against the daily cap.
   * Rejected entries are excluded per PRD 0.8 (they do not count toward 1440).
   *
   * @param {WeekDay} day
   * @returns {number}
   */
  const billableMinutesForDay = useCallback((day) => {
    if (!day || !Array.isArray(day.entries)) return 0;
    return day.entries
      .filter((e) => e.status !== 'rejected')
      .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  }, []);

  const createDraftForDate = useCallback(
    async (workDate, payload) => {
      setSaving(true);
      setError(null);
      try {
        const created = await createTimeEntry({
          ...payload,
          work_date: workDate,
        });
        await refresh();
        return created;
      } catch (err) {
        const normalized = extractBttError(err);
        setError(normalized);
        throw normalized;
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const weekRangeLabel = useMemo(() => {
    if (!weekStart) return '';
    const end = addDaysIso(weekStart, 6);
    return `${weekStart} → ${end}`;
  }, [weekStart]);

  return {
    weekStart,
    weekEnd: addDaysIso(weekStart, 6),
    weekRangeLabel,
    days,
    projects,
    loading,
    saving,
    error,
    clearError,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
    refresh,
    createDraftForDate,
    billableMinutesForDay,
  };
}
