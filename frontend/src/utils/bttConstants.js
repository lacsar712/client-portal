/**
 * Frozen constants for the BTT (Billable Time Tracking) module.
 * Values mirror NX-PRD-BTT-2026-08 chapters 0 and 13 and must not be renamed.
 */

/** Maximum billable minutes allowed per owner per calendar day. */
export const BTT_MAX_MINUTES_PER_DAY = 24 * 60; // 1440

/** Minute threshold that triggers a per-day warning style in the week view. */
export const BTT_WARN_MINUTES_PER_DAY = 1200;

/** Maximum allowed length for a time entry description (after trim). */
export const BTT_DESC_MAX = 500;

/** Exact list route (no aliases permitted). */
export const BTT_ROUTE_LIST = '/time-entries';

/** Exact week-view route (M2). */
export const BTT_ROUTE_WEEK = '/time-entries/week';

/** Sidebar / navigation label for the module. */
export const BTT_NAV_LABEL = 'Time Tracking';

/** Prefix shared by every BTT error code. */
export const BTT_ERROR_PREFIX = 'BTT_E';

/** Status literals (verbatim, do not change casing). */
export const TIME_ENTRY_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WRITTEN_OFF: 'written_off',
});

/** Ordered list used for filter dropdowns and badges. */
export const TIME_ENTRY_STATUS_ORDER = Object.freeze([
  TIME_ENTRY_STATUS.DRAFT,
  TIME_ENTRY_STATUS.SUBMITTED,
  TIME_ENTRY_STATUS.APPROVED,
  TIME_ENTRY_STATUS.REJECTED,
  TIME_ENTRY_STATUS.WRITTEN_OFF,
]);

/** Display configuration for each status (label + theme colors). */
export const TIME_ENTRY_STATUS_CONFIG = Object.freeze({
  [TIME_ENTRY_STATUS.DRAFT]: {
    label: 'Draft',
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.15)',
  },
  [TIME_ENTRY_STATUS.SUBMITTED]: {
    label: 'Submitted',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.15)',
  },
  [TIME_ENTRY_STATUS.APPROVED]: {
    label: 'Approved',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.15)',
  },
  [TIME_ENTRY_STATUS.REJECTED]: {
    label: 'Rejected',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.15)',
  },
  [TIME_ENTRY_STATUS.WRITTEN_OFF]: {
    label: 'Written Off',
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.15)',
  },
});

/**
 * Canonical BTT error code catalog (PRD 0.9).
 * @type {Record<string, string>}
 */
export const BTT_ERROR_MESSAGES = Object.freeze({
  BTT_E001: 'duration_minutes is invalid (must be a positive integer)',
  BTT_E002: 'Daily limit of 1440 minutes exceeded',
  BTT_E003: 'Illegal status transition',
  BTT_E004: 'Only draft entries can be edited',
  BTT_E005: 'Only approved billable entries can be written off',
  BTT_E006: 'Project does not exist or does not belong to the current user',
  BTT_E007: 'A valid hourly_rate_cents (> 0) is required to write off',
  BTT_E008: 'week_start must be an ISO Monday',
});

/**
 * Legal transitions for the BTT state machine (PRD 4.1).
 * `written_off` is a terminal state and is only reachable via write-off (M3).
 * @type {Record<string, string[]>}
 */
export const BTT_TRANSITIONS = Object.freeze({
  [TIME_ENTRY_STATUS.DRAFT]: [TIME_ENTRY_STATUS.SUBMITTED],
  [TIME_ENTRY_STATUS.SUBMITTED]: [
    TIME_ENTRY_STATUS.APPROVED,
    TIME_ENTRY_STATUS.REJECTED,
  ],
  [TIME_ENTRY_STATUS.REJECTED]: [TIME_ENTRY_STATUS.DRAFT],
  [TIME_ENTRY_STATUS.APPROVED]: [],
  [TIME_ENTRY_STATUS.WRITTEN_OFF]: [],
});
