import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Mail, Phone, Building2, DollarSign,
  FolderKanban, Edit2, Trash2, X, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AVATAR_COLORS = [
  '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#3B82F6',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4'
];

export default function Clients() {
  const { api } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    notes: '',
    avatar_color: AVATAR_COLORS[0]
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, form);
      } else {
        await api.post('/clients', form);
      }

      setShowModal(false);
      setEditingClient(null);
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        notes: '',
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
      });
      fetchClients();
    } catch (err) {
      console.error('Failed to save client:', err);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || '',
      notes: client.notes || '',
      avatar_color: client.avatar_color
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      await api.delete(`/clients/${id}`);
      fetchClients();
    } catch (err) {
      console.error('Failed to delete client:', err);
    }
  };

  const openNewModal = () => {
    setEditingClient(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      notes: '',
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    });
    setShowModal(true);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <h1>Clients</h1>
          <p>Manage your client relationships</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ position: 'relative' }}>
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
              placeholder="Search clients by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
        </motion.div>

        {/* Clients Table */}
        {filteredClients.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="table-container"
          >
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Projects</th>
                  <th>Revenue</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, index) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          className="avatar"
                          style={{ background: client.avatar_color }}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{client.name}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            Added {new Date(client.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.875rem' }}>{client.email}</span>
                        </div>
                        {client.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.875rem' }}>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {client.company ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{client.company}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FolderKanban size={14} style={{ color: 'var(--accent-secondary)' }} />
                        <span>{client.project_count || 0}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontWeight: 500 }}>
                          ${(client.total_revenue || 0).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleEdit(client)}
                          style={{ padding: '0.375rem' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(client.id)}
                          style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={40} />
            </div>
            <h3>No clients yet</h3>
            <p>Add your first client to start managing your relationships.</p>
            <button className="btn btn-primary" onClick={openNewModal}>
              <Plus size={18} />
              Add Client
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
                <h3>{editingClient ? 'Edit Client' : 'Add Client'}</h3>
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
                  {/* Avatar Color Selection */}
                  <div className="input-group">
                    <label>Avatar Color</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {AVATAR_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm({ ...form, avatar_color: color })}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: color,
                            border: form.avatar_color === color
                              ? '3px solid var(--text-primary)'
                              : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Email</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="john@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        className="input"
                        placeholder="+1 (555) 000-0000"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Company</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Acme Corporation"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Address</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="123 Main St, City, Country"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Notes</label>
                    <textarea
                      className="input"
                      placeholder="Additional notes about this client..."
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
                    {editingClient ? 'Save Changes' : 'Add Client'}
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
