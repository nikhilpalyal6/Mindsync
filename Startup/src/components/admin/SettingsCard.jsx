import React from 'react';

export const SettingsCard = React.memo(({ title, description, children }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '18px', 
      width: '100%', 
      backgroundColor: 'var(--admin-card-bg)',
      border: '1px solid var(--admin-border)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
    }}>
      {(title || description) && (
        <div style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '14px' }}>
          {title && <h3 className="text-base font-semibold text-white" style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>}
          {description && (
            <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)', lineHeight: '1.4' }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {children}
      </div>
    </div>
  );
});

SettingsCard.displayName = 'SettingsCard';
export default SettingsCard;
