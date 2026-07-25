import React from 'react';
import { ShieldAlert, KeyRound, AlertOctagon } from 'lucide-react';

export const SecurityEventCard = React.memo(({ failedLoginsCount = 0, resetRequestsCount = 0 }) => {
  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldAlert size={16} style={{ color: '#ef4444' }} />
        <span>Security Audits Summary</span>
      </h3>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
        {/* Failed Login Warnings */}
        <div style={{
          flex: '1 1 200px',
          backgroundColor: 'rgba(239, 68, 68, 0.02)',
          border: '1px solid rgba(239, 68, 68, 0.1)',
          padding: '16px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#fca5a5', fontWeight: 600, textTransform: 'uppercase' }}>
            <AlertOctagon size={14} />
            <span>Failed Logins</span>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>
            {failedLoginsCount.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
            Blocked access requests recorded
          </span>
        </div>

        {/* Password Reset Requests */}
        <div style={{
          flex: '1 1 200px',
          backgroundColor: 'rgba(245, 158, 11, 0.02)',
          border: '1px solid rgba(245, 158, 11, 0.1)',
          padding: '16px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#fcd34d', fontWeight: 600, textTransform: 'uppercase' }}>
            <KeyRound size={14} />
            <span>Reset Requests</span>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>
            {resetRequestsCount.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
            Reset links sent to users
          </span>
        </div>
      </div>
    </div>
  );
});

SecurityEventCard.displayName = 'SecurityEventCard';
export default SecurityEventCard;
