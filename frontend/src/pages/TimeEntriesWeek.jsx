import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  Clock,
  AlertTriangle,
  List,
  Timer
} from 'lucide-react';
import { useTimeEntriesWeek } from '../hooks/useTimeEntriesWeek';
import {
  formatDuration,
  formatDate,
  weekdayShort,
  dayOfMonth,
  formatCents,
  centsToDollarsInput,
  dollarsToCents,
  toISODate,
  BTT_MAX_MINUTES_PER_DAY,
  BTT_WARN_MINUTES_PER_DAY,
  BTT_DESC_MAX,
  TIME_ENTRY_STATUS_CONFIG
} from '../utils/bttMoney';

const EMPTY_FORM = {
  project_id: '',
  duration_minutes: '',
  description: '',
  billable: true,
  hourly_rate_cents: ''
};

export default function TimeEntriesWeek() {
  const {
    weekStart,
    days,
    projects,
    loading,
    error,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
    createDraft,
    clearError
  } = useTimeEntriesWeek();

  const [activeDate, setActiveDate] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = (date) => {
    setActiveDate(date);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  };

  const closeModal = () => {
    setActiveDate(null);
    setFormError(null);
    setSaving(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const minutes = parseInt(form.duration_minutes, 10);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setFormError({ code: 'BTT_E001', message: 'BTT_E001: Duration must be a positive integer' });
      return;
    }
    const description = form.description.trim();
    if (description.length < 1 || description.length > BTT_DESC_MAX) {
      setFormError({ code: 'BTT_E001', message: `Description must be 1–${BTT_DESC_MAX} characters` });
      return;
    }
    if (!form.project_id) {
      setFormError({ code: 'BTT_E006', message: 'BTT_E006: Please select a project' });
      return;
    }

    setSaving(true);
    try {
      await createDraft({
        project_id: parseInt(form.project_id, 10),
        work_date: activeDate,
        duration_minutes: minutes,
        description,
        billable: form.billable,
        hourly_rate_cents: form.billable && form.hourly_rate_cents !== ''
          ? dollarsToCents(form.hourly_rate_cents)
          : null
      });
      closeModal();
    } catch (err) {
      setFormError(err);
      setSaving(false);
    }
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
          <p>Track billable hours across a 7-day week</p>
        </div>
        <div className="header-actions">
          <Link to="/time-entries" className="btn btn-secondary">
            <List size={18} />
            List View
          </Link>
        </div>
      </div>

      <div className="page-container">
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              data-error-code={error.code}
              style={{
                padding: '0.875rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-danger)',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <AlertTriangle size={18} />
              <span style={{ flex: 1 }}>{error.message}</span>
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={goPrevWeek} aria-label="Previous week">
              <ChevronLeft size={18} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goThisWeek}>
              This Week
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goNextWeek} aria-label="Next week">
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <CalendarDays size={18} style={{ color: 'var(--accent-primary)' }} />
            {days.length > 0 && (
              <span>
                {formatDate(days[0].date)} — {formatDate(days[6].date)}
              </span>
            )}
          </div>
        </motion.div>

        {/* 7-column grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '1rem'
          }}
        >
          {days.map((day) => {
            const isWarn = day.total_minutes >= BTT_WARN_MINUTES_PER_DAY && day.total_minutes < BTT_MAX_MINUTES_PER_DAY;
            const isFull = day.total_minutes >= BTT_MAX_MINUTES_PER_DAY;
            const isToday = day.date === toISODate(new Date());

            return (
              <div
                key={day.date}
                className="card"
                style={{
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  minHeight: 320,
                  borderColor: isFull
                    ? 'rgba(239, 68, 68, 0.4)'
                    : isWarn
                    ? 'rgba(245, 158, 11, 0.4)'
                    : undefined,
                  background: isFull
                    ? 'rgba(239, 68, 68, 0.06)'
                    : isWarn
                    ? 'rgba(245, 158, 11, 0.06)'
                    : undefined
                }}
              >
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {weekdayShort(day.date)}
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)'
                    }}>
                      {dayOfMonth(day.date)}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '0.375rem',
                      opacity: isFull ? 0.4 : 1,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      color: 'var(--accent-primary)'
                    }}
                    onClick={() => !isFull && openCreate(day.date)}
                    disabled={isFull}
                    title={isFull ? 'Daily limit reached (BTT_E002)' : 'Add entry'}
                    data-action="add-entry"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Total */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                  color: isFull ? 'var(--accent-danger)' : isWarn ? 'var(--accent-warning)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  <Clock size={13} />
                  {formatDuration(day.total_minutes)}
                  {isWarn && <AlertTriangle size={13} style={{ marginLeft: 'auto' }} />}
                </div>

                {/* Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {day.entries.length === 0 ? (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      paddingTop: '1rem'
                    }}>
                      No entries
                    </div>
                  ) : (
                    day.entries.map((entry) => {
                      const sc = TIME_ENTRY_STATUS_CONFIG[entry.status];
                      return (
                        <div
                          key={entry.id}
                          style={{
                            padding: '0.5rem 0.625rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${sc.color}`,
                            fontSize: '0.75rem'
                          }}
                          title={entry.description}
                        >
                          <div style={{
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '0.25rem'
                          }}>
                            {entry.description}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{formatDuration(entry.duration_minutes)}</span>
                            {entry.billable ? (
                              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {formatCents(entry.amount_cents)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Quick-create modal */}
      <AnimatePresence>
        {activeDate && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <Timer size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                  New Entry — {formatDate(activeDate)}
                </h3>
                <button className="btn btn-ghost" onClick={closeModal} style={{ padding: '0.5rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {formError && (
                    <div
                      data-error-code={formError.code}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-danger)',
                        fontSize: '0.875rem'
                      }}
                    >
                      {formError.message}
                    </div>
                  )}

                  <div className="input-group">
                    <label>Project</label>
                    <select
                      className="input"
                      value={form.project_id}
                      onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                      required
                    >
                      <option value="">Select a project…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      step="1"
                      placeholder="e.g. 60"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      placeholder="What did you work on?"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      maxLength={BTT_DESC_MAX}
                      rows={3}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {form.description.length}/{BTT_DESC_MAX}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id="wk-billable"
                      checked={form.billable}
                      onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="wk-billable" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                      Billable
                    </label>
                  </div>

                  {form.billable && (
                    <div className="input-group">
                      <label>Hourly Rate ($)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 150.00"
                        value={form.hourly_rate_cents}
                        onChange={(e) => setForm({ ...form, hourly_rate_cents: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Create Draft'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
