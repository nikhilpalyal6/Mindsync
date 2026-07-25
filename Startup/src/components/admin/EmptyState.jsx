import React from 'react';
import { FiInbox } from 'react-icons/fi';

export const EmptyState = React.memo(({ title = 'No data available', description, icon: Icon = FiInbox }) => {
  return (
    <div className="admin-empty-state" role="region" aria-label={title}>
      <div className="admin-empty-icon-container" aria-hidden="true">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="admin-empty-title">{title}</h3>
      {description && (
        <p className="admin-empty-description">{description}</p>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
export default EmptyState;
