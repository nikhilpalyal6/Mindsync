import React from 'react';
import { FiCheckSquare, FiAlertCircle } from 'react-icons/fi';

export const BulkActions = React.memo(({ selectedCount, onBulkAction, onClearSelection }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="admin-bulk-banner" role="status" aria-label="Bulk actions banner">
      <div className="admin-bulk-info">
        <FiCheckSquare style={{ width: '18px', height: '18px' }} />
        <span>{selectedCount} {selectedCount === 1 ? 'user' : 'users'} selected</span>
      </div>

      <div className="admin-bulk-actions-group">
        <button
          onClick={() => onBulkAction('activate')}
          className="admin-btn admin-btn-primary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
        >
          Activate
        </button>
        <button
          onClick={() => onBulkAction('deactivate')}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          Deactivate
        </button>
        <button
          onClick={() => onBulkAction('verify')}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
        >
          Verify
        </button>
        <button
          onClick={() => onBulkAction('unverify')}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
        >
          Unverify
        </button>
        
        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--admin-primary)', opacity: 0.3, margin: '0 4px' }}></div>

        <button
          onClick={onClearSelection}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
});

BulkActions.displayName = 'BulkActions';
export default BulkActions;
