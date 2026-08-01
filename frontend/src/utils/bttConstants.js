/**
 * BTT (Billable Time Tracking) frozen constants.
 * Mirrors PRD NX-PRD-BTT-2026-08 chapters 0 and 13; values must stay in sync
 * (same names, same values) with backend/btt_constants.py.
 */

export const BTT_MAX_MINUTES_PER_DAY = 24 * 60; // 1440
export const BTT_DESC_MAX = 500;
export const BTT_WARN_MINUTES_PER_DAY = 1200;
export const BTT_ROUTE_LIST = '/time-entries';
export const BTT_ROUTE_WEEK = '/time-entries/week';
export const BTT_ERROR_PREFIX = 'BTT_E';
export const BTT_NAV_LABEL = 'Time Tracking';

/** Status literals, verbatim per PRD ch.0.7. */
export const BTT_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WRITTEN_OFF: 'written_off',
});

/** Error codes, verbatim per PRD ch.0.9. */
export const BTT_ERRORS = Object.freeze({
  INVALID_DURATION: 'BTT_E001',
  DAILY_LIMIT: 'BTT_E002',
  ILLEGAL_TRANSITION: 'BTT_E003',
  NOT_DRAFT_EDIT: 'BTT_E004',
  WRITEOFF_PRECONDITION: 'BTT_E005',
  PROJECT_NOT_FOUND: 'BTT_E006',
  WRITEOFF_RATE: 'BTT_E007',
  WEEK_START_NOT_MONDAY: 'BTT_E008',
});

/** Event/action names, verbatim per PRD ch.0.10. */
export const BTT_EVENTS = Object.freeze({
  CREATE: 'btt/entry/CREATE',
  UPDATE: 'btt/entry/UPDATE',
  SUBMIT: 'btt/entry/SUBMIT',
  APPROVE: 'btt/entry/APPROVE',
  REJECT: 'btt/entry/REJECT',
  WRITEOFF: 'btt/entry/WRITEOFF',
  WEEK_LOAD: 'btt/week/LOAD',
});

/** UI badge config per status (labels/colors follow the existing theme; shared by list and week views). */
export const BTT_STATUS_CONFIG = Object.freeze({
  draft: { label: 'Draft', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
  submitted: { label: 'Submitted', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
  written_off: { label: 'Written Off', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
});
