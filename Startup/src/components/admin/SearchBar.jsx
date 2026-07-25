import React from 'react';
import { Search } from 'lucide-react';

export const SearchBar = React.memo(({ value, onChange, placeholder = 'Search...' }) => {
  return (
    <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', width: '100%' }}>
      <Search size={16} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
