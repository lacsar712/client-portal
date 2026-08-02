import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, List, Plus } from 'lucide-react';
import { useTimeEntriesWeek } from '../hooks/useTimeEntriesWeek';
import TimeEntryFormModal, { BttErrorBanner } from '../components/TimeEntryFormModal';
import { formatDurationMinutes, addDaysIso, weekdayShortLabel, todayIso } from '../utils/bttTime';
import {
  BTT_STATUS_CONFIG,
  BTT_WARN_MINUTES_PER_DAY,
  BTT_MAX_MINUTES_PER_DAY,
  BTT_ROUTE_LIST
} from '../utils/bttConstants';

export default function TimeEntriesWeek() {
  const {
    weekStart, days, projects, loading, error,
    goPrevWeek, goNextWeek, goCurrentWeek, createEntry
  } = useTimeEntriesWeek();

  const [showModal, setShowModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');

  const openQuickCreate = (dateStr) => {
    setPrefillDate(dateStr);
    setShowModal(true);
  };

  const handleQuickCreate = async (payload) => {
    const result = await createEntry(payload);
    if (result.ok) setShowModal(false);
    return result; // errors surface inside the shared modal (data-error-code)
  };

  if (loading && days.length === 0) {
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
          <h1>Time Tracking</h1>
          <p>Week view — 7 days starting Monday</p>
        </div>
        <div className="header-actions">
          <Link to={BTT_ROUTE_LIST} className="btn btn-secondary">
            <List size={18} />
            List View
          </Link>
        </div>
      </div>

      <div className="page-container">
        <BttErrorBanner error={error} />

        {/* Week navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <button className="btn btn-ghost" onClick={goPrevWeek}>
            <ChevronLeft size={18} />
            Prev Week
          </button>
          <div style={{ fontWeight: 600 }}>
            Week of {weekStart} — {addDaysIso(weekStart, 6)}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={goCurrentWeek}>
              This Week
            </button>
            <button className="btn btn-ghost" onClick={goNextWeek}>
              Next Week
              <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>

        {/* 7-column grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))',
            gap: '0.75rem',
            overflowX: 'auto'
          }}
        >
          {days.map((day) => {
            const isFull = day.total_minutes >= BTT_MAX_MINUTES_PER_DAY;
            const isWarn = !isFull && day.total_minutes >= BTT_WARN_MINUTES_PER_DAY;
            const isToday = day.date === todayIso();
            const borderColor = isFull
              ? 'var(--accent-danger)'
              : isWarn
                ? 'var(--accent-warning)'
                : isToday
                  ? 'var(--accent-primary)'
                  : 'var(--border-subtle)';
            const totalColor = isFull
              ? 'var(--accent-danger)'
              : isWarn
                ? 'var(--accent-warning)'
                : 'var(--text-secondary)';

            return (
              <div
                key={day.date}
                className="card"
                data-date={day.date}
                style={{
                  padding: '0.75rem',
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  minHeight: 220
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {weekdayShortLabel(day.date)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{day.date}</div>
                </div>

                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: totalColor }}>
                  {formatDurationMinutes(day.total_minutes)}
                  {isWarn && (
                    <span style={{ marginLeft: '0.375rem', fontWeight: 400, fontSize: '0.6875rem' }}>
                      nearing limit
                    </span>
                  )}
                  {isFull && (
                    <span style={{ marginLeft: '0.375rem', fontWeight: 400, fontSize: '0.6875rem' }}>
                      limit reached
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {day.entries.map((entry) => {
                    const statusCfg = BTT_STATUS_CONFIG[entry.status] || BTT_STATUS_CONFIG.draft;
                    return (
                      <div
                        key={entry.id}
                        title={`${entry.description} · ${formatDurationMinutes(entry.duration_minutes)} · ${statusCfg.label}`}
                        style={{
                          background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: statusCfg.color,
                              flexShrink: 0
                            }}
                          />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}
                          >
                            {entry.description}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                          {formatDurationMinutes(entry.duration_minutes)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'center', opacity: isFull ? 0.5 : 1 }}
                  disabled={isFull}
                  onClick={() => openQuickCreate(day.date)}
                  title={isFull ? 'Daily limit of 1440 minutes reached' : `New entry on ${day.date}`}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Quick-create modal (shared with the list page), prefilled with the cell's date */}
      <TimeEntryFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleQuickCreate}
        projects={projects}
        initialWorkDate={prefillDate}
      />
    </div>
  );
}
