import React from 'react';
import { X, Calendar, User, ShieldAlert, Cpu } from 'lucide-react';

export const LogDetailsModal = React.memo(({ log, onClose }) => {
  if (!log) return null;

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

  const isActivity = log.category !== undefined;
  const user = log.userId?.name || log.userName || 'System / Guest';
  const email = log.userId?.email || log.email || 'N/A';
  const role = log.userId?.role || log.role || 'GUEST';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div className="admin-card" style={{
        width: '100%',
        maxWidth: '560px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--admin-border)',
        borderRadius: '12px',
        maxHeight: '90%',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--admin-primary)' }}>
            <ShieldAlert size={18} />
            <h3 className="text-base font-bold text-white" style={{ margin: 0 }}>
              {isActivity ? 'Audit Trail Details' : 'Login Log Details'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--admin-text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action / Category */}
          <div style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '12px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Action / Category
            </span>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: '4px 0 0 0' }}>
              {isActivity ? log.action : (log.success ? 'Login Success' : 'Login Failure')}
            </h4>
            {isActivity && (
              <span style={{ display: 'inline-block', fontSize: '0.75rem', backgroundColor: 'var(--admin-border)', padding: '2px 8px', borderRadius: '4px', marginTop: '6px', color: 'var(--admin-text-muted)', fontWeight: 600, fontFamily: 'monospace' }}>
                {log.category}
              </span>
            )}
          </div>

          {/* Description */}
          {isActivity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Description</span>
              <p style={{ fontSize: '0.85rem', color: '#e5e7eb', margin: 0, lineHeight: '1.5' }}>
                {log.description}
              </p>
            </div>
          )}

          {/* User Section */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <User size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>User Context</span>
              <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                {user}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                Role: <strong style={{ color: '#e5e7eb' }}>{role}</strong> {email !== 'N/A' && `| Email: ${email}`}
              </span>
            </div>
          </div>

          {/* System metadata */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Cpu size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Client Properties</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', color: '#e5e7eb' }}>
                <div><strong>IP Address:</strong> {log.ipAddress || 'Unknown'}</div>
                <div><strong>Device:</strong> {log.device || 'Desktop'}</div>
                <div><strong>Browser:</strong> {log.browser || 'Unknown'}</div>
                <div><strong>Operating System:</strong> {log.os || 'Unknown'}</div>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Calendar size={16} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Event Time</span>
              <span style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                {formatDate(isActivity ? log.createdAt : log.loginTime)}
              </span>
            </div>
          </div>

          {/* Complete Details JSON Payload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Raw Log Payload
            </span>
            <pre style={{
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid var(--admin-border)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.75rem',
              color: '#a78bfa',
              fontFamily: 'monospace',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {JSON.stringify(isActivity ? (log.metadata || {}) : log, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--admin-border)', paddingTop: '16px', marginTop: '4px' }}>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
});

LogDetailsModal.displayName = 'LogDetailsModal';
export default LogDetailsModal;
