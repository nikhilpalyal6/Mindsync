import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  ShieldCheck, 
  UserPlus, 
  LayoutDashboard, 
  BarChart3, 
  Cpu, 
  BellRing, 
  FileSpreadsheet, 
  Sliders, 
  Terminal, 
  Clock, 
  Server, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SectionHeader from '../../components/admin/SectionHeader';
import DashboardCard from '../../components/admin/DashboardCard';
import ChartCard from '../../components/admin/ChartCard';
import HealthStatusCard from '../../components/admin/HealthStatusCard';
import RecentActivity from '../../components/admin/RecentActivity';
import QuickActionCard from '../../components/admin/QuickActionCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/dashboard/stats');
      setStats(response);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to load platform dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Format uptime to Days, Hours, Minutes, Seconds
  const uptimeString = useMemo(() => {
    const uptimeSeconds = stats?.serverInfo?.uptime;
    if (uptimeSeconds === undefined || uptimeSeconds === null) return 'Status unavailable';
    
    const d = Math.floor(uptimeSeconds / (3600 * 24));
    const h = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const s = Math.floor(uptimeSeconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }, [stats?.serverInfo?.uptime]);

  // Format Current Time
  const formattedServerTime = useMemo(() => {
    const timeStr = stats?.serverInfo?.currentTime;
    if (!timeStr) return 'Status unavailable';
    return new Date(timeStr).toLocaleString();
  }, [stats?.serverInfo?.currentTime]);

  const quickActions = [
    { label: 'Manage Users', path: '/admin/users', icon: Users },
    { label: 'Analytics Console', path: '/admin/analytics', icon: BarChart3 },
    { label: 'System Announcements', path: '/admin/notifications', icon: BellRing },
    { label: 'Generate Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { label: 'Console Settings', path: '/admin/settings', icon: Sliders },
    { label: 'Audit System Logs', path: '/admin/system-logs', icon: Terminal },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} aria-busy="true">
        <div className="skeleton-shimmer" style={{ width: '40%', height: '80px', borderRadius: '16px', marginBottom: '8px' }}></div>
        <div className="admin-stats-grid">
          <LoadingSkeleton type="stats" />
          <LoadingSkeleton type="stats" />
          <LoadingSkeleton type="stats" />
          <LoadingSkeleton type="stats" />
        </div>
        <div className="admin-dashboard-layout-grid">
          <LoadingSkeleton type="chart" />
          <LoadingSkeleton type="list" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchStats} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Banner Header */}
      <SectionHeader user={user} />

      {/* Grid: Stats Cards */}
      <section className="admin-stats-grid" aria-label="Quick Stats Summary">
        <DashboardCard 
          title="Total Registered Users" 
          value={stats?.totalUsers || 0} 
          icon={Users} 
          trend={{ type: 'neutral', value: 'Live', label: ' database count' }}
        />
        <DashboardCard 
          title="Verified Profiles" 
          value={stats?.verifiedUsers || 0} 
          icon={ShieldCheck} 
          trend={{ 
            type: stats?.totalUsers > 0 ? 'up' : 'neutral', 
            value: stats?.totalUsers > 0 ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}%` : '0%', 
            label: ' verification rate' 
          }}
        />
        <DashboardCard 
          title="Active Users (7 Days)" 
          value={stats?.activeUsers || 0} 
          icon={UserCheck} 
          trend={{ 
            type: stats?.totalUsers > 0 ? 'up' : 'neutral', 
            value: stats?.totalUsers > 0 ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%` : '0%', 
            label: ' weekly activity' 
          }}
        />
        <DashboardCard 
          title="New Growth (7 Days)" 
          value={stats?.newUsersThisWeek || 0} 
          icon={UserPlus} 
          trend={{ 
            type: stats?.newUsersThisWeek > 0 ? 'up' : 'neutral', 
            value: `+${stats?.newUsersThisWeek || 0}`, 
            label: ' new registrations' 
          }}
        />
      </section>

      {/* Grid: Charts & System Health */}
      <div className="admin-dashboard-layout-grid">
        <ChartCard 
          title="User Registration Analytics (Last 7 Days)" 
          data={stats?.userGrowthData || []} 
          dataKey="users" 
          categoryKey="date" 
        />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <HealthStatusCard health={stats?.health} />

          {/* Server Info Card */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Server Metadata</h3>
              <button 
                onClick={fetchStats}
                className="admin-nav-action-btn"
                style={{ padding: '6px' }}
                title="Refresh stats and server details"
                aria-label="Refresh stats"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} /> Environment
                </span>
                <span style={{ color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>
                  {stats?.serverInfo?.environment || 'Status unavailable'}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} /> API Version
                </span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  v{stats?.serverInfo?.version || '1.0.0'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Server Uptime
                </span>
                <span style={{ color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
                  {uptimeString}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Server Time
                </span>
                <span style={{ color: '#fff', fontWeight: 500, fontSize: '0.8rem' }}>
                  {formattedServerTime}
                </span>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--admin-border)', margin: '4px 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                <span>Console Last Updated:</span>
                <span>{lastRefreshed || 'Just now'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Recent Activity & Quick Actions */}
      <div className="admin-dashboard-layout-grid">
        <RecentActivity activities={stats?.recentActivities || []} />

        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Console Quick Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {quickActions.map((action) => (
              <QuickActionCard 
                key={action.path}
                label={action.label}
                path={action.path}
                icon={action.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
