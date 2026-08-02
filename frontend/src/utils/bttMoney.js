// Money & duration formatting helpers for the BTT (Billable Time Tracking)
// module. Money is always integer cents with a `_cents` suffix (PRD 0.5);
// duration is stored as integer minutes (PRD 0.6). No third-party date/money
// libraries — native helpers only (PRD 0.12).

/**
 * Format integer cents as a `$x.xx` currency string (PRD 0.5).
 *
 * @param {number|null|undefined} cents - Amount in integer cents. When null or
 *   undefined, the em-dash placeholder is returned.
 * @returns {string} `$x.xx` (e.g. `$300.00`) or `—` when there is no amount.
 */
export function formatCents(cents) {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a duration given in minutes as `Hh Mm` (PRD 0.6).
 *
 * @param {number} minutes - Non-negative integer minutes.
 * @returns {string} Human readable duration, e.g. `2h 30m`, `45m`, `0m`.
 */
export function formatMinutes(minutes) {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.trunc(minutes)) : 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Format minutes as decimal hours with two places (PRD 9.2 optional display).
 *
 * @param {number} minutes - Non-negative integer minutes.
 * @returns {string} Hours with two decimals, e.g. `2.50`.
 */
export function minutesToHours(minutes) {
  const total = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return (total / 60).toFixed(2);
}
