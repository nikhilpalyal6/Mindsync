import React, { useEffect } from 'react';
import { X, Calendar, Key, Mail, User, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import UserAvatar from './UserAvatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';

export const UserDetailsDrawer = React.memo(({ isOpen, user, onClose }) => {
  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div 
        className="admin-drawer-overlay" 
        onClick={onClose}
        role="presentation"
      ></div>
      <div 
        className="admin-drawer" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="drawer-title"
      >
        <div className="admin-drawer-header">
          <h3 id="drawer-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>User Information</h3>
          <button 
            onClick={onClose}
            className="admin-nav-action-btn"
            style={{ padding: '6px' }}
            aria-label="Close details drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-drawer-body admin-scrollbar">
          {/* Avatar and Name */}
          <div className="admin-drawer-profile">
            <UserAvatar user={user} size="lg" />
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{user.name}</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--admin-primary)', fontWeight: 500 }}>@{user.username}</p>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <RoleBadge role={user.role} />
              <UserStatusBadge type="active" value={user.isActive} />
            </div>
          </div>

          {/* Details Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Account Metadata
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={16} style={{ color: 'var(--admin-text-disabled)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)' }}>Email Address</span>
                  <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>{user.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Key size={16} style={{ color: 'var(--admin-text-disabled)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)' }}>Authentication Provider</span>
                  <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500, textTransform: 'uppercase' }}>
                    {user.provider}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {user.isVerified ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--admin-success)' }} />
                ) : (
                  <ShieldAlert size={16} style={{ color: 'var(--admin-warning)' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)' }}>Verification Status</span>
                  <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>
                    {user.isVerified ? 'Verified Account' : 'Unverified Account'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Biography
            </h4>
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.01)', 
              border: '1px solid var(--admin-border)', 
              borderRadius: '8px', 
              padding: '12px',
              fontSize: '0.85rem',
              color: user.bio ? '#e5e7eb' : 'var(--admin-text-disabled)',
              lineHeight: 1.5,
              minHeight: '60px'
            }}>
              {user.bio || 'No biography written.'}
            </div>
          </div>

          {/* Timestamps Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--admin-border)', paddingTop: '20px' }}>
            <div className="admin-drawer-meta-grid">
              <div className="admin-drawer-meta-item">
                <span className="admin-drawer-meta-label">Joined Date</span>
                <span className="admin-drawer-meta-value" title={formatDate(user.createdAt)}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="admin-drawer-meta-item">
                <span className="admin-drawer-meta-label">Last Updated</span>
                <span className="admin-drawer-meta-value" title={formatDate(user.updatedAt)}>
                  {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="admin-drawer-meta-item" style={{ width: '100%' }}>
              <span className="admin-drawer-meta-label">Last Login Timestamp</span>
              <span className="admin-drawer-meta-value">
                {formatDate(user.lastLogin)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

UserDetailsDrawer.displayName = 'UserDetailsDrawer';
export default UserDetailsDrawer;
