import React from 'react';
import { BellRing } from 'lucide-react';

export const AdminNotifications = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Announcements & Notifications</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Broadcast system announcements and configure global alert rules.</p>
      </div>

      <div className="admin-empty-state">
        <div className="admin-empty-icon-container">
          <BellRing className="w-8 h-8" />
        </div>
        <h3 className="admin-empty-title">No notifications data available</h3>
        <p className="admin-empty-description">
          Global broadcast and system banner control endpoints are not active in this backend build. Announcements must be scheduled directly via database migrations.
        </p>
      </div>
    </div>
  );
};

export default AdminNotifications;
