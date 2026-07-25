import React from 'react';
import LogRow from './LogRow';

export const LogTable = React.memo(({ logs, type, onViewDetails }) => {
  return (
    <div className="admin-table-wrapper" style={{ margin: 0 }}>
      <div className="admin-table-container">
        <table className="admin-table" aria-label="System audit log feed">
          <thead>
            {type === 'activity' ? (
              <tr>
                <th className="admin-th" style={{ width: '40px' }}>Icon</th>
                <th className="admin-th">Action / Description</th>
                <th className="admin-th">User Context</th>
                <th className="admin-th" style={{ width: '100px' }}>Status</th>
                <th className="admin-th" style={{ width: '120px' }}>IP Address</th>
                <th className="admin-th" style={{ width: '180px' }}>Timestamp</th>
              </tr>
            ) : (
              <tr>
                <th className="admin-th" style={{ width: '40px' }}>State</th>
                <th className="admin-th">User Name</th>
                <th className="admin-th">Email</th>
                <th className="admin-th">Client Agent</th>
                <th className="admin-th" style={{ width: '100px' }}>Device</th>
                <th className="admin-th" style={{ width: '120px' }}>IP Address</th>
                <th className="admin-th" style={{ width: '100px' }}>Status</th>
                <th className="admin-th" style={{ width: '180px' }}>Login Time</th>
              </tr>
            )}
          </thead>
          <tbody>
            {logs && logs.length > 0 ? (
              logs.map((log, idx) => (
                <LogRow 
                  key={log._id || idx} 
                  log={log} 
                  type={type} 
                  onViewDetails={onViewDetails} 
                />
              ))
            ) : (
              <tr>
                <td colSpan={type === 'activity' ? 6 : 8} style={{ textAlign: 'center', padding: '36px', color: 'var(--admin-text-disabled)' }}>
                  No system logs match active filter presets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

LogTable.displayName = 'LogTable';
export default LogTable;
