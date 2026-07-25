import React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

export const ExportButtons = React.memo(() => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        disabled
        className="admin-btn admin-btn-secondary"
        style={{ 
          padding: '8px 14px', 
          fontSize: '0.825rem', 
          borderRadius: '8px', 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px',
          cursor: 'not-allowed',
          opacity: 0.5
        }}
        title="Export functionality is not available."
        aria-label="Export CSV data (unavailable)"
      >
        <FileSpreadsheet size={14} />
        <span>Export CSV</span>
      </button>

      <button
        disabled
        className="admin-btn admin-btn-secondary"
        style={{ 
          padding: '8px 14px', 
          fontSize: '0.825rem', 
          borderRadius: '8px', 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px',
          cursor: 'not-allowed',
          opacity: 0.5
        }}
        title="Export functionality is not available."
        aria-label="Export PDF report (unavailable)"
      >
        <FileText size={14} />
        <span>Export PDF</span>
      </button>
    </div>
  );
});

ExportButtons.displayName = 'ExportButtons';
export default ExportButtons;
