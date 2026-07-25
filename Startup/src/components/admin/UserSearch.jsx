import React, { useState, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';

export const UserSearch = React.memo(({ search, onSearchChange }) => {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange]);

  // Sync with prop if changed from outside
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 300px', maxWidth: '480px' }}>
      <label htmlFor="admin-search-users" style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
        Search Users
      </label>
      <div style={{ position: 'relative', width: '100%' }}>
        <FiSearch 
          style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--admin-text-muted)',
            width: '16px',
            height: '16px',
            pointerEvents: 'none'
          }} 
        />
        <input
          id="admin-search-users"
          type="text"
          placeholder="Search by name, username, or email..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#0a0f1d',
            border: '1px solid var(--admin-border)',
            borderRadius: '8px',
            padding: '9px 12px 9px 36px',
            color: 'var(--admin-text-main)',
            fontSize: '0.85rem',
            outline: 'none',
            transition: 'var(--admin-transition)'
          }}
        />
      </div>
    </div>
  );
});

UserSearch.displayName = 'UserSearch';
export default UserSearch;
