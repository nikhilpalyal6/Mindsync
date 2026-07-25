import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Eye, ShieldAlert, ShieldCheck, CheckSquare, AlertTriangle } from 'lucide-react';
import UserAvatar from './UserAvatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';

export const UserRow = React.memo(({ 
  user, 
  currentUser, 
  isSelected, 
  onSelectToggle, 
  onViewDetails, 
  onActionTrigger 
}) => {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const isSelf = currentUser?._id === user._id;
  const isTargetSuperAdmin = user.role === 'SUPER_ADMIN';
  const isCurrentUserAdminOnly = currentUser?.role === 'ADMIN';

  // Security checks for action permissions
  const canModify = !isSelf && !(isTargetSuperAdmin && isCurrentUserAdminOnly);
  const canModifyRole = canModify && currentUser?.role === 'SUPER_ADMIN'; // only SUPER_ADMIN can modify roles!

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <tr className={`admin-tr ${isSelected ? 'selected' : ''}`} style={{ outline: 'none' }}>
      <td className="admin-td" style={{ width: '40px' }}>
        <label className="admin-checkbox-container" aria-label={`Select ${user.name}`}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelectToggle(user._id)}
            disabled={!canModify} // security rule: cannot bulk update self/SUPER_ADMIN by ADMIN
            className="admin-checkbox"
          />
        </label>
      </td>
      <td className="admin-td">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <UserAvatar user={user} size="sm" />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>{user.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>@{user.username}</span>
          </div>
        </div>
      </td>
      <td className="admin-td" style={{ color: '#e5e7eb' }}>
        {user.email}
      </td>
      <td className="admin-td">
        <RoleBadge role={user.role} />
      </td>
      <td className="admin-td" style={{ textTransform: 'capitalize', color: 'var(--admin-text-muted)' }}>
        {user.provider}
      </td>
      <td className="admin-td">
        <UserStatusBadge type="verified" value={user.isVerified} />
      </td>
      <td className="admin-td">
        <UserStatusBadge type="active" value={user.isActive} />
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
        {formatDate(user.lastLogin)}
      </td>
      <td className="admin-td" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
        {formatDate(user.createdAt)}
      </td>
      <td className="admin-td" style={{ textAlign: 'right', position: 'relative' }} ref={actionsRef}>
        <button
          onClick={() => setIsActionsOpen(!isActionsOpen)}
          className="admin-nav-action-btn"
          aria-label={`Actions for ${user.name}`}
          aria-haspopup="true"
          aria-expanded={isActionsOpen}
        >
          <MoreHorizontal size={16} />
        </button>

        {isActionsOpen && (
          <div className="admin-dropdown-menu" style={{ right: 0, top: '100%', marginTop: '4px', zIndex: 10 }}>
            <button
              onClick={() => { onViewDetails(user); setIsActionsOpen(false); }}
              className="admin-dropdown-item"
            >
              <Eye className="w-4 h-4" />
              <span>View details</span>
            </button>

            {canModify && (
              <>
                <button
                  onClick={() => { onActionTrigger(user, 'status', !user.isActive); setIsActionsOpen(false); }}
                  className="admin-dropdown-item"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{user.isActive ? 'Deactivate user' : 'Activate user'}</span>
                </button>

                <button
                  onClick={() => { onActionTrigger(user, 'verify', !user.isVerified); setIsActionsOpen(false); }}
                  className="admin-dropdown-item"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{user.isVerified ? 'Unverify user' : 'Verify user'}</span>
                </button>
              </>
            )}

            {canModifyRole && (
              <>
                {user.role === 'USER' ? (
                  <button
                    onClick={() => { onActionTrigger(user, 'role', 'ADMIN'); setIsActionsOpen(false); }}
                    className="admin-dropdown-item"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Promote to Admin</span>
                  </button>
                ) : user.role === 'ADMIN' ? (
                  <button
                    onClick={() => { onActionTrigger(user, 'role', 'USER'); setIsActionsOpen(false); }}
                    className="admin-dropdown-item"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Demote to User</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
});

UserRow.displayName = 'UserRow';
export default UserRow;
