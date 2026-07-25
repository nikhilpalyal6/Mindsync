import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

export const QuickActionCard = React.memo(({ label, path, icon: Icon }) => {
  return (
    <Link 
      to={path} 
      className="admin-btn admin-btn-secondary" 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        width: '100%',
        padding: '12px 18px',
        borderRadius: '10px',
        transition: 'var(--admin-transition)',
        minWidth: 0
      }}
      aria-label={`Navigate to ${label}`}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, marginRight: '8px' }}>
        {Icon && <Icon style={{ width: '16px', height: '16px', color: 'var(--admin-primary)', flexShrink: 0 }} />}
        <span style={{ 
          fontSize: '0.875rem', 
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {label}
        </span>
      </span>
      <FiArrowRight style={{ width: '14px', height: '14px', opacity: 0.7, flexShrink: 0 }} />
    </Link>
  );
});

QuickActionCard.displayName = 'QuickActionCard';
export default QuickActionCard;
