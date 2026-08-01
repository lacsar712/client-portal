import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet } from 'lucide-react';
import { BttErrorBanner } from './TimeEntryFormModal';
import { formatCents } from '../utils/bttMoney';
import { formatDurationMinutes } from '../utils/bttTime';

/**
 * Modal for writing off an approved billable time entry into an invoice (PRD
 * NX-PRD-BTT-2026-08 ch.8). Presentational only: the write-off request is
 * injected via onSubmit and errors (BTT_E005/E007/...) render with data-error-code.
 * @param {object} props
 * @param {boolean} props.open - whether the modal is visible.
 * @param {function(): void} props.onClose - close handler.
 * @param {function(number): Promise<{ok: boolean, error?: {code: string|null, message: string}}>} props.onSubmit -
 *   async handler receiving the chosen invoice id; must resolve to {ok, error?}.
 * @param {object|null} props.entry - the entry being written off (approved + billable).
 * @param {Array<object>} props.invoices - invoices of the current user for the picker.
 * @returns {JSX.Element} the modal wrapped in AnimatePresence.
 */
export default function TimeEntryWriteOffModal({ open, onClose, onSubmit, entry, invoices }) {
  const [invoiceId, setInvoiceId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInvoiceId('');
    setError(null);
    setSaving(false);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await onSubmit(parseInt(invoiceId, 10));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && entry && (
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
            style={{ maxWidth: 480 }}
          >
            <div className="modal-header">
              <h3>Write off to Invoice</h3>
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

                {/* Entry summary */}
                <div style={{
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Wallet size={16} style={{ color: 'var(--accent-primary)' }} />
                    <strong>BTT#{entry.id}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{entry.work_date}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {formatDurationMinutes(entry.duration_minutes)} · {formatCents(entry.amount_cents)}
                  </div>
                  <div style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                    marginTop: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {entry.description}
                  </div>
                </div>

                <div className="input-group">
                  <label>Target Invoice</label>
                  <select
                    className="input"
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                    required
                  >
                    <option value="">Select an invoice</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} · {inv.client_name || 'Unknown'} · {inv.status}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    A line "BTT#{entry.id} {entry.work_date} · ..." will be appended to the invoice
                  </small>
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
                  {saving ? 'Writing off...' : 'Write off'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
