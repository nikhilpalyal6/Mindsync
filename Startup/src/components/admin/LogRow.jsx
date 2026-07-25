import React from 'react';
import { 
  LogIn, LogOut, RefreshCw, Key, UserCheck, ShieldAlert, Trash2, Info, Server, ShieldX 
} from 'lucide-react';

export const LogRow = React.memo(({ log, type, onViewDetails }) => {
  const getActionIcon = (action = '', category = '') => {
    const act = action.toLowerCase();
    const cat = category.toLowerCase();
    
    if (cat === 'security_event') return <ShieldX size={14} style={{ color: '#ef4444' }} />;
    if (cat === 'system_event') return <Server size={14} style={{ color: '#60a5fa' }} />;
    
    if (act.includes('login')) return <LogIn size={14} style={{ color: '#10b981' }} />;
    if (act.includes('logout')) return <LogOut size={14} style={{ color: '#ef4444' }} />;
    if (act.includes('password') || act.includes('reset')) return <Key size={14} style={{ color: '#f59e0b' }} />;
    if (act.includes('profile') || act.includes('update')) return <RefreshCw size={14} style={{ color: '#3b82f6' }} />;
    if (act.includes('verify') || act.includes('email')) return <UserCheck size={14} style={{ color: '#a78bfa' }} />;
    if (act.includes('delete')) return <Trash2 size={14} style={{ color: '#ef4444' }} />;
    return <Info size={14} style={{ color: '#9ca3af' }} />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (type === 'activity') {
    const user = log.userId?.name || log.userName || 'System / Guest';
    const email = log.userId?.email || log.email || 'N/A';
    const role = log.userId?.role || log.role || 'GUEST';

    return (
      <tr className="admin-tr" style={{ cursor: 'pointer' }} onClick={() => onViewDetails(log)}>
        <td className="admin-td">
          <div style={{
            display: 'inline-flex',
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--admin-border)'
          }}>
            {getActionIcon(log.action, log.category)}
          </div>
        </td>
        <td className="admin-td">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{log.action}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', display: 'block', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.description}
            </span>
          </div>
        </td>
        <td className="admin-td">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 500 }}>{user}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
              {role} {email !== 'N/A' && `(${email})`}
            </span>
          </div>
        </td>
        <td className="admin-td">
          <span className={`admin-badge ${log.status === 'success' ? 'green' : log.status === 'failure' ? 'red' : 'yellow'}`}>
            {log.status}
          </span>
        </td>
        <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
          {log.ipAddress || 'N/A'}
        </td>
        <td className="admin-td" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
          {formatDate(log.createdAt)}
        </td>
      </tr>
    );
  }

  // default type === 'login'
  return (
    <tr className="admin-tr" style={{ cursor: 'pointer' }} onClick={() => onViewDetails(log)}>
      <td className="admin-td">
        <div style={{
          display: 'inline-flex',
          padding: '6px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255,255,255,0.01)',
          border: '1px solid var(--admin-border)'
        }}>
          {log.success ? <LogIn size={14} style={{ color: '#10b981' }} /> : <ShieldAlert size={14} style={{ color: '#ef4444' }} />}
        </div>
      </td>
      <td className="admin-td">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{log.userId?.name || 'Failed Attempt'}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
            {log.userId ? `@${log.userId.username}` : 'N/A'}
          </span>
        </div>
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
        {log.userId?.email || 'N/A'}
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
        {log.browser || 'Unknown'} / {log.os || 'Unknown'}
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
        {log.device || 'Desktop'}
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
        {log.ipAddress || 'Unknown'}
      </td>
      <td className="admin-td">
        <span className={`admin-badge ${log.success ? 'green' : 'red'}`}>
          {log.success ? 'Success' : 'Failed'}
        </span>
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
        {formatDate(log.loginTime)}
      </td>
    </tr>
  );
});

LogRow.displayName = 'LogRow';
export default LogRow;
