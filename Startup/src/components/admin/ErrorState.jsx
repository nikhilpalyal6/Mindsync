import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

export const ErrorState = React.memo(({ message = 'Failed to load data', onRetry }) => {
  return (
    <div className="admin-empty-state" role="alert">
      <div 
        className="admin-empty-icon-container" 
        style={{ borderColor: 'var(--admin-error)', color: 'var(--admin-error)' }}
        aria-hidden="true"
      >
        <FiAlertTriangle className="w-8 h-8" />
      </div>
      <h3 className="admin-empty-title">Error Loading Data</h3>
      <p className="admin-empty-description">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="admin-btn admin-btn-primary"
          style={{ transition: 'var(--admin-transition)' }}
        >
          Try Again
        </button>
      )}
    </div>
  );
});

ErrorState.displayName = 'ErrorState';
export default ErrorState;
