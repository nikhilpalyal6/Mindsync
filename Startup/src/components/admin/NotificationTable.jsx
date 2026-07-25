import React from 'react';
import { 
  Bell, AlertTriangle, ShieldCheck, User, Send, Cpu, Wrench, 
  Trash2, MailOpen, Mail 
} from 'lucide-react';

export const NotificationTable = React.memo(({
  notifications,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onViewDetails
}) => {
  const getIcon = (type) => {
    switch (type) {
      case 'security':
        return <ShieldCheck size={14} style={{ color: '#10b981' }} />;
      case 'user':
        return <User size={14} style={{ color: '#3b82f6' }} />;
      case 'broadcast':
        return <Send size={14} style={{ color: '#a78bfa' }} />;
      case 'ai':
        return <Cpu size={14} style={{ color: '#f59e0b' }} />;
      case 'maintenance':
        return <Wrench size={14} style={{ color: '#ef4444' }} />;
      default:
        return <Bell size={14} style={{ color: '#9ca3af' }} />;
    }
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
    <div className="admin-table-wrapper" style={{ margin: 0 }}>
      <div className="admin-table-container">
        <table className="admin-table" aria-label="Audited Notifications Feed">
          <thead>
            <tr>
              <th className="admin-th" style={{ width: '40px' }}>Type</th>
              <th className="admin-th">Alert Message</th>
              <th className="admin-th">User Target</th>
              <th className="admin-th" style={{ width: '100px' }}>Priority</th>
              <th className="admin-th" style={{ width: '100px' }}>Read</th>
              <th className="admin-th" style={{ width: '120px' }}>Received</th>
              <th className="admin-th" style={{ width: '100px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications && notifications.length > 0 ? (
              notifications.map((notif) => (
                <tr 
                  key={notif._id} 
                  className="admin-tr"
                  style={{
                    backgroundColor: notif.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.01)',
                    transition: 'var(--admin-transition)'
                  }}
                >
                  {/* Type Icon */}
                  <td className="admin-td">
                    <div style={{
                      display: 'inline-flex',
                      padding: '6px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--admin-border)'
                    }} title={notif.type}>
                      {getIcon(notif.type)}
                    </div>
                  </td>

                  {/* Title & Body */}
                  <td className="admin-td" style={{ minWidth: '220px', cursor: 'pointer' }} onClick={() => onViewDetails(notif)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ 
                        fontWeight: notif.isRead ? 600 : 700, 
                        color: notif.isRead ? '#e5e7eb' : '#fff',
                        fontSize: '0.85rem' 
                      }}>
                        {notif.title}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--admin-text-muted)',
                        maxWidth: '260px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={notif.message}>
                        {notif.message}
                      </span>
                    </div>
                  </td>

                  {/* Recipient User */}
                  <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>{notif.recipient?.name || 'Deleted User'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>@{notif.recipient?.username}</span>
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="admin-td">
                    <span className={`admin-badge ${notif.priority === 'high' ? 'red' : (notif.priority === 'medium' ? 'blue' : 'gray')}`} style={{ textTransform: 'capitalize' }}>
                      {notif.priority}
                    </span>
                  </td>

                  {/* Read State */}
                  <td className="admin-td">
                    <span className={`admin-badge ${notif.isRead ? 'green' : 'gray'}`}>
                      {notif.isRead ? 'Read' : 'Unread'}
                    </span>
                  </td>

                  {/* Date Created */}
                  <td className="admin-td" style={{ fontSize: '0.775rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(notif.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="admin-td" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {notif.isRead ? (
                        <button
                          onClick={() => onMarkUnread(notif._id)}
                          className="admin-action-btn"
                          title="Mark as unread"
                          style={{ color: 'var(--admin-text-muted)' }}
                        >
                          <Mail size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onMarkRead(notif._id)}
                          className="admin-action-btn"
                          title="Mark as read"
                          style={{ color: 'var(--admin-primary)' }}
                        >
                          <MailOpen size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => onDelete(notif._id)}
                        className="admin-action-btn"
                        title="Delete notification"
                        style={{ color: 'var(--admin-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--admin-text-disabled)' }}>
                  No notification logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

NotificationTable.displayName = 'NotificationTable';
export default NotificationTable;
