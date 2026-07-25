import React from 'react';
import StatusBadge from './StatusBadge';

export const IntegrationCard = React.memo(({ name, status, description, icon: Icon }) => {
  return (
    <div className="admin-card" style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '18px',
      borderRadius: '12px',
      minHeight: '160px',
      flex: '1 1 240px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid var(--admin-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--admin-text-muted)',
          flexShrink: 0
        }}>
          {Icon && <Icon size={20} />}
        </div>

        <StatusBadge status={status} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{name}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', lineHeight: '1.4' }}>{description}</span>
      </div>
    </div>
  );
});

IntegrationCard.displayName = 'IntegrationCard';
export default IntegrationCard;
