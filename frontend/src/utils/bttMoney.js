/**
 * BTT money helpers (PRD NX-PRD-BTT-2026-08 ch.0.5).
 * All amounts are integer cents; display is always (cents / 100).toFixed(2)
 * with a "$" prefix. Never store or transmit floats.
 */

/**
 * Format integer cents as a dollar string.
 * @param {number|null|undefined} cents - amount in integer cents.
 * @returns {string} formatted value like "$150.00", or an em dash when cents is null/undefined.
 */
export function formatCents(cents) {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Convert a user-entered dollar amount into integer cents.
 * @param {string|number|null|undefined} dollars - dollar input, e.g. "150.00".
 * @returns {number|null} integer cents (rounded), or null when the input is empty or invalid.
 */
export function dollarsToCents(dollars) {
  if (dollars === null || dollars === undefined || dollars === '') return null;
  const parsed = typeof dollars === 'number' ? dollars : parseFloat(dollars);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * Convert integer cents into a dollars string with exactly two decimals (for form prefill).
 * @param {number|null|undefined} cents - amount in integer cents.
 * @returns {string} dollars with two decimals like "150.00", or an empty string when null/undefined.
 */
export function centsToDollarsString(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}
