import React from 'react';

export const UserFilters = React.memo(({ filter, onFilterChange, sortBy, onSortByChange, sortOrder, onSortOrderChange }) => {
  const filterOptions = [
    { value: 'all', label: 'All Statuses & Roles' },
    { value: 'active', label: 'Status: Active' },
    { value: 'inactive', label: 'Status: Inactive' },
    { value: 'verified', label: 'Email: Verified' },
    { value: 'unverified', label: 'Email: Unverified' },
    { value: 'google', label: 'Provider: Google' },
    { value: 'local', label: 'Provider: Local' },
    { value: 'USER', label: 'Role: USER' },
    { value: 'ADMIN', label: 'Role: ADMIN' },
    { value: 'SUPER_ADMIN', label: 'Role: SUPER_ADMIN' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'createdAt', label: 'Registration Date' },
    { value: 'lastLogin', label: 'Last Login' },
    { value: 'role', label: 'Role' }
  ];

  return (
    <div className="admin-filter-group">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="admin-filter-select" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
          Filter By
        </label>
        <select
          id="admin-filter-select"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="admin-select"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="admin-sort-select" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
          Sort By
        </label>
        <select
          id="admin-sort-select"
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="admin-select"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="admin-order-select" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
          Order
        </label>
        <select
          id="admin-order-select"
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value)}
          className="admin-select"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </div>
  );
});

UserFilters.displayName = 'UserFilters';
export default UserFilters;
