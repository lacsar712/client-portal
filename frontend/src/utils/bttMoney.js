// Money & duration formatting helpers for the BTT (Billable Time Tracking)

/**
 * Maximum number of billable minutes allowed per owner per day.
 * @type {number}
 */
export const BTT_MAX_MINUTES_PER_DAY = 1440;

/**
 * Maximum length of a TimeEntry description after trimming.
 * @type {number}
 */
export const BTT_DESC_MAX = 500;

/**
 * Minutes threshold that triggers a warning style in the week view (M2).
 * @type {number}
 */
export const BTT_WARN_MINUTES_PER_DAY = 1200;

/**
 * Frontend route for the time-entry list page.
 * @type {string}
 */
export const BTT_ROUTE_LIST = '/time-entries';

/**
 * Frontend route for the weekly view (M2).
 * @type {string}
 */
export const BTT_ROUTE_WEEK = '/time-entries/week';

/**
 * Sidebar navigation label for the BTT module.
 * @type {string}
 */
export const BTT_NAV_LABEL = 'Time Tracking';

/**
 * Canonical status literals — do not change casing or synonyms.
 * @readonly
 * @enum {string}
 */
export const TimeEntryStatus = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WRITTEN_OFF: 'written_off'
});

/**
 * UI display configuration for each BTT status.
 * @type {Record<string, {label: string, color: string, bg: string}>}
 */
export const TIME_ENTRY_STATUS_CONFIG = Object.freeze({
  draft:     { label: 'Draft',      color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)' },
  submitted: { label: 'Submitted',  color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  approved:  { label: 'Approved',   color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  rejected:  { label: 'Rejected',   color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
  written_off: { label: 'Written Off', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' }
});

/**
 * Redux-style event/action constants (frozen literals).
 * @readonly
 * @enum {string}
 */
export const BttEvents = Object.freeze({
  CREATE:   'btt/entry/CREATE',
  UPDATE:   'btt/entry/UPDATE',
  SUBMIT:   'btt/entry/SUBMIT',
  APPROVE:  'btt/entry/APPROVE',
  REJECT:   'btt/entry/REJECT',
  WRITEOFF: 'btt/entry/WRITEOFF',
  WEEK_LOAD: 'btt/week/LOAD'
});

/**
 * Format an integer-cents amount as a US-dollar string.
 *
 * @param {number|null|undefined} cents - Amount in whole cents.
 * @returns {string} Formatted value such as ``$150.00`` or ``—`` when null.
 */
export function formatCents(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Convert a dollar float (user input) into integer cents.
 *
 * @param {number|string} dollars - Numeric dollar value.
 * @returns {number} Integer cents, rounded to avoid float artefacts.
 */
export function dollarsToCents(dollars) {
  const n = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Convert integer cents to a dollar number for form inputs.
 *
 * @param {number|null|undefined} cents - Amount in cents.
 * @returns {string} Dollar string suitable for an <input type="number">.
 */
export function centsToDollarsInput(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Format a duration in minutes as ``Hh Mm``.
 *
 * @param {number} minutes - Non-negative integer minutes.
 * @returns {string} Human-readable duration, e.g. ``2h 30m`` or ``45m``.
 */
export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a Date or ISO date string as ``YYYY-MM-DD`` for API consumption.
 *
 * @param {Date|string} date - A Date instance or ISO string.
 * @returns {string} Date in ``YYYY-MM-DD`` format.
 */
export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format an ISO ``YYYY-MM-DD`` string for human display.
 *
 * @param {string} isoDate - Date in ``YYYY-MM-DD`` format.
 * @returns {string} E.g. ``Aug 5, 2026``.
 */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Derive the monetary amount for an entry using integer arithmetic.
 *
 * Formula: ``(duration_minutes * hourly_rate_cents) // 60``.
 *
 * @param {number} durationMinutes - Entry length in minutes.
 * @param {number|null|undefined} hourlyRateCents - Hourly rate in cents.
 * @param {boolean} billable - Whether the entry is billable.
 * @returns {number|null} Amount in cents, or ``null`` when not billable / no rate.
 */
export function computeAmountCents(durationMinutes, hourlyRateCents, billable) {
  if (!billable || hourlyRateCents === null || hourlyRateCents === undefined) return null;
  if (hourlyRateCents <= 0) return null;
  return Math.floor((durationMinutes * hourlyRateCents) / 60);
}

/**
 * Return the ISO Monday (``YYYY-MM-DD``) of the week containing ``date``.
 *
 * Uses local-time components to avoid UTC off-by-one errors.
 *
 * @param {Date|string} [date=new Date()] - Reference date.
 * @returns {string} Monday's date in ``YYYY-MM-DD`` format.
 */
export function getMonday(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

/**
 * Shift an ISO ``YYYY-MM-DD`` date by ``deltaDays`` and return the new ISO date.
 *
 * @param {string} isoDate - Starting date (``YYYY-MM-DD``).
 * @param {number} deltaDays - Number of days to add (can be negative).
 * @returns {string} Resulting date in ``YYYY-MM-DD`` format.
 */
export function addDays(isoDate, deltaDays) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

/**
 * Parse an ISO ``YYYY-MM-DD`` string into a local ``Date`` at midnight.
 *
 * @param {string} isoDate - Date in ``YYYY-MM-DD`` format.
 * @returns {Date} Local Date instance.
 */
export function parseISODate(isoDate) {
  return new Date(isoDate + 'T00:00:00');
}

/**
 * Short weekday label for a date, e.g. ``Mon``.
 *
 * @param {string} isoDate - Date in ``YYYY-MM-DD`` format.
 * @returns {string} Three-letter weekday abbreviation.
 */
export function weekdayShort(isoDate) {
  return parseISODate(isoDate).toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Day-of-month number for a date.
 *
 * @param {string} isoDate - Date in ``YYYY-MM-DD`` format.
 * @returns {number} The 1–31 day number.
 */
export function dayOfMonth(isoDate) {
  return parseISODate(isoDate).getDate();
}
