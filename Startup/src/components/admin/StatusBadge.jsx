import React from 'react';

export const StatusBadge = React.memo(({ status }) => {
  if (!status) return null;

  const text = status.toString();
  const lower = text.toLowerCase();

  let badgeClass = 'gray';
  let dotColor = '#9ca3af';

  if (['active', 'enabled', 'connected', 'healthy', 'configured'].includes(lower)) {
    badgeClass = 'green';
    dotColor = '#10b981';
  } else if (['processing', 'pending'].includes(lower)) {
    badgeClass = 'blue';
    dotColor = '#3b82f6';
  } else if (['inactive', 'disabled', 'disconnected', 'failed', 'not configured'].includes(lower)) {
    badgeClass = 'red';
    dotColor = '#ef4444';
  }

  return (
    <span className={`admin-badge ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        backgroundColor: dotColor,
        marginRight: '6px',
        display: 'inline-block'
      }}></span>
      {text}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';
export default StatusBadge;
