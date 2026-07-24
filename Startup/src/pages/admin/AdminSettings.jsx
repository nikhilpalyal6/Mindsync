import React from 'react';
import { Sliders } from 'lucide-react';

export const AdminSettings = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>Admin Console Settings</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Configure application policies, signup parameters, and console settings.</p>
      </div>

      <div className="admin-empty-state">
        <div className="admin-empty-icon-container">
          <Sliders className="w-8 h-8" />
        </div>
        <h3 className="admin-empty-title">No settings data available</h3>
        <p className="admin-empty-description">
          Global application configurations and toggle modules are managed in system environment variables. Local administrator settings are active on your personal profile.
        </p>
      </div>
    </div>
  );
};

export default AdminSettings;
