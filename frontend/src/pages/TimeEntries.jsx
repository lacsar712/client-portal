import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Clock, Edit2, Trash2, X, CheckCircle2,
  Send, CircleX, Timer, AlertCircle, FileClock, CalendarRange,
  Receipt,
} from 'lucide-react';
import { useTimeEntries } from '../hooks/useTimeEntries';
import {
  TIME_ENTRY_STATUS,
  TIME_ENTRY_STATUS_ORDER,
  TIME_ENTRY_STATUS_CONFIG,
} from '../utils/bttConstants';
import { formatCents, formatDuration, formatDate } from '../utils/bttMoney';
import TimeEntryFormModal from '../components/TimeEntryFormModal';

/**
 * Determine which transition action buttons are applicable for a given status.
 *
 * @param {string} status - Current entry status literal.
 * @returns {Array<{to: string, label: string, icon: any, variant: string}>}
 */
function actionsForStatus(status) {
  switch (status) {
    case TIME_ENTRY_STATUS.DRAFT:
      return [{ to: TIME_ENTRY_STATUS.SUBMITTED, label: 'Submit', icon: Send, variant: 'primary' }];
    case TIME_ENTRY_STATUS.SUBMITTED:
      return [
        { to: TIME_ENTRY_STATUS.APPROVED, label: 'Approve', icon: CheckCircle2, variant: 'primary' },
        { to: TIME_ENTRY_STATUS.REJECTED, label: 'Reject', icon: CircleX, variant: 'danger' },
      ];
    case TIME_ENTRY_STATUS.REJECTED:
      return [{ to: TIME_ENTRY_STATUS.DRAFT, label: 'Revise', icon: Edit2, variant: 'secondary' }];
    default:
      return [];
  }
}

