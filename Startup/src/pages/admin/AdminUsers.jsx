import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getAdminUsers, 
  updateAdminUserStatus, 
  updateAdminUserVerify, 
  updateAdminUserRole, 
  adminBulkAction 
} from '../../services/api';
import UsersTable from '../../components/admin/UsersTable';
import UserFilters from '../../components/admin/UserFilters';
import UserSearch from '../../components/admin/UserSearch';
import BulkActions from '../../components/admin/BulkActions';
import DeleteConfirmationModal from '../../components/admin/DeleteConfirmationModal';
import UserDetailsDrawer from '../../components/admin/UserDetailsDrawer';
import Pagination from '../../components/admin/Pagination';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ErrorState from '../../components/admin/ErrorState';
import EmptyState from '../../components/admin/EmptyState';

export const AdminUsers = () => {
  const { user: currentUser } = useAuth();

  // Query & state parameters
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [paginationMeta, setPaginationMeta] = useState({
    totalPages: 1,
    total: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  
  // Drawer state
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modal confirmation states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDanger: false,
    onConfirm: () => {}
  });

  // Fetch users callback
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminUsers({
        page,
        limit,
        search,
        filter,
        sortBy,
        sortOrder
      });
      // response format: { users: [...], pagination: {...} }
      setUsers(response.users || []);
      setPaginationMeta({
        totalPages: response.pagination?.totalPages || 1,
        total: response.pagination?.total || 0,
        hasNextPage: response.pagination?.hasNextPage || false,
        hasPrevPage: response.pagination?.hasPrevPage || false
      });
    } catch (err) {
      setError(err.message || 'Failed to retrieve users directory.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filter, sortBy, sortOrder]);

  // Refetch when search/filter/sort parameters update
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when search or filter changes
  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    setPage(1);
    setSelectedUserIds([]);
  }, []);

  const handleFilterChange = useCallback((val) => {
    setFilter(val);
    setPage(1);
    setSelectedUserIds([]);
  }, []);

  const handleSortChange = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
    setSelectedUserIds([]);
  }, [sortBy]);

  // Pagination Change Handlers
  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
    setSelectedUserIds([]);
  }, []);

  const handleLimitChange = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
    setSelectedUserIds([]);
  }, []);

  // Selection toggle callbacks
  const handleSelectToggle = useCallback((id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllToggle = useCallback((isChecked, targetIds) => {
    if (isChecked) {
      setSelectedUserIds(targetIds);
    } else {
      setSelectedUserIds([]);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  // Details drawer handlers
  const handleViewDetails = useCallback((userObj) => {
    setSelectedUser(userObj);
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedUser(null);
  }, []);

  // Actions trigger: opens confirmation dialog
  const handleActionTrigger = useCallback((targetUser, actionType, payload) => {
    let title = '';
    let message = '';
    let confirmText = 'Confirm';
    let isDanger = false;
    let actionCall = () => {};

    if (actionType === 'status') {
      const isActive = payload;
      title = isActive ? 'Activate User Account' : 'Deactivate User Account';
      message = isActive
        ? `Are you sure you want to activate the account for ${targetUser.name}? They will be able to log back into the console.`
        : `Are you sure you want to deactivate the account for ${targetUser.name}? They will be blocked from logging into the platform.`;
      confirmText = isActive ? 'Activate' : 'Deactivate';
      isDanger = !isActive;
      actionCall = async () => {
        await updateAdminUserStatus(targetUser._id, isActive);
      };
    } else if (actionType === 'verify') {
      const isVerified = payload;
      title = isVerified ? 'Verify User Email' : 'Unverify User Email';
      message = isVerified
        ? `Are you sure you want to mark the email address of ${targetUser.name} as verified?`
        : `Are you sure you want to mark the email address of ${targetUser.name} as unverified?`;
      confirmText = isVerified ? 'Verify' : 'Unverify';
      actionCall = async () => {
        await updateAdminUserVerify(targetUser._id, isVerified);
      };
    } else if (actionType === 'role') {
      const newRole = payload;
      const isPromote = newRole === 'ADMIN';
      title = isPromote ? 'Promote User to Admin' : 'Demote User to Regular User';
      message = isPromote
        ? `Are you sure you want to promote ${targetUser.name} to the ADMIN role? They will have access to the administration dashboard.`
        : `Are you sure you want to demote ${targetUser.name} to the USER role? They will lose all access to the administration dashboard.`;
      confirmText = isPromote ? 'Promote' : 'Demote';
      isDanger = !isPromote;
      actionCall = async () => {
        await updateAdminUserRole(targetUser._id, newRole);
      };
    }

    setConfirmConfig({
      title,
      message,
      confirmText,
      isDanger,
      onConfirm: async () => {
        try {
          setIsConfirmOpen(false);
          setLoading(true);
          await actionCall();
          await fetchUsers();
        } catch (err) {
          setError(err.message || 'Operation failed.');
          setLoading(false);
        }
      }
    });
    setIsConfirmOpen(true);
  }, [fetchUsers]);

  // Bulk action trigger
  const handleBulkActionTrigger = useCallback((actionType) => {
    let title = '';
    let message = '';
    let confirmText = 'Confirm';
    let isDanger = false;

    if (actionType === 'activate') {
      title = 'Bulk Activate Users';
      message = `Are you sure you want to activate all ${selectedUserIds.length} selected user accounts?`;
      confirmText = 'Activate';
    } else if (actionType === 'deactivate') {
      title = 'Bulk Deactivate Users';
      message = `Are you sure you want to deactivate all ${selectedUserIds.length} selected user accounts? This blocks them from logging in.`;
      confirmText = 'Deactivate';
      isDanger = true;
    } else if (actionType === 'verify') {
      title = 'Bulk Verify Emails';
      message = `Are you sure you want to mark all ${selectedUserIds.length} selected users' email addresses as verified?`;
      confirmText = 'Verify';
    } else if (actionType === 'unverify') {
      title = 'Bulk Unverify Emails';
      message = `Are you sure you want to mark all ${selectedUserIds.length} selected users' email addresses as unverified?`;
      confirmText = 'Unverify';
    }

    setConfirmConfig({
      title,
      message,
      confirmText,
      isDanger,
      onConfirm: async () => {
        try {
          setIsConfirmOpen(false);
          setLoading(true);
          await adminBulkAction(selectedUserIds, actionType);
          setSelectedUserIds([]);
          await fetchUsers();
        } catch (err) {
          setError(err.message || 'Bulk operation failed.');
          setLoading(false);
        }
      }
    });
    setIsConfirmOpen(true);
  }, [selectedUserIds, fetchUsers]);

  const handleCancelAction = useCallback(() => {
    setIsConfirmOpen(false);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Users Management</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
          Inspect credentials, toggle active verification states, manage roles, and review registrations.
        </p>
      </div>

      {/* Filter and Search Bar Banner */}
      <div className="admin-filter-bar">
        <UserSearch search={search} onSearchChange={handleSearchChange} />
        <UserFilters
          filter={filter}
          onFilterChange={handleFilterChange}
          sortBy={sortBy}
          onSortByChange={handleSortChange}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />
      </div>

      {/* Bulk actions banner */}
      <BulkActions 
        selectedCount={selectedUserIds.length} 
        onBulkAction={handleBulkActionTrigger}
        onClearSelection={handleClearSelection}
      />

      {/* Main Table view */}
      {loading ? (
        <LoadingSkeleton type="table" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState 
          title="No users found" 
          description={search ? "No user accounts match your search parameters." : "No accounts match the active filter criteria."}
          icon={Users}
        />
      ) : (
        <>
          <UsersTable 
            users={users}
            currentUser={currentUser}
            selectedUserIds={selectedUserIds}
            onSelectAllToggle={handleSelectAllToggle}
            onSelectToggle={handleSelectToggle}
            onViewDetails={handleViewDetails}
            onActionTrigger={handleActionTrigger}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />

          {/* Pagination bar */}
          <Pagination
            page={page}
            limit={limit}
            totalPages={paginationMeta.totalPages}
            totalCount={paginationMeta.total}
            hasNextPage={paginationMeta.hasNextPage}
            hasPrevPage={paginationMeta.hasPrevPage}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </>
      )}

      {/* Slide-in Details Drawer */}
      <UserDetailsDrawer 
        isOpen={isDrawerOpen} 
        user={selectedUser} 
        onClose={handleDrawerClose} 
      />

      {/* Actions confirmation modal */}
      <DeleteConfirmationModal
        isOpen={isConfirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onCancel={handleCancelAction}
      />
    </div>
  );
};

export default AdminUsers;
