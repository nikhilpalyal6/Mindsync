import React from 'react';
import { FiMail, FiUser, FiCalendar, FiShield } from 'react-icons/fi';

export const UserCard = React.memo(({ user, onAction }) => {
  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <div className="admin-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="admin-avatar">
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>@{user.username}</span>
        </div>
        <span style={{ 
          fontSize: '0.7rem', 
          fontWeight: 600, 
          padding: '2px 8px', 
          borderRadius: '12px', 
          backgroundColor: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
          color: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? '#3b82f6' : '#9ca3af' 
        }}>
          {user.role}
        </span>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
          <FiMail style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
          <FiCalendar style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {onAction && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1f2937', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => onAction(user)}
            className="admin-btn admin-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            Manage User
          </button>
        </div>
      )}
    </div>
  );
});

UserCard.displayName = 'UserCard';
export default UserCard;
