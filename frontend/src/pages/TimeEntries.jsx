import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Calendar, Clock, Edit2, Trash2, X,
  CheckCircle2, Send, CircleX, Timer, FolderKanban, AlertCircle,
  CalendarDays, FileCheck
} from 'lucide-react';
import { useTimeEntries } from '../hooks/useTimeEntries';
import {
  TIME_ENTRY_STATUS_CONFIG,
  TimeEntryStatus,
  formatCents,
  formatDuration,
  formatDate,
  toISODate,
  centsToDollarsInput,
  dollarsToCents,
  BTT_DESC_MAX
} from '../utils/bttMoney';

const EMPTY_FORM = {
  project_id: '',
  work_date: toISODate(new Date()),
  duration_minutes: '',
  description: '',
  billable: true,
  hourly_rate_cents: ''
};

export default function TimeEntries() {
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || 'all';
  const {
    entries,
    projects,
    invoices,
    loading,
    filters,
    setFilters,
    createEntry,
    updateEntry,
    removeEntry,
    transition,
    writeOff,
    error,
    clearError
  } = useTimeEntries();

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [writeOffInvoiceId, setWriteOffInvoiceId] = useState('');
  const [writeOffError, setWriteOffError] = useState(null);
  const [writeOffSaving, setWriteOffSaving] = useState(false);

  // Apply URL status filter on mount (e.g. from Dashboard card link)
  useEffect(() => {
    if (urlStatus !== 'all') {
      setFilters((prev) => ({ ...prev, status: urlStatus }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingEntry(null);
    setForm({ ...EMPTY_FORM, work_date: toISODate(new Date()) });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      project_id: String(entry.project_id),
      work_date: entry.work_date,
      duration_minutes: String(entry.duration_minutes),
      description: entry.description,
      billable: entry.billable,
      hourly_rate_cents: entry.hourly_rate_cents !== null && entry.hourly_rate_cents !== undefined
        ? centsToDollarsInput(entry.hourly_rate_cents)
        : ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setFormError(null);
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

    const payload = {
      project_id: parseInt(form.project_id, 10),
      work_date: form.work_date,
      duration_minutes: minutes,
      description,
      billable: form.billable,
      hourly_rate_cents: form.billable && form.hourly_rate_cents !== ''
        ? dollarsToCents(form.hourly_rate_cents)
        : null
    };

    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, payload);
      } else {
        await createEntry(payload);
      }
      closeModal();
    } catch (err) {
      setFormError(err);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await removeEntry(entry.id);
    } catch (err) {
      // error is surfaced via hook-level error state
    }
  };

  const handleTransition = async (entry, toStatus, rejectReasonText) => {
    try {
      await transition(entry.id, toStatus, rejectReasonText);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      // surfaced via hook error
    }
  };

  const openWriteOff = (entry) => {
    setWriteOffTarget(entry);
    setWriteOffInvoiceId('');
    setWriteOffError(null);
    setWriteOffSaving(false);
  };

  const closeWriteOff = () => {
    setWriteOffTarget(null);
    setWriteOffInvoiceId('');
    setWriteOffError(null);
    setWriteOffSaving(false);
  };

  const handleWriteOffSubmit = async (e) => {
    e.preventDefault();
    if (!writeOffInvoiceId) {
      setWriteOffError({ code: 'BTT_E006', message: 'BTT_E006: Please select an invoice' });
      return;
    }
    setWriteOffSaving(true);
    setWriteOffError(null);
    try {
      await writeOff(writeOffTarget.id, parseInt(writeOffInvoiceId, 10));
      closeWriteOff();
    } catch (err) {
      setWriteOffError(err);
      setWriteOffSaving(false);
    }
  };

  const renderActions = (entry) => {
    const buttons = [];

    if (entry.status === TimeEntryStatus.DRAFT) {
      buttons.push(
        <button
          key="edit"
          className="btn btn-ghost btn-sm"
          onClick={() => openEdit(entry)}
          title="Edit"
          data-action="edit"
        >
          <Edit2 size={14} />
        </button>
      );
      buttons.push(
        <button
          key="submit"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-warning)' }}
          onClick={() => handleTransition(entry, TimeEntryStatus.SUBMITTED)}
          title="Submit"
          data-action="submit"
        >
          <Send size={14} />
        </button>
      );
    }

    if (entry.status === TimeEntryStatus.SUBMITTED) {
      buttons.push(
        <button
          key="approve"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-primary)' }}
          onClick={() => handleTransition(entry, TimeEntryStatus.APPROVED)}
          title="Approve"
          data-action="approve"
        >
          <CheckCircle2 size={14} />
        </button>
      );
      buttons.push(
        <button
          key="reject"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-danger)' }}
          onClick={() => { setRejectTarget(entry); setRejectReason(''); }}
          title="Reject"
          data-action="reject"
        >
          <CircleX size={14} />
        </button>
      );
    }

    if (entry.status === TimeEntryStatus.REJECTED) {
      buttons.push(
        <button
          key="resubmit"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-primary)' }}
          onClick={() => handleTransition(entry, TimeEntryStatus.DRAFT)}
          title="Reopen as Draft"
          data-action="reopen"
        >
          <Edit2 size={14} />
        </button>
      );
    }

    if (entry.status === TimeEntryStatus.APPROVED && entry.billable) {
      buttons.push(
        <button
          key="writeoff"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-secondary)' }}
          onClick={() => openWriteOff(entry)}
          title="Write off to invoice"
          data-action="writeoff"
        >
          <FileCheck size={14} />
        </button>
      );
    }

    if (entry.status === TimeEntryStatus.DRAFT || entry.status === TimeEntryStatus.REJECTED) {
      buttons.push(
        <button
          key="delete"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-danger)' }}
          onClick={() => handleDelete(entry)}
          title="Delete"
          data-action="delete"
        >
          <Trash2 size={14} />
        </button>
      );
    }

    return <div style={{ display: 'flex', gap: '0.25rem' }}>{buttons}</div>;
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
          <p>Record, submit and approve billable hours</p>
        </div>
        <div className="header-actions">
          <Link to="/time-entries/week" className="btn btn-secondary">
            <CalendarDays size={18} />
            Week View
          </Link>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Global error banner */}
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
              <AlertCircle size={18} />
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

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="input-group">
              <label>Project</label>
              <select
                className="input"
                value={filters.project_id}
                onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
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
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All Status</option>
                {Object.values(TimeEntryStatus).map((s) => (
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
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Date To</label>
              <input
                type="date"
                className="input"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Billable</label>
              <select
                className="input"
                value={filters.billable}
                onChange={(e) => setFilters({ ...filters, billable: e.target.value })}
              >
                <option value="all">All</option>
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
            transition={{ delay: 0.1 }}
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const sc = TIME_ENTRY_STATUS_CONFIG[entry.status];
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {formatDate(entry.work_date)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{entry.project_name || `Project #${entry.project_id}`}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          {formatDuration(entry.duration_minutes)}
                        </div>
                      </td>
                      <td>
                        {entry.billable ? (
                          <span className="badge badge-success">Billable</span>
                        ) : (
                          <span className="badge badge-secondary">Non-billable</span>
                        )}
                      </td>
                      <td>{entry.billable ? formatCents(entry.hourly_rate_cents) : '—'}</td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                        {entry.status === TimeEntryStatus.REJECTED && entry.reject_reason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-danger)', marginTop: '0.25rem' }}>
                            {entry.reject_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {entry.billable ? formatCents(entry.amount_cents) : '—'}
                      </td>
                      <td>{renderActions(entry)}</td>
                    </tr>
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
            <p>Create your first time entry to start tracking billable hours for your projects.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={18} />
                New Entry
              </button>
              <Link to="/projects" className="btn btn-secondary">
                <FolderKanban size={18} />
                Go to Projects
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
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
                <h3>{editingEntry ? 'Edit Time Entry' : 'New Time Entry'}</h3>
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
                        min="1"
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
                      id="billable"
                      checked={form.billable}
                      onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="billable" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
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
                  <button type="submit" className="btn btn-primary">
                    {editingEntry ? 'Save Changes' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject reason modal */}
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
              style={{ maxWidth: 420 }}
            >
              <div className="modal-header">
                <h3>Reject Entry</h3>
                <button className="btn btn-ghost" onClick={() => setRejectTarget(null)} style={{ padding: '0.5rem' }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Optionally provide a reason for rejecting this time entry.
                </p>
                <div className="input-group">
                  <label>Reason (optional)</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Please adjust the description"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleTransition(rejectTarget, TimeEntryStatus.REJECTED, rejectReason.trim())}
                >
                  <CircleX size={16} />
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Write-off modal */}
      <AnimatePresence>
        {writeOffTarget && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeWriteOff}
            style={{ zIndex: 1002 }}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 460 }}
            >
              <div className="modal-header">
                <h3>
                  <FileCheck size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                  Write Off to Invoice
                </h3>
                <button className="btn btn-ghost" onClick={closeWriteOff} style={{ padding: '0.5rem' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleWriteOffSubmit}>
                <div className="modal-body">
                  {writeOffError && (
                    <div
                      data-error-code={writeOffError.code}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-danger)',
                        fontSize: '0.875rem'
                      }}
                    >
                      {writeOffError.message}
                    </div>
                  )}

                  <div style={{
                    padding: '0.875rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ marginBottom: '0.375rem' }}>
                      <strong>{writeOffTarget.project_name || `Project #${writeOffTarget.project_id}`}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      {formatDate(writeOffTarget.work_date)} · {formatDuration(writeOffTarget.duration_minutes)}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {writeOffTarget.description}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      Amount: {formatCents(writeOffTarget.amount_cents)}
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Target Invoice</label>
                    <select
                      className="input"
                      value={writeOffInvoiceId}
                      onChange={(e) => setWriteOffInvoiceId(e.target.value)}
                      required
                    >
                      <option value="">Select an invoice…</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {inv.client_name || `Client #${inv.client_id}`} (${(inv.total || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeWriteOff}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={writeOffSaving}>
                    {writeOffSaving ? 'Writing off…' : (
                      <>
                        <FileCheck size={16} />
                        Write Off
                      </>
                    )}
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
