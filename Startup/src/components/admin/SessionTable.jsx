import React from 'react';

export const SessionTable = React.memo(({ sessions }) => {
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
        <table className="admin-table" aria-label="Active device sessions tracker">
          <thead>
            <tr>
              <th className="admin-th">User Account</th>
              <th className="admin-th">Email</th>
              <th className="admin-th" style={{ width: '120px' }}>IP Address</th>
              <th className="admin-th">Device Details</th>
              <th className="admin-th" style={{ width: '100px' }}>Status</th>
              <th className="admin-th" style={{ width: '180px' }}>Expires At</th>
            </tr>
          </thead>
          <tbody>
            {sessions && sessions.length > 0 ? (
              sessions.map((sess) => (
                <tr key={sess._id} className="admin-tr">
                  <td className="admin-td">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{sess.userId?.name || 'Deleted User'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                        {sess.userId ? `@${sess.userId.username}` : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                    {sess.userId?.email || 'N/A'}
                  </td>
                  <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                    {sess.ipAddress || 'Unknown'}
                  </td>
                  <td className="admin-td" style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{sess.device || 'Desktop'} ({sess.os || 'Unknown'})</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{sess.browser || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="admin-td">
                    <span className="admin-badge green">
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: '#10b981',
                        marginRight: '6px',
                        display: 'inline-block'
                      }}></span>
                      Active
                    </span>
                  </td>
                  <td className="admin-td" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(sess.expiresAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--admin-text-disabled)' }}>
                  No active session tokens found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

SessionTable.displayName = 'SessionTable';
export default SessionTable;
