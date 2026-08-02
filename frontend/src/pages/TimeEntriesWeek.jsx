import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays } from 'lucide-react';
import { useTimeEntriesWeek } from '../hooks/useTimeEntriesWeek';
import { fetchProjectsForEntries } from '../services/timeEntriesApi';
import { formatMinutes } from '../utils/bttMoney';
import { weekdayLabel, dayNumber, addDays } from '../utils/bttDates';
import TimeEntryFormModal from '../components/TimeEntryFormModal';

// Frozen daily thresholds (PRD 0.8 / 10.3).
const BTT_WARN_MINUTES_PER_DAY = 1200;
const BTT_MAX_MINUTES_PER_DAY = 1440;

export default function TimeEntriesWeek() {
  const { weekStart, week, loading, error, reload, goPrevWeek, goNextWeek, goThisWeek } =
    useTimeEntriesWeek();

  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  useEffect(() => {
    fetchProjectsForEntries()
      .then(setProjects)
      .catch((err) => console.error('Failed to load projects:', err));
  }, []);

  // Open the shared create modal with the cell's date prefilled (PRD 10.3).
  const openCreateForDay = (dayIso) => {
    setModalInitial({ work_date: dayIso });
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setModalInitial(null);
    reload(); // refresh the week grid after creating a draft (PRD requirement 3)
  };

  const weekEndLabel = addDays(weekStart, 6);

  return (
    <div data-nav="time-tracking">
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Time Tracking — Week</h1>
          <p>Weekly grid, Monday to Sunday</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/time-entries" className="btn btn-secondary">
            <List size={18} />
            List View
          </Link>
        </div>
      </div>

      <div className="page-container">
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
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 600 }}>
              {weekStart} → {weekEndLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={goPrevWeek}>
              <ChevronLeft size={16} /> Prev
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goThisWeek}>
              This Week
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goNextWeek}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>

        {error && (
          <div
            data-error-code={error}
            className="card"
            style={{
              marginBottom: '1.5rem',
              color: 'var(--accent-danger)',
              fontWeight: 600,
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="loader" style={{ height: '40vh' }}>
            <div className="spinner" />
          </div>
        ) : week ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.75rem',
            }}
          >
            {week.days.map((day) => {
              const isWarn = day.total_minutes >= BTT_WARN_MINUTES_PER_DAY;
              const isFull = day.total_minutes >= BTT_MAX_MINUTES_PER_DAY;
              return (
                <div
                  key={day.date}
                  className="card"
                  style={{
                    padding: '0.75rem',
                    minHeight: 220,
                    display: 'flex',
                    flexDirection: 'column',
                    border: isWarn
                      ? '1px solid var(--accent-warning)'
                      : '1px solid var(--border-subtle)',
                    background: isWarn ? 'rgba(245, 158, 11, 0.08)' : undefined,
                  }}
                >
                  {/* Day header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {weekdayLabel(day.date)}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{dayNumber(day.date)}</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openCreateForDay(day.date)}
                      disabled={isFull}
                      title={isFull ? 'Daily 1440-minute limit reached' : 'Add entry'}
                      style={{ padding: '0.25rem', opacity: isFull ? 0.4 : 1 }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Daily total */}
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginTop: '0.25rem',
                      color: isWarn ? 'var(--accent-warning)' : 'var(--text-secondary)',
                    }}
                  >
                    {formatMinutes(day.total_minutes)}
                  </div>

                  {/* Entry summaries */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', overflow: 'hidden' }}>
                    {day.entries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.375rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={entry.description}
                      >
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatMinutes(entry.duration_minutes)}
                        </strong>{' '}
                        {entry.description.length > 24
                          ? `${entry.description.slice(0, 24)}…`
                          : entry.description}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Shared create modal reused from M1 (PRD 10.4 — no parallel form). */}
      <TimeEntryFormModal
        open={showModal}
        projects={projects}
        editing={null}
        initial={modalInitial}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
