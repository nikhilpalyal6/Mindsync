import React from 'react';

export const RoleBadge = React.memo(({ role }) => {
  const roleName = role ? role.toUpperCase() : 'USER';

  switch (roleName) {
    case 'SUPER_ADMIN':
      return <span className="admin-badge purple">Super Admin</span>;
    case 'ADMIN':
      return <span className="admin-badge blue">Admin</span>;
    case 'USER':
    default:
      return <span className="admin-badge gray">User</span>;
  }
});

RoleBadge.displayName = 'RoleBadge';
export default RoleBadge;
