import React from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

export const AdminSystemLogs = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>System Logs</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Realtime platform audit trails, database streams, and error streams.</p>
      </div>

      <div className="admin-terminal">
        <div className="admin-terminal-header">
          <div className="admin-terminal-dot red"></div>
          <div className="admin-terminal-dot yellow"></div>
          <div className="admin-terminal-dot green"></div>
          <span className="admin-terminal-title">mindsync-admin-console - bash</span>
        </div>
        <div className="admin-terminal-body">
          <p style={{ margin: '0 0 8px 0', color: '#6b7280' }}>mindsync-admin-console:~$ tail -f /var/log/syslog</p>
          <p style={{ margin: '0 0 4px 0', color: '#10b981' }}>[INFO] 2026-07-25 02:00:00 - MindSync Admin Console session initialized.</p>
          <p style={{ margin: '0 0 4px 0', color: '#10b981' }}>[INFO] 2026-07-25 02:00:00 - Security role check verified for administrator.</p>
          <p style={{ margin: '0 0 12px 0', color: '#f59e0b' }}>[WARNING] Audit log collection module is not configured in backend settings.</p>
          <p style={{ margin: 0, color: '#ef4444' }}>[ERROR] No logs available.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemLogs;
