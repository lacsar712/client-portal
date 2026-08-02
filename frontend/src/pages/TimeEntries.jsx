import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Clock, Edit2, Trash2, Send, X,
  CheckCircle, XCircle, CalendarDays, FolderKanban, Receipt
} from 'lucide-react';
import {
  fetchTimeEntries,
  fetchProjectsForEntries,
  fetchInvoicesForWriteOff,
  deleteTimeEntry,
  transitionTimeEntry,
  writeOffTimeEntry,
  extractBttErrorCode,
  BTT_STATUS,
} from '../services/timeEntriesApi';
import { formatCents, formatMinutes } from '../utils/bttMoney';
import TimeEntryFormModal from '../components/TimeEntryFormModal';

// Status chip styling, keyed by the frozen status literals (PRD 0.7).
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
  submitted: { label: 'Submitted', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
  written_off: { label: 'Written Off', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
};

export default function TimeEntries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rowError, setRowError] = useState(null);

  // Write-off modal state (PRD 5.3 / chapter 8).
  const [writeOffEntry, setWriteOffEntry] = useState(null);
  const [writeOffInvoiceId, setWriteOffInvoiceId] = useState('');
  const [writeOffError, setWriteOffError] = useState(null);

  const loadEntries = async () => {
    try {
      const data = await fetchTimeEntries({
        project_id: filterProject ? parseInt(filterProject) : undefined,
        status: filterStatus || undefined,
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
      });
      setEntries(data);
    } catch (err) {
      console.error('Failed to load time entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      setProjects(await fetchProjectsForEntries());
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadInvoices = async () => {
    try {
      setInvoices(await fetchInvoicesForWriteOff());
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadInvoices();
  }, []);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, filterStatus, filterFrom, filterTo]);

  // Keep the status filter reflected in the URL (?status=approved from Dashboard).
  useEffect(() => {
    const current = searchParams.get('status') || '';
    if (current !== filterStatus) {
      const next = new URLSearchParams(searchParams);
      if (filterStatus) next.set('status', filterStatus);
      else next.delete('status');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const openNewModal = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEditModal = (entry) => {
    setEditing(entry);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditing(null);
    loadEntries();
  };

  const runTransition = async (entry, toStatus, rejectReason) => {
    setRowError(null);
    try {
      await transitionTimeEntry(entry.id, toStatus, rejectReason);
      loadEntries();
    } catch (err) {
      const code = extractBttErrorCode(err);
      setRowError({ id: entry.id, code: code || 'Transition failed' });
    }
  };

  const handleReject = (entry) => {
    const reason = prompt('Reject reason (optional):') || undefined;
    runTransition(entry, BTT_STATUS.REJECTED, reason);
  };

  const handleDelete = async (entry) => {
    if (!confirm('Delete this time entry?')) return;
    setRowError(null);
    try {
      await deleteTimeEntry(entry.id);
      loadEntries();
    } catch (err) {
      const code = extractBttErrorCode(err);
      setRowError({ id: entry.id, code: code || 'Delete failed' });
    }
  };

  const openWriteOff = (entry) => {
    setWriteOffEntry(entry);
    setWriteOffInvoiceId('');
    setWriteOffError(null);
  };

  const submitWriteOff = async (e) => {
    e.preventDefault();
    if (!writeOffEntry) return;
    setWriteOffError(null);
    try {
      await writeOffTimeEntry(writeOffEntry.id, parseInt(writeOffInvoiceId, 10));
      setWriteOffEntry(null);
      setWriteOffInvoiceId('');
      loadEntries();
    } catch (err) {
      setWriteOffError(extractBttErrorCode(err) || 'Write-off failed');
    }
  };

  const projectName = (id) => projects.find((p) => p.id === id)?.name || '—';
  const hasEntries = entries.length > 0;

  const stats = useMemo(() => {
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const billableCents = entries.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
    return { totalMinutes, billableCents, count: entries.length };
  }, [entries]);

  if (loading) {
    return (
      <div className="loader" style={{ height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-nav="time-tracking">
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Time Tracking</h1>
          <p>Log billable hours and move them through review</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/time-entries/week" className="btn btn-secondary">
            <CalendarDays size={18} />
            Week View
          </Link>
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {[
            { label: 'Entries', value: String(stats.count), color: 'var(--text-primary)' },
            { label: 'Total Time', value: formatMinutes(stats.totalMinutes), color: 'var(--accent-primary)' },
            { label: 'Billable Amount', value: formatCents(stats.billableCents), color: 'var(--accent-warning)' },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>

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
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              style={{ width: 'auto', minWidth: 160 }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto', minWidth: 150 }}
            >
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <div className="input-group" style={{ margin: 0 }}>
              <input
                type="date"
                className="input"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                style={{ width: 'auto' }}
                aria-label="Date from"
              />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <input
                type="date"
                className="input"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                style={{ width: 'auto' }}
                aria-label="Date to"
              />
            </div>
          </div>
        </motion.div>

        {/* Table or empty state */}
        {hasEntries ? (
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
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.draft;
                  const isDraft = entry.status === BTT_STATUS.DRAFT;
                  const isSubmitted = entry.status === BTT_STATUS.SUBMITTED;
                  const isRejected = entry.status === BTT_STATUS.REJECTED;
                  const isApproved = entry.status === BTT_STATUS.APPROVED;
                  const canWriteOff = isApproved && entry.billable;
                  const canDelete = isDraft || isRejected;
                  const errForRow = rowError && rowError.id === entry.id ? rowError.code : null;

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <td>{entry.work_date}</td>
                      <td>{entry.project_name || projectName(entry.project_id)}</td>
                      <td>{formatMinutes(entry.duration_minutes)}</td>
                      <td>{entry.billable ? 'Yes' : 'No'}</td>
                      <td>{entry.hourly_rate_cents != null ? formatCents(entry.hourly_rate_cents) : '—'}</td>
                      <td>
                        <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td>{entry.billable ? formatCents(entry.amount_cents) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {isDraft && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditModal(entry)}
                              style={{ padding: '0.375rem' }}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {isDraft && (
                            <button
                              className="btn btn-sm"
                              onClick={() => runTransition(entry, BTT_STATUS.SUBMITTED)}
                              style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                            >
                              <Send size={14} /> Submit
                            </button>
                          )}
                          {isSubmitted && (
                            <button
                              className="btn btn-sm"
                              onClick={() => runTransition(entry, BTT_STATUS.APPROVED)}
                              style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                          )}
                          {isSubmitted && (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleReject(entry)}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          )}
                          {isRejected && (
                            <button
                              className="btn btn-sm"
                              onClick={() => runTransition(entry, BTT_STATUS.DRAFT)}
                              style={{ background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(100, 116, 139, 0.2)' }}
                            >
                              Reopen
                            </button>
                          )}
                          {canWriteOff && (
                            <button
                              className="btn btn-sm"
                              onClick={() => openWriteOff(entry)}
                              style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                            >
                              <Receipt size={14} /> Write off
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(entry)}
                              style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {errForRow && (
                            <span
                              data-error-code={errForRow}
                              style={{ color: 'var(--accent-danger)', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              {errForRow}
                            </span>
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
              <Clock size={40} />
            </div>
            <h3>No time entries yet</h3>
            <p>Create your first entry, or set up a project to bill against.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={openNewModal}>
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

      {/* Shared create/edit modal (reused by the week view). */}
      <TimeEntryFormModal
        open={showModal}
        projects={projects}
        editing={editing}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />

      {/* Write-off modal: pick a target invoice (PRD 5.3 / chapter 8). */}
      <AnimatePresence>
        {writeOffEntry && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWriteOffEntry(null)}
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
                <button className="btn btn-ghost" onClick={() => setWriteOffEntry(null)} style={{ padding: '0.5rem' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={submitWriteOff}>
                <div className="modal-body">
                  {writeOffError && (
                    <div
                      data-error-code={writeOffError}
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
                      {writeOffError}
                    </div>
                  )}
                  <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Billing <strong>{formatMinutes(writeOffEntry.duration_minutes)}</strong> at{' '}
                    <strong>{formatCents(writeOffEntry.hourly_rate_cents)}</strong>/hr →{' '}
                    <strong>{formatCents(writeOffEntry.amount_cents)}</strong>
                  </p>
                  <div className="input-group">
                    <label>Invoice</label>
                    <select
                      className="input"
                      value={writeOffInvoiceId}
                      onChange={(e) => setWriteOffInvoiceId(e.target.value)}
                      required
                    >
                      <option value="">Select an invoice</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {inv.client_name || 'No client'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setWriteOffEntry(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!writeOffInvoiceId}>
                    Write off
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
