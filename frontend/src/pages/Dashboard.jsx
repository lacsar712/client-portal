import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Clock, FolderKanban, Users,
  TrendingUp, TrendingDown, ArrowUpRight, Activity,
  Zap, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    try {
      await api.post('/seed');
      fetchDashboard();
    } catch (err) {
      console.error('Failed to seed data:', err);
    }
  };

  if (loading) {
    return (
      <div className="loader" style={{ height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const statCards = [
    {
      icon: DollarSign,
      label: 'Total Revenue',
      value: `$${(stats?.total_revenue || 0).toLocaleString()}`,
      change: `+${stats?.revenue_change || 0}%`,
      positive: true,
      color: 'emerald'
    },
    {
      icon: Clock,
      label: 'Pending Invoices',
      value: `$${(stats?.pending_invoices || 0).toLocaleString()}`,
      change: 'Awaiting payment',
      positive: null,
      color: 'amber'
    },
    {
      icon: FolderKanban,
      label: 'Active Projects',
      value: stats?.active_projects || 0,
      change: `+${stats?.projects_change || 0} this month`,
      positive: true,
      color: 'indigo'
    },
    {
      icon: Users,
      label: 'Total Clients',
      value: stats?.total_clients || 0,
      change: 'Lifetime',
      positive: null,
      color: 'blue'
    }
  ];

  const CHART_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444'];

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Dashboard</h1>
          <p>Welcome back! Here's what's happening with your business.</p>
        </div>
        <div className="header-actions">
          {(!stats?.total_clients || stats.total_clients === 0) && (
            <button className="btn btn-secondary" onClick={seedData}>
              <Zap size={18} />
              Load Demo Data
            </button>
          )}
        </div>
      </div>

      <div className="page-container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Stats Grid */}
          <div className="stats-grid">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  className="card stat-card"
                >
                  <div className={`stat-icon ${stat.color}`}>
                    <Icon size={24} />
                  </div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                  <div className={`stat-change ${stat.positive === true ? 'positive' : stat.positive === false ? 'negative' : ''}`}>
                    {stat.positive === true && <TrendingUp size={14} />}
                    {stat.positive === false && <TrendingDown size={14} />}
                    {stat.change}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Revenue Chart */}
            <motion.div variants={itemVariants} className="card">
              <div className="card-header">
                <h3 className="card-title">Revenue Overview</h3>
                <span className="badge badge-success">
                  <ArrowUpRight size={12} />
                  12.5%
                </span>
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthly_revenue || []}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                      tickFormatter={(v) => `$${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 8,
                        boxShadow: 'var(--shadow-md)'
                      }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Project Status Chart */}
            <motion.div variants={itemVariants} className="card">
              <div className="card-header">
                <h3 className="card-title">Project Status</h3>
              </div>
              <div style={{ height: 280, display: 'flex', alignItems: 'center' }}>
                {stats?.project_status_distribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.project_status_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {stats.project_status_distribution.map((entry, index) => (
                          <Cell key={entry.status} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 8
                        }}
                        formatter={(value, name, props) => [value, props.payload.status]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No project data yet
                  </div>
                )}
              </div>
              {stats?.project_status_distribution?.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  justifyContent: 'center',
                  marginTop: '0.5rem'
                }}>
                  {stats.project_status_distribution.map((item) => (
                    <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: item.color
                      }} />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {item.status.replace('_', ' ')} ({item.count})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Activity Timeline */}
          <motion.div variants={itemVariants} className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Activity</h3>
              <Activity size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            {stats?.recent_activities?.length > 0 ? (
              <div className="activity-list">
                {stats.recent_activities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    className="activity-item"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div
                      className="activity-icon"
                      style={{
                        background: activity.action === 'created'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : activity.action === 'updated'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color: activity.action === 'created'
                          ? 'var(--accent-primary)'
                          : activity.action === 'updated'
                            ? 'var(--accent-info)'
                            : 'var(--accent-danger)'
                      }}
                    >
                      {activity.entity_type === 'project' && <FolderKanban size={16} />}
                      {activity.entity_type === 'client' && <Users size={16} />}
                      {activity.entity_type === 'invoice' && <FileText size={16} />}
                    </div>
                    <div className="activity-content">
                      <p style={{ fontSize: '0.9375rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{activity.action}</span>{' '}
                        {activity.entity_type}{' '}
                        <strong>{activity.entity_name}</strong>
                        {activity.details && (
                          <span style={{ color: 'var(--text-muted)' }}> - {activity.details}</span>
                        )}
                      </p>
                      <div className="activity-time">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No recent activity. Start by creating a client or project!
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
