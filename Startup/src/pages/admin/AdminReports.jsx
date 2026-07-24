import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export const AdminReports = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>System Reports</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Generate, schedule, and export platform activity sheets (PDF/CSV).</p>
      </div>

      <div className="admin-empty-state">
        <div className="admin-empty-icon-container">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h3 className="admin-empty-title">No report data available</h3>
        <p className="admin-empty-description">
          Automated CSV/PDF reports compiling is not configured. Active registration and timeline logs are rendered directly on the primary dashboard.
        </p>
      </div>
    </div>
  );
};

export default AdminReports;
