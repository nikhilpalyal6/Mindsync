import React from 'react';
import { 
  LogIn, LogOut, RefreshCw, Key, UserCheck, ShieldAlert, Trash2, Info 
} from 'lucide-react';

export const AuditTimeline = React.memo(({ logs, onViewDetails }) => {
  const getActionIcon = (action = '') => {
    const act = action.toLowerCase();
    if (act.includes('login')) return <LogIn size={13} style={{ color: '#10b981' }} />;
    if (act.includes('logout')) return <LogOut size={13} style={{ color: '#ef4444' }} />;
    if (act.includes('password') || act.includes('reset')) return <Key size={13} style={{ color: '#f59e0b' }} />;
    if (act.includes('profile') || act.includes('update')) return <RefreshCw size={13} style={{ color: '#3b82f6' }} />;
    if (act.includes('verify') || act.includes('email')) return <UserCheck size={13} style={{ color: '#a78bfa' }} />;
    if (act.includes('delete')) return <Trash2 size={13} style={{ color: '#ef4444' }} />;
    return <Info size={13} style={{ color: '#9ca3af' }} />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Audit Timeline Feed</h3>

      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px', borderLeft: '1px solid var(--admin-border)', gap: '24px', margin: '8px 0 8px 12px' }}>
        {logs && logs.length > 0 ? (
          logs.slice(0, 10).map((log, idx) => (
            <div 
              key={log._id || idx} 
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}
              onClick={() => onViewDetails(log)}
            >
              {/* Vertical line connector bullet */}
              <div style={{
                position: 'absolute',
                left: '-34px',
                top: '2px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#0c1221',
                border: '1px solid var(--admin-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}>
                {getActionIcon(log.action)}
              </div>

              {/* Time header */}
              <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                {formatDate(log.createdAt)}
              </span>

              {/* Content body */}
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                {log.action}
              </span>
              <span style={{ fontSize: '0.775rem', color: 'var(--admin-text-muted)' }}>
                Triggered by <strong style={{ color: '#e5e7eb' }}>{log.userId?.name || 'System / Guest'}</strong> {log.ipAddress && `from IP ${log.ipAddress}`}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--admin-text-disabled)', fontSize: '0.85rem', paddingLeft: '8px' }}>
            No recent activity logs recorded in audit timeline.
          </div>
        )}
      </div>
    </div>
  );
});

AuditTimeline.displayName = 'AuditTimeline';
export default AuditTimeline;
