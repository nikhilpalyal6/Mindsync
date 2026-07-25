import React from 'react';

export const FilterBar = React.memo(({
  filterValue,
  onFilterChange,
  filterType = 'activity' // 'activity' | 'login'
}) => {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'var(--admin-card-bg)',
      border: '1px solid var(--admin-border)',
      padding: '12px 16px',
      borderRadius: '10px',
      alignItems: 'center',
      gap: '12px',
      width: '100%'
    }}>
      <label htmlFor="log-filter-select" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
        Category:
      </label>

      {filterType === 'activity' ? (
        <select
          id="log-filter-select"
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="admin-select"
          style={{ minWidth: '160px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <option value="all">All Categories</option>
          <option value="Authentication">Authentication</option>
          <option value="User">User Actions</option>
          <option value="Admin">Admin Actions</option>
          <option value="Security">Security Events</option>
          <option value="System">System Events</option>
        </select>
      ) : (
        <select
          id="log-filter-select"
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="admin-select"
          style={{ minWidth: '160px', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <option value="all">All Attempts</option>
          <option value="success">Success Logins</option>
          <option value="failed">Failed Logins</option>
        </select>
      )}
    </div>
  );
});

FilterBar.displayName = 'FilterBar';
export default FilterBar;
