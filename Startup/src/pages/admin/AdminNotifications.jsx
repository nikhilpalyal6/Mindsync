import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, Plus, Search } from 'lucide-react';
import { 
  getAdminNotifications, 
  getAdminNotificationStats, 
  markAdminNotificationRead, 
  markAdminNotificationUnread, 
  markAllAdminNotificationsRead, 
  deleteAdminNotification, 
  broadcastAdminAnnouncement 
} from '../../services/api';
import NotificationStats from '../../components/admin/NotificationStats';
import NotificationFilters from '../../components/admin/NotificationFilters';
import NotificationTable from '../../components/admin/NotificationTable';
import NotificationDetails from '../../components/admin/NotificationDetails';
import BroadcastModal from '../../components/admin/BroadcastModal';
import Pagination from '../../components/admin/Pagination';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';

export const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter, search, pagination, and sort states
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Interaction states
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  // Fetch stats callback
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await getAdminNotificationStats();
      setStats(response);
    } catch (err) {
      console.error('Failed to load notification statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch notifications callback
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminNotifications({
        page,
        limit,
        search,
        filter,
        sortBy,
        sortOrder
      });
      setNotifications(response.notifications || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalCount(response.pagination?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to retrieve notification records.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filter, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch when pagination or query parameters update
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [localSearch]);

  // Mark single read
  const handleMarkRead = async (id) => {
    try {
      await markAdminNotificationRead(id);
      
      // Update local state
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      
      // Refetch stats to keep badges correct
      fetchStats();

      // If details sidebar is open, sync details
      if (selectedNotif && selectedNotif._id === id) {
        setSelectedNotif(prev => ({ ...prev, isRead: true, readAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Mark single unread
  const handleMarkUnread = async (id) => {
    try {
      await markAdminNotificationUnread(id);
      
      // Update local state
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: false, readAt: null } : n));
      
      // Refetch stats
      fetchStats();

      // If details sidebar is open, sync details
      if (selectedNotif && selectedNotif._id === id) {
        setSelectedNotif(prev => ({ ...prev, isRead: false, readAt: null }));
      }
    } catch (err) {
      console.error('Failed to mark unread:', err);
    }
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      await markAllAdminNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      fetchStats();
      if (selectedNotif) {
        setSelectedNotif(prev => ({ ...prev, isRead: true, readAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  // Delete notification
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification record?')) return;
    try {
      await deleteAdminNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      fetchStats();
      if (selectedNotif && selectedNotif._id === id) {
        setSelectedNotif(null);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Broadcast announcement
  const handleBroadcast = async (broadcastData) => {
    const response = await broadcastAdminAnnouncement(broadcastData);
    // Refresh stats and records list
    fetchStats();
    fetchNotifications();
    return response;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Announcements & Notifications</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Dispatch announcements, inspect auto-generated warnings, and view recipient audit statistics.
          </p>
        </div>

        <button
          onClick={() => setIsBroadcastOpen(true)}
          className="admin-btn admin-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>New Broadcast</span>
        </button>
      </div>

      {/* Stats row */}
      {statsLoading && !stats ? (
        <LoadingSkeleton type="stats" />
      ) : (
        <NotificationStats stats={stats} />
      )}

      {/* Filter and Search grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search */}
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
          <Search size={16} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search notification messages, titles, or recipients..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '0.85rem',
              width: '100%'
            }}
          />
        </div>

        {/* Filters */}
        <NotificationFilters
          filter={filter}
          onFilterChange={(f) => { setFilter(f); setPage(1); }}
          sortBy={sortBy}
          onSortByChange={(s) => { setSortBy(s); setPage(1); }}
          sortOrder={sortOrder}
          onSortOrderChange={(o) => { setSortOrder(o); setPage(1); }}
          onMarkAllRead={notifications.some(n => !n.isRead) ? handleMarkAllRead : null}
        />
      </div>

      {/* Main Body content */}
      {loading && notifications.length === 0 ? (
        <LoadingSkeleton type="table" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNotifications} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications found"
          description="There are no active notifications. Send a new broadcast to write records."
          icon={BellRing}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <NotificationTable
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
            onDelete={handleDelete}
            onViewDetails={setSelectedNotif}
          />

          <Pagination
            page={page}
            limit={limit}
            totalPages={totalPages}
            totalCount={totalCount}
            hasNextPage={page < totalPages}
            hasPrevPage={page > 1}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </div>
      )}

      {/* Audit Detail slide out */}
      {selectedNotif && (
        <NotificationDetails
          notification={selectedNotif}
          onClose={() => setSelectedNotif(null)}
        />
      )}

      {/* Announcement Broadcast Modal */}
      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onBroadcast={handleBroadcast}
      />
    </div>
  );
};

export default AdminNotifications;
