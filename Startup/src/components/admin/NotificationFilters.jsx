import React from 'react';

export const NotificationFilters = React.memo(({
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onMarkAllRead
}) => {
  const filterOptions = [
    { value: 'all', label: 'All Alerts' },
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
    { value: 'broadcast', label: 'Announcements' },
    { value: 'system', label: 'System' },
    { value: 'security', label: 'Security' },
    { value: 'user', label: 'User Triggered' },
    { value: 'ai', label: 'AI Monitor' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Creation Date' },
    { value: 'priority', label: 'Priority Level' },
    { value: 'isRead', label: 'Read Status' }
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      backgroundColor: 'var(--admin-card-bg)',
      border: '1px solid var(--admin-border)',
      padding: '12px 16px',
      borderRadius: '10px',
      width: '100%'
    }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Category selector filter */}
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="admin-select"
          style={{ minWidth: '150px', fontSize: '0.8rem', padding: '6px 10px' }}
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Sorting options */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="admin-select"
          style={{ minWidth: '150px', fontSize: '0.8rem', padding: '6px 10px' }}
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>Sort by: {opt.label}</option>
          ))}
        </select>

        {/* Direction toggle */}
        <button
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="admin-btn admin-btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px' }}
        >
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      {onMarkAllRead && (
        <button
          onClick={onMarkAllRead}
          className="admin-btn admin-btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px' }}
        >
          Mark all as read
        </button>
      )}
    </div>
  );
});

NotificationFilters.displayName = 'NotificationFilters';
export default NotificationFilters;
