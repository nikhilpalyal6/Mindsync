import React from 'react';

export const AnalyticsCard = React.memo(({ title, value, description, icon: Icon, color = 'var(--admin-primary)' }) => {
  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', minHeight: '130px', position: 'relative', overflow: 'hidden' }}>
      {/* Visual background gradient circle */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: color,
        opacity: 0.05,
        filter: 'blur(20px)',
        pointerEvents: 'none'
      }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', margin: '4px 0' }}>
            {value !== undefined && value !== null ? value.toLocaleString() : '0'}
          </span>
        </div>

        <div style={{ 
          padding: '8px', 
          borderRadius: '8px', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--admin-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {Icon && <Icon size={18} style={{ color: color }} />}
        </div>
      </div>

      {description && (
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '8px', display: 'block' }}>
          {description}
        </span>
      )}
    </div>
  );
});

AnalyticsCard.displayName = 'AnalyticsCard';
export default AnalyticsCard;
