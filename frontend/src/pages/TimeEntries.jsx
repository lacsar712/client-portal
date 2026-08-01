import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Clock, Edit2, Trash2, Send,
  CheckCircle2, XCircle, RotateCcw, Calendar, CalendarDays, Wallet
} from 'lucide-react';
import { useTimeEntries } from '../hooks/useTimeEntries';
import TimeEntryFormModal, { BttErrorBanner } from '../components/TimeEntryFormModal';
import TimeEntryWriteOffModal from '../components/TimeEntryWriteOffModal';
import { formatCents } from '../utils/bttMoney';
import { formatDurationMinutes } from '../utils/bttTime';
import { BTT_STATUS, BTT_STATUS_CONFIG, BTT_ROUTE_WEEK } from '../utils/bttConstants';

export default function TimeEntries() {
  const [searchParams] = useSearchParams();
  const {
    entries, projects, invoices, loading, error,
    filters, setFilters,
    createEntry, updateEntry, deleteEntry, transitionEntry, writeOffEntry
  } = useTimeEntries({ status: searchParams.get('status') || '' });

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [actionError, setActionError] = useState(null);

  const openCreateModal = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleModalSubmit = async (payload) => {
    const result = editingEntry
      ? await updateEntry(editingEntry.id, payload)
      : await createEntry(payload);
    if (result.ok) setShowModal(false);
    return result; // errors surface inside the shared modal (data-error-code)
  };

  const handleTransition = async (entry, toStatus) => {
    let reason;
    if (toStatus === BTT_STATUS.REJECTED) {
      reason = window.prompt('Reject reason (optional):', entry.reject_reason || '');
      if (reason === null) return; // cancelled
    }
    const result = await transitionEntry(entry.id, toStatus, reason);
    setActionError(result.ok ? null : result.error);
  };

  const handleDelete = async (entry) => {
    if (!confirm('Delete this time entry?')) return;
    const result = await deleteEntry(entry.id);
    setActionError(result.ok ? null : result.error);
  };

  const handleWriteOffSubmit = async (invoiceId) => {
    const result = await writeOffEntry(writeOffTarget.id, invoiceId);
    if (result.ok) setWriteOffTarget(null);
    return result; // errors surface inside the write-off modal (data-error-code)
  };

  if (loading && entries.length === 0) {
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
          <p>Log billable hours, submit for approval and track write-offs</p>
        </div>
        <div className="header-actions">
          <Link to={BTT_ROUTE_WEEK} className="btn btn-secondary">
            <CalendarDays size={18} />
            Week View
          </Link>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      <div className="page-container">
        <BttErrorBanner error={actionError || error} />

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={filters.project_id}
              onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
              style={{ width: 'auto', minWidth: 180 }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ width: 'auto', minWidth: 150 }}
            >
              <option value="">All Status</option>
              {Object.entries(BTT_STATUS_CONFIG).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="input"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              style={{ width: 'auto' }}
              title="From date"
            />
            <input
              type="date"
              className="input"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              style={{ width: 'auto' }}
              title="To date"
            />
          </div>
        </motion.div>

        {/* Entries table */}
        {entries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card table-container"
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
                  const statusCfg = BTT_STATUS_CONFIG[entry.status] || BTT_STATUS_CONFIG.draft;
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {entry.work_date}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{entry.project_name || `#${entry.project_id}`}</div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={entry.description}
                        >
                          {entry.description}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDurationMinutes(entry.duration_minutes)}</td>
                      <td>
                        <span
                          className="badge"
                          style={entry.billable
                            ? { background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }
                            : { background: 'rgba(100, 116, 139, 0.15)', color: '#64748B' }}
                        >
                          {entry.billable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {entry.hourly_rate_cents != null ? `${formatCents(entry.hourly_rate_cents)}/h` : '—'}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}
                          title={entry.status === BTT_STATUS.REJECTED && entry.reject_reason ? entry.reject_reason : undefined}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{formatCents(entry.amount_cents)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {entry.status === BTT_STATUS.DRAFT && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem' }}
                                title="Edit"
                                onClick={() => openEditModal(entry)}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem', color: 'var(--accent-info)' }}
                                title="Submit"
                                onClick={() => handleTransition(entry, BTT_STATUS.SUBMITTED)}
                              >
                                <Send size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                                title="Delete"
                                onClick={() => handleDelete(entry)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {entry.status === BTT_STATUS.SUBMITTED && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem', color: 'var(--accent-primary)' }}
                                title="Approve"
                                onClick={() => handleTransition(entry, BTT_STATUS.APPROVED)}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                                title="Reject"
                                onClick={() => handleTransition(entry, BTT_STATUS.REJECTED)}
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {entry.status === BTT_STATUS.REJECTED && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem' }}
                                title="Reopen as draft"
                                onClick={() => handleTransition(entry, BTT_STATUS.DRAFT)}
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                                title="Delete"
                                onClick={() => handleDelete(entry)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {entry.status === BTT_STATUS.APPROVED && entry.billable && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0.375rem', color: '#8B5CF6' }}
                              title="Write off to invoice"
                              onClick={() => setWriteOffTarget(entry)}
                            >
                              <Wallet size={16} />
                            </button>
                          )}
                          {entry.status === BTT_STATUS.APPROVED && !entry.billable && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                          {entry.status === BTT_STATUS.WRITTEN_OFF && (
                            <span
                              style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                              title={entry.invoice_id ? `Written off to invoice #${entry.invoice_id}` : 'Written off'}
                            >
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Clock size={40} />
            </div>
            <h3>No time entries yet</h3>
            <p>Log billable work against one of your projects. Need a project first?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/projects" className="btn btn-secondary">
                Go to Projects
              </Link>
              <button className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={18} />
                New Entry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit modal (shared with the week view) */}
      <TimeEntryFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
        projects={projects}
        initialEntry={editingEntry}
      />

      {/* Write-off modal: pick a target invoice for approved + billable entries */}
      <TimeEntryWriteOffModal
        open={writeOffTarget !== null}
        onClose={() => setWriteOffTarget(null)}
        onSubmit={handleWriteOffSubmit}
        entry={writeOffTarget}
        invoices={invoices}
      />
    </div>
  );
}
