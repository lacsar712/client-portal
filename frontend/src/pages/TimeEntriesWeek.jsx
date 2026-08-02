import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  List,
  CalendarRange,
  Clock,
} from 'lucide-react';
import { useTimeEntriesWeek } from '../hooks/useTimeEntriesWeek';
import {
  TIME_ENTRY_STATUS_CONFIG,
  BTT_MAX_MINUTES_PER_DAY,
  BTT_WARN_MINUTES_PER_DAY,
} from '../utils/bttConstants';
import {
  formatCents,
  formatDuration,
  formatDate,
  isTodayIso,
} from '../utils/bttMoney';
import TimeEntryFormModal from '../components/TimeEntryFormModal';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Label for a calendar day column header.
 *
 * @param {string} isoDate - ISO date of the day.
 * @param {number} index - Zero-based day offset within the week (0 = Monday).
 * @returns {{ weekday: string, dayLabel: string, isToday: boolean }}
 */
function describeDay(isoDate, index) {
  const d = new Date(`${isoDate}T00:00:00`);
  return {
    weekday: WEEKDAY_LABELS[index],
    dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday: isTodayIso(isoDate),
  };
}

export default function TimeEntriesWeek() {
  const {
    weekStart,
    weekEnd,
    days,
    projects,
    loading,
    saving,
    error,
    clearError,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
    createDraftForDate,
    billableMinutesForDay,
  } = useTimeEntriesWeek();

  const [createDate, setCreateDate] = useState(null);

  const projectName = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => map.set(p.id, p.name));
    return (id) => map.get(id) || `Project #${id}`;
  }, [projects]);

  const openCreateFor = (isoDate) => {
    setCreateDate(isoDate);
  };

  const closeCreate = () => setCreateDate(null);

  const handleCreate = async (payload) => {
    if (!createDate) return;
    await createDraftForDate(createDate, payload);
    closeCreate();
  };

  if (loading) {
    return (
      <div className="loader" style={{ height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Week View</h1>
          <p>
            {formatDate(weekStart)} — {formatDate(weekEnd)}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/time-entries" className="btn btn-secondary">
            <List size={18} />
            List View
          </Link>
        </div>
      </div>

      <div className="page-container">
        {/* Global error banner (BTT_E008 etc.) */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              data-error-code={error.code || undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                marginBottom: '1.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-danger)',
              }}
            >
              <AlertCircle size={18} />
              <span style={{ flex: 1, fontSize: '0.875rem' }}>{error.message}</span>
              <button
                onClick={clearError}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Week navigation */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={goPrevWeek} title="Previous week">
              <ChevronLeft size={18} />
              Prev
            </button>
            <button className="btn btn-ghost btn-sm" onClick={goThisWeek}>
              <CalendarRange size={16} />
              This Week
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goNextWeek} title="Next week">
              Next
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Week of <strong style={{ color: 'var(--text-primary)' }}>{formatDate(weekStart)}</strong>
          </div>
        </div>

        {/* 7-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))',
            gap: '1rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
          }}
        >
          {days.map((day, index) => {
            const meta = describeDay(day.date, index);
            const countedMinutes = billableMinutesForDay(day);
            const isWarn = countedMinutes >= BTT_WARN_MINUTES_PER_DAY && countedMinutes < BTT_MAX_MINUTES_PER_DAY;
            const isFull = countedMinutes >= BTT_MAX_MINUTES_PER_DAY;

            const borderColor = isFull
              ? 'rgba(239, 68, 68, 0.5)'
              : isWarn
              ? 'rgba(245, 158, 11, 0.5)'
              : 'var(--border-subtle)';

            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                style={{
                  minHeight: 320,
                  background: 'var(--gradient-card)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {meta.weekday}
                    </div>
                    <div
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: meta.isToday ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}
                    >
                      {meta.dayLabel}
                      {meta.isToday && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.625rem',
                            padding: '0.125rem 0.4rem',
                            borderRadius: 999,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openCreateFor(day.date)}
                    disabled={isFull}
                    title={isFull ? 'Daily 1440-minute limit reached (BTT_E002)' : 'Add draft for this day'}
                    style={{
                      padding: '0.4rem',
                      opacity: isFull ? 0.5 : 1,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Total */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8125rem',
                    color: isFull ? 'var(--accent-danger)' : isWarn ? 'var(--accent-warning)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    marginBottom: '0.75rem',
                    padding: '0.4rem 0.6rem',
                    background: isFull
                      ? 'rgba(239, 68, 68, 0.1)'
                      : isWarn
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Clock size={13} />
                  {formatDuration(day.total_minutes)}
                  {isWarn && !isFull && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>≥1200m</span>}
                  {isFull && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>1440m cap</span>}
                </div>

                {/* Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {day.entries.length === 0 ? (
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '1.5rem 0.5rem',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      No entries
                    </div>
                  ) : (
                    day.entries.map((entry) => {
                      const cfg = TIME_ENTRY_STATUS_CONFIG[entry.status];
                      return (
                        <div
                          key={entry.id}
                          style={{
                            padding: '0.6rem 0.65rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={entry.description}
                            >
                              {entry.description}
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: cfg.bg,
                                color: cfg.color,
                                padding: '0.125rem 0.45rem',
                                fontSize: '0.6875rem',
                                flexShrink: 0,
                              }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginRight: '0.5rem',
                              }}
                            >
                              {entry.project_name || projectName(entry.project_id)}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                              <Clock size={11} />
                              {formatDuration(entry.duration_minutes)}
                            </span>
                          </div>
                          {entry.billable && (
                            <div
                              style={{
                                marginTop: '0.35rem',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                color: 'var(--accent-primary)',
                              }}
                            >
                              {formatCents(entry.amount_cents)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick-create modal (prefilled with the cell's work_date, locked) */}
      <TimeEntryFormModal
        open={createDate !== null}
        onClose={closeCreate}
        onSubmit={handleCreate}
        projects={projects}
        entry={null}
        prefillDate={createDate || undefined}
        lockDate
        saving={saving}
        serverError={error}
      />
    </div>
  );
}
