// Native (no dayjs/date-fns/moment — PRD 0.12) date helpers for the BTT week
// view. All functions operate on YYYY-MM-DD strings using local Date math and
// are pure so they can be reused by hooks/pages without side effects.

/**
 * Format a Date as a local `YYYY-MM-DD` string (no UTC shift).
 *
 * @param {Date} d - The date to format.
 * @returns {string} The `YYYY-MM-DD` representation.
 */
export function toIsoDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` string into a local Date at midnight.
 *
 * @param {string} iso - The date string.
 * @returns {Date} A Date at local midnight.
 */
export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/**
 * Return the ISO Monday (as `YYYY-MM-DD`) of the week containing `iso`.
 *
 * Uses JS `getDay()` where Sunday === 0; converts so Monday anchors the week
 * (PRD 10.1).
 *
 * @param {string} iso - Any `YYYY-MM-DD` date within the target week.
 * @returns {string} The Monday of that week as `YYYY-MM-DD`.
 */
export function mondayOf(iso) {
  const d = parseIsoDate(iso);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

/**
 * Add a number of days to a `YYYY-MM-DD` string.
 *
 * @param {string} iso - The base date.
 * @param {number} days - Days to add (may be negative).
 * @returns {string} The resulting `YYYY-MM-DD` date.
 */
export function addDays(iso, days) {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Today's date as a local `YYYY-MM-DD` string.
 *
 * @returns {string} Today in `YYYY-MM-DD`.
 */
export function todayIso() {
  return toIsoDate(new Date());
}

/**
 * Short weekday label (e.g. "Mon") for a `YYYY-MM-DD` date.
 *
 * @param {string} iso - The date string.
 * @returns {string} Abbreviated weekday name.
 */
export function weekdayLabel(iso) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[parseIsoDate(iso).getDay()];
}

/**
 * Day-of-month number (e.g. "5") for a `YYYY-MM-DD` date.
 *
 * @param {string} iso - The date string.
 * @returns {string} The day-of-month as a string.
 */
export function dayNumber(iso) {
  return String(parseIsoDate(iso).getDate());
}