export default function TimeEntries() {
  const {
    entries,
    projects,
    invoices,
    loading,
    filters,
    setFilters,
    saving,
    error,
    clearError,
    createEntry,
    updateEntry,
    removeEntry,
    transition,
    writeOff,
  } = useTimeEntries();

  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [writeOffInvoiceId, setWriteOffInvoiceId] = useState('');

  // Sync ?status=approved (from the Dashboard card click) into the status filter.
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && statusParam !== filters.status) {
      setFilters({ status: statusParam });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearStatusParam = () => {
    if (searchParams.has('status')) {
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      setSearchParams(next, { replace: true });
    }
  };

  const projectName = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => map.set(p.id, p.name));
    return (id) => map.get(id) || `Project #${id}`;
  }, [projects]);

  const openCreate = () => {
    setEditingEntry(null);
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
  };

  const handleSubmit = async (payload) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, payload);
    } else {
      await createEntry(payload);
    }
    closeModal();
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete time entry for ${formatDate(entry.work_date)}?`)) return;
    try {
      await removeEntry(entry.id);
    } catch (err) {
      // global error already surfaced via hook
    }
  };

  const handleTransition = async (entry, toStatus) => {
    if (toStatus === TIME_ENTRY_STATUS.REJECTED) {
      setRejectTarget(entry);
      setRejectReason('');
      return;
    }
    try {
      await transition(entry.id, toStatus);
    } catch (err) {
      // surfaced globally
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await transition(rejectTarget.id, TIME_ENTRY_STATUS.REJECTED, rejectReason.trim() || null);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      // surfaced globally
    }
  };

  const openWriteOff = (entry) => {
    setWriteOffTarget(entry);
    setWriteOffInvoiceId('');
  };

  const confirmWriteOff = async () => {
    if (!writeOffTarget || !writeOffInvoiceId) return;
    try {
      await writeOff(writeOffTarget.id, parseInt(writeOffInvoiceId, 10));
      setWriteOffTarget(null);
      setWriteOffInvoiceId('');
    } catch (err) {
      // error surfaced globally (BTT_E005 / E007 / E006)
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
          <h1>Time Tracking</h1>
          <p>Track billable hours and move them through your approval workflow</p>
        </div>
        <div className="header-actions">
          <Link to="/time-entries/week" className="btn btn-secondary">
            <CalendarRange size={18} />
            Week View
          </Link>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Global error banner (surfaces BTT_E00x from the API) */}
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

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div className="input-group">
              <label>Project</label>
              <select
                className="input"
                value={filters.project_id}
                onChange={(e) => setFilters({ project_id: e.target.value })}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Status</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => {
                  setFilters({ status: e.target.value });
                  if (searchParams.has('status')) clearStatusParam();
                }}
              >
                <option value="">All Status</option>
                {TIME_ENTRY_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{TIME_ENTRY_STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Date From</label>
              <input
                type="date"
                className="input"
                value={filters.date_from}
                onChange={(e) => setFilters({ date_from: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Date To</label>
              <input
                type="date"
                className="input"
                value={filters.date_to}
                onChange={(e) => setFilters({ date_to: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Billable</label>
              <select
                className="input"
                value={filters.billable}
                onChange={(e) => setFilters({ billable: e.target.value })}
              >
                <option value="">All</option>
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        {entries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="table-container"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Duration</th>
                  <th>Billable</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const statusCfg = TIME_ENTRY_STATUS_CONFIG[entry.status];
                  const actions = actionsForStatus(entry.status);
                  const isDraft = entry.status === TIME_ENTRY_STATUS.DRAFT;
                  const isRejected = entry.status === TIME_ENTRY_STATUS.REJECTED;
                  const isApprovedBillable =
                    entry.status === TIME_ENTRY_STATUS.APPROVED && entry.billable;
                  const isWrittenOff = entry.status === TIME_ENTRY_STATUS.WRITTEN_OFF;

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.work_date)}</td>
                      <td>{entry.project_name || projectName(entry.project_id)}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          {formatDuration(entry.duration_minutes)}
                        </span>
                      </td>
                      <td>
                        {entry.billable ? (
                          <span className="badge badge-success">Billable</span>
                        ) : (
                          <span className="badge badge-secondary">Non-billable</span>
                        )}
                      </td>
                      <td>
                        {entry.billable && entry.hourly_rate_cents
                          ? formatCents(entry.hourly_rate_cents) + '/hr'
                          : '\u2014'}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}
                        >
                          {statusCfg.label}
                        </span>
                        {isRejected && entry.reject_reason && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--accent-danger)',
                              marginTop: '0.25rem',
                              maxWidth: 200,
                            }}
                          >
                            {entry.reject_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatCents(entry.amount_cents)}
                        {isWrittenOff && entry.invoice_id && (
                          <Link
                            to="/invoices"
                            style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, marginTop: '0.15rem' }}
                          >
                            Invoice #{entry.invoice_id}
                          </Link>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          {isDraft && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEdit(entry)}
                              title="Edit"
                              style={{ padding: '0.375rem' }}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
                          {isApprovedBillable && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openWriteOff(entry)}
                              title="Write off to invoice"
                              style={{ padding: '0.375rem 0.625rem' }}
                            >
                              <Receipt size={14} />
                              <span style={{ fontSize: '0.75rem' }}>Write off</span>
                            </button>
                          )}
                          {actions.map((action) => {
                            const Icon = action.icon;
                            const btnClass =
                              action.variant === 'danger'
                                ? 'btn btn-danger btn-sm'
                                : action.variant === 'primary'
                                ? 'btn btn-primary btn-sm'
                                : 'btn btn-secondary btn-sm';
                            return (
                              <button
                                key={action.to}
                                className={btnClass}
                                onClick={() => handleTransition(entry, action.to)}
                                title={action.label}
                                style={{ padding: '0.375rem 0.625rem' }}
                              >
                                <Icon size={14} />
                                <span style={{ fontSize: '0.75rem' }}>{action.label}</span>
                              </button>
                            );
                          })}
                          {(isDraft || isRejected) && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(entry)}
                              title="Delete"
                              style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Timer size={40} />
            </div>
            <h3>No time entries yet</h3>
            <p>Log your first billable hour. You'll need a project to associate it with.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={18} />
                New Entry
              </button>
              <Link to="/projects" className="btn btn-secondary">
                <FileClock size={18} />
                Go to Projects
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal (shared with week view) */}
      <TimeEntryFormModal
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        projects={projects}
        entry={editingEntry}
        saving={saving}
        serverError={null}
      />

      {/* Reject reason Modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRejectTarget(null)}
            style={{ zIndex: 1001 }}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Reject Time Entry</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setRejectTarget(null)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Optionally provide a reason. The entry will return to draft so it can be revised.
                </p>
                <div className="input-group">
                  <label>Reason</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Why are you rejecting this entry?"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={confirmReject} disabled={saving}>
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Write-off invoice picker Modal */}
      <AnimatePresence>
        {writeOffTarget && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWriteOffTarget(null)}
            style={{ zIndex: 1002 }}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Write Off to Invoice</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setWriteOffTarget(null)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Approve a billable entry and append it as a line item to one of your invoices.
                  Amount: <strong style={{ color: 'var(--accent-primary)' }}>
                    {formatCents(writeOffTarget.amount_cents)}
                  </strong>
                </p>
                <div className="input-group">
                  <label>Invoice</label>
                  <select
                    className="input"
                    value={writeOffInvoiceId}
                    onChange={(e) => setWriteOffInvoiceId(e.target.value)}
                  >
                    <option value="">Select an invoice…</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {inv.client_name || `Client #${inv.client_id}`} (${inv.total})
                      </option>
                    ))}
                  </select>
                </div>
                {invoices.length === 0 && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--accent-warning)' }}>
                    You need at least one invoice to write off against.
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setWriteOffTarget(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmWriteOff}
                  disabled={saving || !writeOffInvoiceId}
                >
                  <Receipt size={16} />
                  {saving ? 'Writing off…' : 'Confirm Write Off'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
