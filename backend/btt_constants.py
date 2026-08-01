"""
BTT (Billable Time Tracking) frozen constants.

Mirrors PRD NX-PRD-BTT-2026-08 chapters 0 and 13. Values must stay in sync
(same names, same values) with frontend/src/utils/bttConstants.js.
"""

BTT_MAX_MINUTES_PER_DAY = 24 * 60  # 1440
BTT_DESC_MAX = 500
BTT_WARN_MINUTES_PER_DAY = 1200
BTT_ROUTE_LIST = "/time-entries"
BTT_ROUTE_WEEK = "/time-entries/week"
BTT_ERROR_PREFIX = "BTT_E"
BTT_NAV_LABEL = "Time Tracking"

# Error codes (PRD ch.0.9)
BTT_E001 = "BTT_E001"  # invalid duration_minutes (<= 0 or non-integer)
BTT_E002 = "BTT_E002"  # daily limit of 1440 minutes exceeded
BTT_E003 = "BTT_E003"  # illegal status transition
BTT_E004 = "BTT_E004"  # non-draft entries cannot be edited
BTT_E005 = "BTT_E005"  # write-off requires approved + billable (M3)
BTT_E006 = "BTT_E006"  # project does not exist or is not owned by the user
BTT_E007 = "BTT_E007"  # write-off requires hourly_rate_cents > 0 (M3)
BTT_E008 = "BTT_E008"  # week_start is not an ISO Monday (M2)
