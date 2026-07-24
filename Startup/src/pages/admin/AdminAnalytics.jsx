import React from 'react';
import { BarChart3 } from 'lucide-react';

export const AdminAnalytics = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Platform Analytics</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Deep analytics, active sessions, and system throughput monitors.</p>
      </div>

      <div className="admin-empty-state">
        <div className="admin-empty-icon-container">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h3 className="admin-empty-title">No analytics data available</h3>
        <p className="admin-empty-description">
          Detailed platform usage analytics and event streams require additional background tracking services. Basic registration data is available on the main dashboard.
        </p>
      </div>
    </div>
  );
};

export default AdminAnalytics;
