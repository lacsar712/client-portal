import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  createTimeEntry,
  updateTimeEntry,
  extractBttErrorCode,
} from '../services/timeEntriesApi';
import { todayIso } from '../utils/bttDates';

/**
 * Build the modal's default form state.
 *
 * @param {object} [overrides] - Optional initial field overrides (e.g. a
 *   prefilled `work_date` when opened from a week-grid cell).
 * @returns {object} A fresh form state object.
 */
function getDefaultForm(overrides = {}) {
  return {
    project_id: '',
    work_date: todayIso(),
    duration_minutes: '',
    description: '',
    billable: true,
    hourly_rate_dollars: '',
    ...overrides,
  };
}

/**
 * Shared create/edit modal for BTT time entries, reused by both the list page
 * and the week view (PRD 10.4 — no parallel form/API). All persistence flows
 * through the `timeEntriesApi` service; this component never calls axios.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is visible.
 * @param {Array<object>} props.projects - Project options for the selector.
 * @param {object|null} [props.editing] - Entry being edited, or null to create.
 * @param {object} [props.initial] - Field overrides for a new entry (e.g. date).
 * @param {() => void} props.onClose - Close handler.
 * @param {() => void} props.onSaved - Called after a successful save.
 * @returns {JSX.Element|null} The modal, or null when closed.
 */
export default function TimeEntryFormModal({ open, projects, editing, initial, onClose, onSaved }) {
  const [form, setForm] = useState(getDefaultForm());
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        project_id: editing.project_id ? String(editing.project_id) : '',
        work_date: editing.work_date || todayIso(),
        duration_minutes: editing.duration_minutes ? String(editing.duration_minutes) : '',
        description: editing.description || '',
        billable: !!editing.billable,
        hourly_rate_dollars:
          editing.hourly_rate_cents !== null && editing.hourly_rate_cents !== undefined
            ? (editing.hourly_rate_cents / 100).toFixed(2)
            : '',
      });
    } else {
      setForm(getDefaultForm(initial || {}));
    }
    setFormError(null);
  }, [open, editing, initial]);

  const buildPayload = () => {
    const payload = {
      project_id: form.project_id ? parseInt(form.project_id) : null,
      work_date: form.work_date,
      duration_minutes: parseInt(form.duration_minutes, 10),
      description: form.description,
      billable: form.billable,
    };
    // Money submitted as integer cents (PRD 0.5). Empty rate -> null.
    if (form.hourly_rate_dollars === '' || form.hourly_rate_dollars === null) {
      payload.hourly_rate_cents = null;
    } else {
      payload.hourly_rate_cents = Math.round(parseFloat(form.hourly_rate_dollars) * 100);
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      const payload = buildPayload();
      if (editing) {
        await updateTimeEntry(editing.id, payload);
      } else {
        await createTimeEntry(payload);
      }
      onSaved && onSaved();
    } catch (err) {
      setFormError(extractBttErrorCode(err) || 'Failed to save entry');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editing ? 'Edit Time Entry' : 'New Time Entry'}</h3>
              <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div
                    data-error-code={formError}
                    style={{
                      marginBottom: '1rem',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--accent-danger)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    {formError}
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
                    <option value="">Select a project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Work Date</label>
                    <input
                      type="date"
                      className="input"
                      value={form.work_date}
                      onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 90"
                      min="1"
                      step="1"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Description</label>
                  <textarea
                    className="input"
                    placeholder="What did you work on?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    maxLength={500}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <div className="input-group">
                    <label>Hourly Rate ($)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 150.00"
                      min="0"
                      step="0.01"
                      value={form.hourly_rate_dollars}
                      onChange={(e) => setForm({ ...form, hourly_rate_dollars: e.target.value })}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={form.billable}
                      onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                    />
                    Billable
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
