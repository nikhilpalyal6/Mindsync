import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import UserRow from './UserRow';

export const UsersTable = React.memo(({ 
  users, 
  currentUser,
  selectedUserIds, 
  onSelectAllToggle, 
  onSelectToggle, 
  onViewDetails, 
  onActionTrigger,
  sortBy,
  sortOrder,
  onSortChange
}) => {
  
  const handleSortClick = (field) => {
    onSortChange(field);
  };

  const renderSortIcon = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' 
      ? <ArrowUp size={12} style={{ marginLeft: '4px', display: 'inline-block' }} />
      : <ArrowDown size={12} style={{ marginLeft: '4px', display: 'inline-block' }} />;
  };

  // Find users that can be selected (exclude self and SUPER_ADMIN if current user is ADMIN)
  const selectableUsers = users.filter(u => {
    const isSelf = currentUser?._id === u._id;
    const isTargetSuperAdmin = u.role === 'SUPER_ADMIN';
    const isCurrentUserAdminOnly = currentUser?.role === 'ADMIN';
    return !isSelf && !(isTargetSuperAdmin && isCurrentUserAdminOnly);
  });

  const isAllSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedUserIds.includes(u._id));
  const isSomeSelected = selectableUsers.length > 0 && selectableUsers.some(u => selectedUserIds.includes(u._id)) && !isAllSelected;

  const handleSelectAllChange = (e) => {
    const targetIds = selectableUsers.map(u => u._id);
    onSelectAllToggle(e.target.checked, targetIds);
  };

  return (
    <div className="admin-table-wrapper">
      <div className="admin-table-container">
        <table className="admin-table" aria-label="MindSync User Accounts">
          <thead>
            <tr>
              <th className="admin-th" style={{ width: '40px' }}>
                <label className="admin-checkbox-container" aria-label="Select all users on page">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleSelectAllChange}
                    className="admin-checkbox"
                    disabled={selectableUsers.length === 0}
                  />
                </label>
              </th>
              <th 
                className="admin-th admin-th-sortable" 
                onClick={() => handleSortClick('name')}
              >
                Name {renderSortIcon('name')}
              </th>
              <th className="admin-th">
                Email
              </th>
              <th 
                className="admin-th admin-th-sortable" 
                onClick={() => handleSortClick('role')}
              >
                Role {renderSortIcon('role')}
              </th>
              <th className="admin-th">
                Provider
              </th>
              <th className="admin-th">
                Verified
              </th>
              <th className="admin-th">
                Active Status
              </th>
              <th 
                className="admin-th admin-th-sortable" 
                onClick={() => handleSortClick('lastLogin')}
              >
                Last Login {renderSortIcon('lastLogin')}
              </th>
              <th 
                className="admin-th admin-th-sortable" 
                onClick={() => handleSortClick('createdAt')}
              >
                Joined {renderSortIcon('createdAt')}
              </th>
              <th className="admin-th" style={{ textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user._id}
                user={user}
                currentUser={currentUser}
                isSelected={selectedUserIds.includes(user._id)}
                onSelectToggle={onSelectToggle}
                onViewDetails={onViewDetails}
                onActionTrigger={onActionTrigger}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

UsersTable.displayName = 'UsersTable';
export default UsersTable;
