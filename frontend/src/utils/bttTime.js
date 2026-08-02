/**
 * BTT time/date helpers (PRD NX-PRD-BTT-2026-08 ch.0.6, ch.0.12).
 * Uses only the native Date API — no date libraries allowed.
 */

/**
 * Format a duration in minutes using the PRD "Hh Mm" convention.
 * @param {number} minutes - duration in minutes.
 * @returns {string} formatted duration like "2h 05m"; invalid input renders as "0h 00m".
 */
export function formatDurationMinutes(minutes) {
  const total = Number.isFinite(minutes) ? Math.trunc(minutes) : 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Normalize a Date (or date-like value) to an ISO calendar string without timezone shifts.
 * @param {Date|string|number} value - value convertible to a Date.
 * @returns {string} date in YYYY-MM-DD format (local time).
 */
export function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Today's date as an ISO calendar string.
 * @returns {string} today in YYYY-MM-DD format (local time).
 */
export function todayIso() {
  return toIsoDate(new Date());
}

/**
 * Compute the ISO Monday of the week containing the given date.
 * @param {Date|string|number} value - any date-like value within the target week.
 * @returns {string} the Monday of that week in YYYY-MM-DD format (local time).
 */
export function mondayOfWeekIso(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const offsetFromMonday = (d.getDay() + 6) % 7; // getDay(): 0=Sunday; ISO week starts Monday
  d.setDate(d.getDate() - offsetFromMonday);
  return toIsoDate(d);
}

/**
 * Shift an ISO calendar date by a number of days.
 * @param {string} iso - base date in YYYY-MM-DD format.
 * @param {number} days - signed day delta (e.g. 7 for next week, -7 for previous week).
 * @returns {string} resulting date in YYYY-MM-DD format (local time).
 */
export function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Short English weekday label for an ISO calendar date.
 * @param {string} iso - date in YYYY-MM-DD format.
 * @returns {string} one of "Mon".."Sun".
 */
export function weekdayShortLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}
