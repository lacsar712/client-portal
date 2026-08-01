import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, FileText, DollarSign, Calendar,
  CheckCircle, AlertTriangle, Send,
  Edit2, Trash2, X, Copy, Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)', icon: FileText },
  sent: { label: 'Sent', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', icon: Send },
  paid: { label: 'Paid', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
  overdue: { label: 'Overdue', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertTriangle },
  partially_paid: { label: 'Partially Paid', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', icon: Wallet },
  cancelled: { label: 'Cancelled', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.18)', icon: X }
};

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'custom', label: 'Custom' }
];

const PAYMENT_DAYS = {
  due_on_receipt: 0,
  net_7: 7,
  net_15: 15,
  net_30: 30,
  net_60: 60,
  custom: 30
};

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0 };

const getDefaultForm = () => {
  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const due = new Date(today);
  due.setDate(today.getDate() + PAYMENT_DAYS.net_30);
  return {
    issue_date: issueDate,
    due_date: due.toISOString().slice(0, 10),
    payment_terms: 'net_30',
    tax_rate: 0,
    discount_percent: 0,
    description: '',
    notes: '',
    project_id: '',
    items: [{ ...EMPTY_ITEM }],
    client_id: ''
  };
};

export default function Invoices() {
  const { api } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [form, setForm] = useState(getDefaultForm());

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchClients();
    fetchProjects();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const formatCurrency = (value) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `$${safeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toIsoDate = (dateValue) => {
    if (!dateValue) return undefined;
    return new Date(`${dateValue}T00:00:00`).toISOString();
  };

  const normalizeItems = (items) => items
    .map((item) => ({
      ...item,
      description: item.description?.trim() || '',
      quantity: parseFloat(item.quantity) || 0,
      unit_price: parseFloat(item.unit_price) || 0
    }))
    .filter((item) => item.description);

  const calculateFormTotals = useMemo(() => {
    const items = normalizeItems(form.items || []);
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discount = subtotal * ((parseFloat(form.discount_percent) || 0) / 100);
    const taxable = subtotal - discount;
    const tax = taxable * ((parseFloat(form.tax_rate) || 0) / 100);
    const total = taxable + tax;
    return {
      subtotal,
      discount,
      tax,
      total
    };
  }, [form.items, form.tax_rate, form.discount_percent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        issue_date: toIsoDate(form.issue_date),
        due_date: toIsoDate(form.due_date),
        payment_terms: form.payment_terms || 'net_30',
        tax_rate: parseFloat(form.tax_rate) || 0,
        discount_percent: parseFloat(form.discount_percent) || 0,
        description: form.description,
        notes: form.notes,
        client_id: parseInt(form.client_id),
        project_id: form.project_id ? parseInt(form.project_id) : null,
        items: normalizeItems(form.items)
      };

      if (editingInvoice) {
        const updatePayload = {
          issue_date: data.issue_date,
          due_date: data.due_date,
          payment_terms: data.payment_terms,
          tax_rate: data.tax_rate,
          discount_percent: data.discount_percent,
          description: data.description,
          notes: data.notes
        };
        await api.put(`/invoices/${editingInvoice.id}`, updatePayload);
        await syncInvoiceItems(editingInvoice, data.items);
      } else {
        await api.post('/invoices', data);
      }

      setShowModal(false);
      setEditingInvoice(null);
      setForm(getDefaultForm());
      fetchInvoices();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    }
  };

  const syncInvoiceItems = async (invoice, items) => {
    const existingItems = invoice.items || [];
    const desiredIds = items.filter((item) => item.id).map((item) => item.id);
    const itemsToDelete = existingItems.filter((item) => !desiredIds.includes(item.id));

    for (const item of items) {
      if (item.id) {
        await api.put(`/invoices/${invoice.id}/items/${item.id}`, {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      } else {
        await api.post(`/invoices/${invoice.id}/items`, {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      }
    }

    for (const item of itemsToDelete) {
      await api.delete(`/invoices/${invoice.id}/items/${item.id}`);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setForm({
      issue_date: invoice.issue_date?.split('T')[0] || '',
      due_date: invoice.due_date?.split('T')[0] || '',
      payment_terms: invoice.payment_terms || 'net_30',
      tax_rate: invoice.tax_rate || 0,
      discount_percent: invoice.discount_percent || 0,
      description: invoice.description || '',
      notes: invoice.notes || '',
      project_id: invoice.project_id ? invoice.project_id.toString() : '',
      items: (invoice.items && invoice.items.length > 0)
        ? invoice.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
        : [{ ...EMPTY_ITEM }],
      client_id: invoice.client_id.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const openNewModal = () => {
    setEditingInvoice(null);
    setForm(getDefaultForm());
    setShowModal(true);
  };

  const openPaymentModal = (invoice) => {
    setPaymentInvoice(invoice);
    setPaymentForm({
      amount: invoice.amount_due?.toString() || '',
      payment_date: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    try {
      await api.post(`/invoices/${paymentInvoice.id}/payment`, {
        amount: parseFloat(paymentForm.amount) || 0,
        payment_date: toIsoDate(paymentForm.payment_date),
        notes: paymentForm.notes || undefined
      });
      setShowPaymentModal(false);
      setPaymentInvoice(null);
      setPaymentForm({ amount: '', payment_date: '', notes: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to record payment:', err);
    }
  };

  const duplicateInvoice = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/duplicate`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to duplicate invoice:', err);
    }
  };

  const sendInvoice = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/send`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to send invoice:', err);
    }
  };

  const handleTermsChange = (value) => {
    if (!form.issue_date) {
      setForm({ ...form, payment_terms: value });
      return;
    }
    const nextIssue = new Date(`${form.issue_date}T00:00:00`);
    const days = PAYMENT_DAYS[value] ?? 30;
    const due = new Date(nextIssue);
    due.setDate(nextIssue.getDate() + days);
    setForm({
      ...form,
      payment_terms: value,
      due_date: value === 'custom' ? form.due_date : due.toISOString().slice(0, 10)
    });
  };

  const filteredInvoices = invoices.filter(inv => {
    const haystack = [
      inv.invoice_number,
      inv.client_name,
      inv.project_name,
      inv.description
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Calculate totals
  const totals = {
    all: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0),
    outstanding: invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + (inv.amount_due || 0), 0),
    overdue: invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount_due || 0), 0)
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
          <h1>Invoices</h1>
          <p>Track payments and manage billing</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          {[
            { label: 'Total Invoiced', value: totals.all, color: 'var(--text-primary)' },
            { label: 'Paid', value: totals.paid, color: 'var(--accent-primary)' },
            { label: 'Outstanding', value: totals.outstanding, color: 'var(--accent-warning)' },
            { label: 'Overdue', value: totals.overdue, color: 'var(--accent-danger)' }
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
                {formatCurrency(stat.value)}
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
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="input"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto', minWidth: 150 }}
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Invoices Table */}
        {filteredInvoices.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="table-container"
          >
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Totals</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th style={{ width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, index) => {
                  const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                  const StatusIcon = status.icon;
                  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
                  const isOverdue = dueDate && dueDate < new Date() &&
                    invoice.status !== 'paid' && invoice.status !== 'cancelled';
                  const hasBalance = (invoice.amount_due || 0) > 0;

                  return (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{invoice.invoice_number}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {new Date(invoice.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{invoice.client_name || '-'}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {invoice.project_name || 'No project'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          {formatCurrency(invoice.total)}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Due {formatCurrency(invoice.amount_due || 0)}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: status.bg, color: status.color }}
                        >
                          <StatusIcon size={12} style={{ marginRight: 4 }} />
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} style={{
                            color: isOverdue ? 'var(--accent-danger)' : 'var(--text-muted)'
                          }} />
                          <span style={{
                            color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)'
                          }}>
                            {dueDate ? dueDate.toLocaleDateString() : '-'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {invoice.status === 'draft' && (
                            <button
                              className="btn btn-sm"
                              onClick={() => sendInvoice(invoice.id)}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                              }}
                            >
                              <Send size={14} />
                              Send
                            </button>
                          )}
                          {hasBalance && (
                            <button
                              className="btn btn-sm"
                              onClick={() => openPaymentModal(invoice)}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              <Wallet size={14} />
                              Payment
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => duplicateInvoice(invoice.id)}
                            style={{ padding: '0.375rem' }}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEdit(invoice)}
                            style={{ padding: '0.375rem' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(invoice.id)}
                            style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={16} />
                          </button>
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
              <FileText size={40} />
            </div>
            <h3>No invoices yet</h3>
            <p>Create your first invoice to start tracking payments.</p>
            <button className="btn btn-primary" onClick={openNewModal}>
              <Plus size={18} />
              Create Invoice
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="input-group">
                    <label>Client</label>
                    <select
                      className="input"
                      value={form.client_id}
                      onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                      required
                    >
                      <option value="">Select a client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Project (optional)</label>
                      <select
                        className="input"
                        value={form.project_id}
                        onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                      >
                        <option value="">No project</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Issue Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.issue_date}
                        onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Payment Terms</label>
                      <select
                        className="input"
                        value={form.payment_terms}
                        onChange={(e) => handleTermsChange(e.target.value)}
                      >
                        {PAYMENT_TERMS.map(term => (
                          <option key={term.value} value={term.value}>{term.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                        required={form.payment_terms === 'custom'}
                      />
                    </div>

                    <div className="input-group">
                      <label>Tax Rate (%)</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="0"
                        value={form.tax_rate}
                        onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0"
                      value={form.discount_percent}
                      onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>Line Items</div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] })}
                      >
                        <Plus size={14} />
                        Add Item
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {form.items.map((item, index) => (
                        <div
                          key={`${item.id || 'new'}-${index}`}
                          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}
                        >
                          <input
                            type="text"
                            className="input"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => {
                              const nextItems = [...form.items];
                              nextItems[index] = { ...nextItems[index], description: e.target.value };
                              setForm({ ...form, items: nextItems });
                            }}
                          />
                          <input
                            type="number"
                            className="input"
                            placeholder="Qty"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const nextItems = [...form.items];
                              nextItems[index] = { ...nextItems[index], quantity: e.target.value };
                              setForm({ ...form, items: nextItems });
                            }}
                          />
                          <div style={{ position: 'relative' }}>
                            <DollarSign
                              size={14}
                              style={{
                                position: 'absolute',
                                left: '0.75rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                              }}
                            />
                            <input
                              type="number"
                              className="input"
                              placeholder="Unit price"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const nextItems = [...form.items];
                                nextItems[index] = { ...nextItems[index], unit_price: e.target.value };
                                setForm({ ...form, items: nextItems });
                              }}
                              style={{ paddingLeft: '2rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const nextItems = form.items.filter((_, itemIndex) => itemIndex !== index);
                              setForm({ ...form, items: nextItems.length ? nextItems : [{ ...EMPTY_ITEM }] });
                            }}
                            style={{ padding: '0.375rem' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                          <span>{formatCurrency(calculateFormTotals.subtotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                          <span>-{formatCurrency(calculateFormTotals.discount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                          <span>{formatCurrency(calculateFormTotals.tax)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>Total</span>
                          <span>{formatCurrency(calculateFormTotals.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      placeholder="Invoice description or notes..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="input-group">
                    <label>Notes</label>
                    <textarea
                      className="input"
                      placeholder="Terms, payment instructions, or thank you note..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingInvoice ? 'Save Changes' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && paymentInvoice && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Record Payment</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowPaymentModal(false)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitPayment}>
                <div className="modal-body">
                  <div className="input-group">
                    <label>Amount</label>
                    <div style={{ position: 'relative' }}>
                      <DollarSign
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)'
                        }}
                      />
                      <input
                        type="number"
                        className="input"
                        placeholder="0"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        style={{ paddingLeft: '2.5rem' }}
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      className="input"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Notes</label>
                    <textarea
                      className="input"
                      placeholder="Optional payment notes..."
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Record Payment
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
