import React from 'react';
import UserAvatar from './UserAvatar';

export const RecentRegistrations = React.memo(({ registrations }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Recent Registrations</h3>

      <div className="admin-table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table className="admin-table" aria-label="Latest registrations">
          <thead>
            <tr>
              <th className="admin-th" style={{ padding: '10px 14px' }}>User</th>
              <th className="admin-th" style={{ padding: '10px 14px' }}>Email</th>
              <th className="admin-th" style={{ padding: '10px 14px', textAlign: 'right' }}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {registrations && registrations.length > 0 ? (
              registrations.map((user) => (
                <tr key={user._id} className="admin-tr">
                  <td className="admin-td" style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <UserAvatar user={user} size="sm" />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.825rem' }}>{user.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="admin-td" style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#e5e7eb' }}>
                    {user.email}
                  </td>
                  <td className="admin-td" style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--admin-text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--admin-text-disabled)' }}>
                  No registrations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

RecentRegistrations.displayName = 'RecentRegistrations';
export default RecentRegistrations;
