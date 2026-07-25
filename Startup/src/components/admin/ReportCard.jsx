import React from 'react';

export const ReportCard = React.memo(({ type, label, description, icon: Icon, selectedType, onSelect }) => {
  const isSelected = selectedType === type;

  return (
    <button
      onClick={() => onSelect(type)}
      className="admin-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        border: isSelected ? '1px solid var(--admin-primary)' : '1px solid var(--admin-border)',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.02)' : 'var(--admin-card-bg)',
        transition: 'var(--admin-transition)',
        padding: '16px',
        borderRadius: '12px'
      }}
      aria-label={`Select ${label}`}
      aria-pressed={isSelected}
    >
      <div style={{
        padding: '10px',
        borderRadius: '8px',
        backgroundColor: isSelected ? 'var(--admin-primary-glow)' : 'rgba(255,255,255,0.01)',
        border: '1px solid var(--admin-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isSelected ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
        flexShrink: 0
      }}>
        {Icon && <Icon size={18} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isSelected ? '#fff' : '#e5e7eb' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {description}
        </span>
      </div>
    </button>
  );
});

ReportCard.displayName = 'ReportCard';
export default ReportCard;
