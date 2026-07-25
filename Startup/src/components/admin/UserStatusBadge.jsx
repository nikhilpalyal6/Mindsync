import React from 'react';

export const UserStatusBadge = React.memo(({ type, value }) => {
  if (type === 'active') {
    return value ? (
      <span className="admin-badge green" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '6px' }}></span>
        Active
      </span>
    ) : (
      <span className="admin-badge gray" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#9ca3af', marginRight: '6px' }}></span>
        Inactive
      </span>
    );
  }

  if (type === 'verified') {
    return value ? (
      <span className="admin-badge blue">Verified</span>
    ) : (
      <span className="admin-badge gray">Unverified</span>
    );
  }

  return null;
});

UserStatusBadge.displayName = 'UserStatusBadge';
export default UserStatusBadge;
