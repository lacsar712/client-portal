import { useCallback, useEffect, useState } from 'react';
import { fetchWeek, extractBttErrorCode } from '../services/timeEntriesApi';
import { mondayOf, addDays, todayIso } from '../utils/bttDates';

/**
 * State + orchestration hook for the BTT week view (PRD 10). Keeps API calls and
 * week-navigation math out of the page component (PRD 0.13 / 10.4), reusing the
 * M1 `fetchWeek` service rather than any parallel API.
 *
 * @param {string} [initialDate] - Any `YYYY-MM-DD` within the desired week;
 *   defaults to today. The hook always snaps to that week's Monday.
 * @returns {{
 *   weekStart: string,
 *   week: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => void,
 *   goPrevWeek: () => void,
 *   goNextWeek: () => void,
 *   goThisWeek: () => void
 * }} Week view state and controls.
 */
export function useTimeEntriesWeek(initialDate) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(initialDate || todayIso()));
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (start) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeek(start);
      setWeek(data);
    } catch (err) {
      setError(extractBttErrorCode(err) || 'Failed to load week');
      setWeek(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  const reload = useCallback(() => load(weekStart), [load, weekStart]);

  // Navigation stays Monday-anchored: ±7 days from a Monday is still a Monday.
  const goPrevWeek = useCallback(() => setWeekStart((s) => addDays(s, -7)), []);
  const goNextWeek = useCallback(() => setWeekStart((s) => addDays(s, 7)), []);
  const goThisWeek = useCallback(() => setWeekStart(mondayOf(todayIso())), []);

  return { weekStart, week, loading, error, reload, goPrevWeek, goNextWeek, goThisWeek };
}
