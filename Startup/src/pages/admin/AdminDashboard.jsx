import React, { useEffect, useState } from 'react';
import { FiUsers, FiUserCheck, FiUserPlus, FiActivity, FiArrowRight, FiFileText, FiBell, FiSettings } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import DashboardCard from '../../components/admin/DashboardCard';
import ChartCard from '../../components/admin/ChartCard';
import RecentActivity from '../../components/admin/RecentActivity';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/dashboard/stats');
        if (isMounted) {
          setStats(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load dashboard statistics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="skeleton-shimmer" style={{ width: '35%', height: '32px', borderRadius: '6px', marginBottom: '8px' }}></div>
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
    return (
      <div className="admin-empty-state">
        <div className="admin-empty-icon-container" style={{ borderColor: 'var(--admin-error)', color: 'var(--admin-error)' }}>
          <span>!</span>
        </div>
        <h3 className="admin-empty-title">Error Loading Statistics</h3>
        <p className="admin-empty-description">{error}</p>
        <button 
          onClick={() => { setLoading(true); setError(null); }}
          className="admin-btn admin-btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Banner */}
      <div className="admin-welcome-card">
        <h1 className="admin-welcome-title">Welcome back, {user?.name || 'Administrator'}!</h1>
        <p className="admin-welcome-subtitle">Here is the active system overview and metrics monitoring console for MindSync.</p>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <DashboardCard 
          title="Total Registered Users" 
          value={stats?.totalUsers || 0} 
          icon={FiUsers} 
          trend={{ type: 'neutral', value: 'Live', label: ' database count' }}
        />
        <DashboardCard 
          title="Active Users (7d)" 
          value={stats?.activeUsers || 0} 
          icon={FiUserCheck} 
          trend={{ 
            type: stats?.totalUsers > 0 ? 'up' : 'neutral', 
            value: stats?.totalUsers > 0 ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%` : '0%', 
            label: ' activity rate' 
          }}
        />
        <DashboardCard 
          title="Verified Profiles" 
          value={stats?.verifiedUsers || 0} 
          icon={FiUserPlus} 
          trend={{ 
            type: stats?.totalUsers > 0 ? 'up' : 'neutral', 
            value: stats?.totalUsers > 0 ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}%` : '0%', 
            label: ' verification rate' 
          }}
        />
        <DashboardCard 
          title="New Growth (7d)" 
          value={stats?.newUsersThisWeek || 0} 
          icon={FiActivity} 
          trend={{ 
            type: stats?.newUsersThisWeek > 0 ? 'up' : 'neutral', 
            value: `+${stats?.newUsersThisWeek || 0}`, 
            label: ' registrations' 
          }}
        />
      </div>

      {/* Main Grid: Charts & Activities */}
      <div className="admin-dashboard-layout-grid">
        <ChartCard 
          title="User Registration Trends (Last 7 Days)" 
          data={stats?.userGrowthData || []} 
          dataKey="users" 
          categoryKey="date" 
        />
        <RecentActivity activities={stats?.recentActivities || []} />
      </div>

      {/* Quick Action Center */}
      <div className="admin-card">
        <h3 className="text-base font-semibold text-white mb-4" style={{ margin: '0 0 16px 0' }}>Quick Actions Console</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Link to="/admin/reports" className="admin-btn admin-btn-secondary" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiFileText /> System Reports
            </span>
            <FiArrowRight />
          </Link>
          <Link to="/admin/notifications" className="admin-btn admin-btn-secondary" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiBell /> Announcements
            </span>
            <FiArrowRight />
          </Link>
          <Link to="/admin/settings" className="admin-btn admin-btn-secondary" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiSettings /> Console Settings
            </span>
            <FiArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
