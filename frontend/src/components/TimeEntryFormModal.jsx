import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { BTT_MAX_MINUTES_PER_DAY, BTT_DESC_MAX } from '../utils/bttConstants';
import { centsToDollarsInput, dollarsToCents, todayIso } from '../utils/bttMoney';

/**
 * @typedef {Object} TimeEntryLike
 * @property {number} id
 * @property {number} project_id
 * @property {string} work_date
 * @property {number} duration_minutes
 * @property {string} description
 * @property {boolean} billable
 * @property {number|null} hourly_rate_cents
 */

/**
 * Build the empty form state, optionally pre-filling the work date.
 *
 * @param {string} [prefillDate] - ISO date to pre-select for the new draft.
 * @returns {Object} Form field values.
 */
function emptyForm(prefillDate) {
  return {
    project_id: '',
    work_date: prefillDate || todayIso(),
    duration_minutes: '',
    description: '',
    billable: true,
    hourly_rate_dollars: '',
  };
}

/**
 * Map an existing entry into form field values.
 *
 * @param {TimeEntryLike} entry
 * @returns {Object}
 */
function entryToForm(entry) {
  return {
    project_id: String(entry.project_id),
    work_date: entry.work_date,
    duration_minutes: String(entry.duration_minutes),
    description: entry.description,
    billable: entry.billable,
    hourly_rate_dollars: centsToDollarsInput(entry.hourly_rate_cents),
  };
}

/**
 * Shared create/edit modal for BTT time entries.
 *
 * Used by both the list page and the week view so there is a single form
 * contract and a single validation surface. The component itself performs
 * no HTTP calls; the parent supplies an `onSubmit` that returns a Promise.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible.
 * @param {Function} props.onClose - Close handler (no args).
 * @param {Function} props.onSubmit - Async `(payload) => Promise`; payload uses integer cents.
 * @param {Array<Object>} props.projects - Projects for the picker (`{id,name}`).
 * @param {TimeEntryLike|null} [props.entry] - Entry to edit, or null to create.
 * @param {string} [props.prefillDate] - ISO date to prefill when creating from a week cell.
 * @param {boolean} [props.saving] - Whether a submission is in flight.
 * @param {{code:string|null,message:string}|null} [props.serverError] - Error surfaced from the parent/hook.
 * @param {boolean} [props.lockDate] - When true, the work date input is read-only (week-cell prefill).
 */
export default function TimeEntryFormModal({
  open,
  onClose,
  onSubmit,
  projects,
  entry = null,
  prefillDate,
  saving = false,
  serverError = null,
  lockDate = false,
}) {
  const [form, setForm] = useState(emptyForm(prefillDate));
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setForm(entry ? entryToForm(entry) : emptyForm(prefillDate));
  }, [open, entry, prefillDate]);

  const validate = () => {
    if (!form.project_id) return 'Please select a project.';
    const duration = Number(form.duration_minutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      return 'BTT_E001: duration_minutes must be a positive integer.';
    }
    if (duration > BTT_MAX_MINUTES_PER_DAY) {
      return `BTT_E002: Daily limit of ${BTT_MAX_MINUTES_PER_DAY} minutes exceeded.`;
    }
    const description = form.description.trim();
    if (!description) return 'Description is required.';
    if (description.length > BTT_DESC_MAX) {
      return `Description must be at most ${BTT_DESC_MAX} characters.`;
    }
    if (form.billable && form.hourly_rate_dollars !== '') {
      const rate = parseFloat(form.hourly_rate_dollars);
      if (Number.isNaN(rate) || rate < 0) {
        return 'Hourly rate must be a non-negative number.';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);

    const payload = {
      project_id: parseInt(form.project_id, 10),
      work_date: form.work_date,
      duration_minutes: parseInt(form.duration_minutes, 10),
      description: form.description.trim(),
      billable: form.billable,
      hourly_rate_cents: form.billable ? dollarsToCents(form.hourly_rate_dollars) : null,
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setFormError(err?.message || 'Failed to save time entry.');
    }
  };

  const displayedError = formError || (serverError ? serverError.message : null);
  const displayedCode = (formError && formError.slice(0, 7).startsWith('BTT_E')
    ? formError.slice(0, 7)
    : serverError?.code || null);

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
              <h3>{entry ? 'Edit Time Entry' : 'New Time Entry'}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                style={{ padding: '0.5rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {displayedError && (
                  <div
                    data-error-code={displayedCode || undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--accent-danger)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{displayedError}</span>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Work Date</label>
                    <input
                      type="date"
                      className="input"
                      value={form.work_date}
                      readOnly={lockDate}
                      onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                      style={lockDate ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max={BTT_MAX_MINUTES_PER_DAY}
                      step="1"
                      placeholder="e.g. 60"
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
                    rows={3}
                    maxLength={BTT_DESC_MAX}
                    placeholder="What did you work on?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {form.description.length}/{BTT_DESC_MAX}
                  </span>
                </div>

                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.billable}
                      onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                    />
                    Billable
                  </label>
                </div>

                {form.billable && (
                  <div className="input-group">
                    <label>Hourly Rate (USD)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 150.00"
                      value={form.hourly_rate_dollars}
                      onChange={(e) => setForm({ ...form, hourly_rate_dollars: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : entry ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
