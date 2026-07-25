import React from 'react';
import { Bell, BellOff, Send, AlertTriangle } from 'lucide-react';

export const NotificationStats = React.memo(({ stats }) => {
  const cards = [
    {
      title: 'Total Notifications',
      value: stats?.totalNotifications ?? 0,
      icon: Bell,
      color: '#3b82f6',
      description: 'Logged alerts in history'
    },
    {
      title: 'Unread Alerts',
      value: stats?.unreadNotifications ?? 0,
      icon: BellOff,
      color: '#f59e0b',
      description: 'Pending user reading'
    },
    {
      title: 'Broadcasts',
      value: stats?.broadcastMessages ?? 0,
      icon: Send,
      color: '#10b981',
      description: 'Global announcements sent'
    },
    {
      title: 'System Errors',
      value: stats?.systemAlerts ?? 0,
      icon: AlertTriangle,
      color: '#ef4444',
      description: 'Critical host issues'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
      width: '100%',
      marginBottom: '8px'
    }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', minHeight: '110px', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: card.color,
              opacity: 0.03,
              filter: 'blur(15px)',
              pointerEvents: 'none'
            }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {card.title}
              </span>
              <div style={{
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--admin-border)',
                color: card.color
              }}>
                <Icon size={14} />
              </div>
            </div>

            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '2px 0' }}>
              {card.value.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
              {card.description}
            </span>
          </div>
        );
      })}
    </div>
  );
});

NotificationStats.displayName = 'NotificationStats';
export default NotificationStats;
