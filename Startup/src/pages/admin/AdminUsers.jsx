import React from 'react';
import { Users } from 'lucide-react';

export const AdminUsers = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Users Management</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Manage, inspect, and moderate MindSync platform accounts.</p>
      </div>

      <div className="admin-empty-state">
        <div className="admin-empty-icon-container">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="admin-empty-title">No user data available</h3>
        <p className="admin-empty-description">
          The user accounts retrieval API endpoint is not configured. Regular user security verification is enforced by backend routers.
        </p>
      </div>
    </div>
  );
};

export default AdminUsers;
