import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { dollarsToCents, centsToDollarsString } from '../utils/bttMoney';
import { todayIso } from '../utils/bttTime';
import { BTT_DESC_MAX, BTT_MAX_MINUTES_PER_DAY } from '../utils/bttConstants';

const EMPTY_FORM = {
  project_id: '',
  work_date: '',
  duration_minutes: '',
  description: '',
  billable: true,
  hourly_rate: '' // dollars string in the UI; converted to hourly_rate_cents on submit
};

/**
 * Inline error banner that exposes the BTT error code via data-error-code (PRD ch.0.9).
 * @param {{error: {code: string|null, message: string}|null}} props - error to render; renders nothing when null.
 * @returns {JSX.Element|null} the banner element or null.
 */
export function BttErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div
      data-error-code={error.code || ''}
      style={{
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--accent-danger)',
        fontSize: '0.875rem'
      }}
    >
      {error.code ? `${error.code}: ` : ''}{error.message}
    </div>
  );
}

/**
 * Shared create/edit modal for time entries, used by both the list page and the
 * week-view page. Presentational only: submission is injected via onSubmit and
 * no HTTP happens here (PRD ch.0.13).
 * @param {object} props
 * @param {boolean} props.open - whether the modal is visible.
 * @param {function(): void} props.onClose - close handler (cancel / overlay click / after save).
 * @param {function(object): Promise<{ok: boolean, error?: {code: string|null, message: string}}>} props.onSubmit -
 *   async submit handler receiving the API payload; must resolve to {ok, error?}.
 * @param {Array<object>} props.projects - projects for the select dropdown.
 * @param {object|null} [props.initialEntry] - entry to edit; null/omitted means create mode.
 * @param {string} [props.initialWorkDate] - prefilled work_date (YYYY-MM-DD) in create mode (e.g. week grid cell).
 * @returns {JSX.Element} the modal wrapped in AnimatePresence.
 */
export default function TimeEntryFormModal({
  open,
  onClose,
  onSubmit,
  projects,
  initialEntry = null,
  initialWorkDate = ''
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialEntry) {
      setForm({
        project_id: initialEntry.project_id.toString(),
        work_date: initialEntry.work_date,
        duration_minutes: initialEntry.duration_minutes.toString(),
        description: initialEntry.description,
        billable: initialEntry.billable,
        hourly_rate: centsToDollarsString(initialEntry.hourly_rate_cents)
      });
    } else {
      setForm({ ...EMPTY_FORM, work_date: initialWorkDate || todayIso() });
    }
    setError(null);
    setSaving(false);
  }, [open, initialEntry, initialWorkDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const minutes = Number(form.duration_minutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError({ code: 'BTT_E001', message: 'duration_minutes must be a positive integer' });
      return;
    }

    const payload = {
      project_id: parseInt(form.project_id, 10),
      work_date: form.work_date,
      duration_minutes: minutes,
      description: form.description.trim(),
      billable: form.billable,
      hourly_rate_cents: form.billable ? dollarsToCents(form.hourly_rate) : null
    };

    setSaving(true);
    const result = await onSubmit(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
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
              <h3>{initialEntry ? 'Edit Entry' : 'New Entry'}</h3>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                style={{ padding: '0.5rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <BttErrorBanner error={error} />

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
                      placeholder="90"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      min="1"
                      step="1"
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Max {BTT_MAX_MINUTES_PER_DAY} minutes per day across all entries
                    </small>
                  </div>
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
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {form.description.length}/{BTT_DESC_MAX}
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.billable}
                        onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                      />
                      Billable
                    </label>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Hourly Rate ($)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="150.00"
                      value={form.hourly_rate}
                      onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                      min="0"
                      step="0.01"
                      disabled={!form.billable}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : initialEntry ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
