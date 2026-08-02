// Money & duration formatting helpers for the BTT (Billable Time Tracking) module.
// All monetary values are integer cents with an `_cents` suffix on the wire (PRD 0.5).

/**
 * Format an integer amount of cents as a US-dollar string, e.g. 22500 -> "$225.00".
 * Never uses floating-point storage; conversion is display-only.
 *
 * @param {number|null|undefined} cents - Amount in whole cents.
 * @returns {string} Formatted currency string, or an em dash when nullish/non-billable.
 */
export function formatCents(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return '\u2014';
  }
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

/**
 * Convert a dollar input string/number into integer cents.
 * Uses Math.round to avoid floating point drift; non-numeric input yields null.
 *
 * @param {string|number} dollars - The dollar value (e.g. "150.00").
 * @returns {number|null} Whole cents, or null when not parseable.
 */
export function dollarsToCents(dollars) {
  if (dollars === null || dollars === undefined || dollars === '') return null;
  const value = typeof dollars === 'number' ? dollars : parseFloat(dollars);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

/**
 * Convert integer cents into a dollar number suitable for numeric form inputs.
 *
 * @param {number|null|undefined} cents - Amount in whole cents.
 * @returns {string} Dollar string with two decimals, or empty string when nullish.
 */
export function centsToDollarsInput(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Format a duration in minutes as a human-readable `Hh Mm` string.
 *
 * @param {number} minutes - Total minutes (positive integer).
 * @returns {string} Formatted duration, e.g. 90 -> "1h 30m", 45 -> "45m".
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Compute the derived billable amount using integer arithmetic (PRD 3.2).
 * Formula: (duration_minutes * hourly_rate_cents) // 60.
 * Returns null for non-billable entries or entries without a valid rate.
 *
 * @param {number} durationMinutes - Entry length in minutes.
 * @param {number|null|undefined} hourlyRateCents - Rate in whole cents/hour.
 * @param {boolean} billable - Whether the entry is billable.
 * @returns {number|null} Amount in whole cents, or null.
 */
export function computeAmountCents(durationMinutes, hourlyRateCents, billable) {
  if (!billable) return null;
  if (hourlyRateCents === null || hourlyRateCents === undefined) return null;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  if (!Number.isFinite(hourlyRateCents) || hourlyRateCents <= 0) return null;
  return Math.floor((durationMinutes * hourlyRateCents) / 60);
}

/**
 * Format an ISO `YYYY-MM-DD` date string for display (e.g. "Aug 5, 2026").
 * Uses native Date only; no third-party date libraries.
 *
 * @param {string} dateStr - ISO date string.
 * @returns {string} Localized, human-readable date.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Return today's date as an ISO `YYYY-MM-DD` string in local time.
 *
 * @returns {string} Today's date in ISO format.
 */
export function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse an ISO `YYYY-MM-DD` string into a local Date at midnight.
 *
 * @param {string} iso - Date string in YYYY-MM-DD form.
 * @returns {Date} Local Date at 00:00.
 */
export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Format a Date as an ISO `YYYY-MM-DD` string in local time.
 *
 * @param {Date} date - A Date instance.
 * @returns {string} ISO date string.
 */
export function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return the ISO Monday that starts the week containing the given date.
 *
 * @param {string|Date} [input] - Any date within the week (defaults to today).
 * @returns {string} The week's Monday as `YYYY-MM-DD`.
 */
export function getMondayOfWeek(input) {
  const d = input instanceof Date ? new Date(input) : parseIsoDate(input || todayIso());
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diffToMonday);
  return toIsoDate(d);
}

/**
 * Add a number of days to an ISO date string and return the resulting ISO date.
 * The result stays on the same weekday when offset is a multiple of 7.
 *
 * @param {string} iso - Starting ISO date.
 * @param {number} days - Number of days to add (negative allowed).
 * @returns {string} The resulting ISO date.
 */
export function addDaysIso(iso, days) {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Determine whether an ISO date is today (local time).
 *
 * @param {string} iso - Date to test.
 * @returns {boolean} True when the date is today.
 */
export function isTodayIso(iso) {
  return iso === todayIso();
}

/**
 * Extract a BTT error code and message from an axios error response.
 * Supports both structured `{ detail: { code, message } }` and string details
 * that embed a `BTT_E00x` token (PRD Appendix F).
 *
 * @param {unknown} error - The caught error (typically an AxiosError).
 * @returns {{ code: string|null, message: string }} Normalized error info.
 */
export function extractBttError(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.code) {
    return {
      code: detail.code,
      message: detail.message || detail.code,
    };
  }
  const text = typeof detail === 'string' ? detail : (error?.message || 'Request failed');
  const match = text.match(/BTT_E\d{3}/);
  return { code: match ? match[0] : null, message: text };
}
