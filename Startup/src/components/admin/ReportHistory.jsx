import React from 'react';
import { History } from 'lucide-react';
import EmptyState from './EmptyState';

export const ReportHistory = React.memo(() => {
  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Download History</h3>
      
      <EmptyState
        title="No download history found"
        description="Historical PDF and CSV logs are not stored on the database server. Once reports are exported, they will download directly to your client terminal."
        icon={History}
      />
    </div>
  );
});

ReportHistory.displayName = 'ReportHistory';
export default ReportHistory;
