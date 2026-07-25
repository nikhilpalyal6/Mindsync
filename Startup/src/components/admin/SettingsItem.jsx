import React from 'react';

export const SettingsItem = React.memo(({ label, description, children, noBorder = false }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      padding: '16px 0',
      borderBottom: noBorder ? 'none' : '1px solid rgba(255, 255, 255, 0.03)',
      width: '100%'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 280px', minWidth: 0 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}>{label}</span>
        {description && (
          <span style={{ fontSize: '0.775rem', color: 'var(--admin-text-muted)', lineHeight: '1.4', display: 'block' }}>
            {description}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
});

SettingsItem.displayName = 'SettingsItem';
export default SettingsItem;
