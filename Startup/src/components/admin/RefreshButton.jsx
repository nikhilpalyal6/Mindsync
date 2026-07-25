import React from 'react';
import { RefreshCw } from 'lucide-react';

export const RefreshButton = React.memo(({ onRefresh, lastRefreshed, loading }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      {lastRefreshed && (
        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          Last Updated: <strong style={{ color: 'var(--admin-text-main)' }}>{lastRefreshed}</strong>
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="admin-nav-action-btn"
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '8px 14px', 
          fontSize: '0.825rem',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
        title="Refresh analytics data"
        aria-label="Refresh analytics data"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
      </button>
    </div>
  );
});

RefreshButton.displayName = 'RefreshButton';
export default RefreshButton;
