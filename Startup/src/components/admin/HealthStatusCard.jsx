import React from 'react';
import { Database, Server, Mail, Image } from 'lucide-react';

export const HealthStatusCard = React.memo(({ health }) => {
  const getStatusConfig = (service, status) => {
    if (!status) {
      return { text: 'Status unavailable', color: '#6b7280' };
    }

    const state = status.toLowerCase();
    if (state === 'connected' || state === 'healthy') {
      return { text: 'Connected', color: '#10b981' };
    }
    if (state === 'unconfigured') {
      return { text: 'Unconfigured', color: '#f59e0b' };
    }
    if (state === 'error' || state === 'disconnected') {
      return { text: 'Error', color: '#ef4444' };
    }
    return { text: 'Status unavailable', color: '#6b7280' };
  };

  const services = [
    { name: 'MongoDB Database', key: 'database', icon: Database },
    { name: 'Backend API', key: 'api', icon: Server },
    { name: 'Email Service', key: 'email', icon: Mail },
    { name: 'Cloudinary Storage', key: 'cloudinary', icon: Image }
  ];

  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>System Health</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {services.map((service) => {
          const Icon = service.icon;
          const statusVal = health ? health[service.key] : null;
          const config = getStatusConfig(service.key, statusVal);

          return (
            <div 
              key={service.key} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--admin-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e5e7eb' }}>
                  {service.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: config.color,
                    boxShadow: `0 0 8px ${config.color}`
                  }}
                ></span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                  {config.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

HealthStatusCard.displayName = 'HealthStatusCard';
export default HealthStatusCard;
