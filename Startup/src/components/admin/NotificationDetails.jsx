import React from 'react';
import { X, Calendar, User, Shield, Info, CheckCircle } from 'lucide-react';

export const NotificationDetails = React.memo(({ notification, onClose }) => {
  if (!notification) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '450px',
      height: '100%',
      backgroundColor: '#0c1221',
      borderLeft: '1px solid var(--admin-border)',
      boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.4)',
      padding: '24px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 className="text-lg font-bold text-white" style={{ margin: 0 }}>Notification Audit Details</h3>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--admin-text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
          aria-label="Close details panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Title */}
      <div style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '16px' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
          {notification.title}
        </h4>
        <span className={`admin-badge ${notification.priority === 'high' ? 'red' : (notification.priority === 'medium' ? 'blue' : 'gray')}`} style={{ textTransform: 'capitalize', marginRight: '8px' }}>
          {notification.priority} priority
        </span>
        <span className="admin-badge gray" style={{ textTransform: 'capitalize' }}>
          Type: {notification.type}
        </span>
      </div>

      {/* Message Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Message Payload</span>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.01)',
          border: '1px solid var(--admin-border)',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '0.875rem',
          color: '#e5e7eb',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap'
        }}>
          {notification.message}
        </div>
      </div>

      {/* Details list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--admin-border)', paddingTop: '20px' }}>
        {/* Recipient info */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <User size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Recipient User</span>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{notification.recipient?.name || 'Deleted User'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>@{notification.recipient?.username} ({notification.recipient?.email})</span>
          </div>
        </div>

        {/* Sender Info */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Shield size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sender Context</span>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{notification.sender?.name || 'System Auto-Trigger'}</span>
            {notification.sender && (
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Role: {notification.sender.role}</span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Calendar size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Creation Date</span>
            <span style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>{formatDate(notification.createdAt)}</span>
          </div>
        </div>

        {/* Read Info */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <CheckCircle size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Read Acknowledgement</span>
            <span style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
              {notification.isRead ? `Acknowledged at ${formatDate(notification.readAt)}` : 'Pending (Unread)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

NotificationDetails.displayName = 'NotificationDetails';
export default NotificationDetails;
