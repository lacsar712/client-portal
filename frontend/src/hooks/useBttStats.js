import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchTimeEntriesStats } from '../services/timeEntriesApi';

/**
 * React hook that loads BTT summary metrics for the Dashboard card.
 *
 * @returns {{
 *   stats: {week_approved_unwritten_minutes:number, month_written_off_amount_cents:number}|null,
 *   loading: boolean,
 *   error: string|null,
 *   refresh: () => Promise<void>
 * }}
 */
export function useBttStats() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Reload the BTT summary metrics. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeEntriesStats(api);
      setStats(data);
    } catch (err) {
      setError(err?.message || 'Failed to load BTT stats');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

export default useBttStats;
