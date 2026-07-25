import React from 'react';
import { Users, UserCheck, UserX, UserPlus, Shield, Globe, HardDrive } from 'lucide-react';
import AnalyticsCard from './AnalyticsCard';

export const StatisticsGrid = React.memo(({ stats }) => {
  const cards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers,
      description: 'Total accounts registered',
      icon: Users,
      color: '#3b82f6'
    },
    {
      title: 'Verified Users',
      value: stats?.verifiedUsers,
      description: 'Email addresses verified',
      icon: UserCheck,
      color: '#10b981'
    },
    {
      title: 'Active Users',
      value: stats?.activeUsers,
      description: 'Accounts currently active',
      icon: Globe,
      color: '#a78bfa'
    },
    {
      title: 'New Users Today',
      value: stats?.newUsersToday,
      description: 'Registered in the last 24h',
      icon: UserPlus,
      color: '#f59e0b'
    },
    {
      title: 'Google Users',
      value: stats?.googleUsers,
      description: 'OAuth provider signups',
      icon: Globe,
      color: '#ef4444'
    },
    {
      title: 'Local Users',
      value: stats?.localUsers,
      description: 'Email / Password signups',
      icon: HardDrive,
      color: '#3b82f6'
    },
    {
      title: 'Admin Count',
      value: stats?.adminCount,
      description: 'Admins & Super Admins',
      icon: Shield,
      color: '#a78bfa'
    },
    {
      title: 'User Count',
      value: stats?.userCount,
      description: 'Regular study accounts',
      icon: Users,
      color: '#10b981'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '16px',
      width: '100%'
    }}>
      {cards.map((card, idx) => (
        <AnalyticsCard
          key={idx}
          title={card.title}
          value={card.value}
          description={card.description}
          icon={card.icon}
          color={card.color}
        />
      ))}
    </div>
  );
});

StatisticsGrid.displayName = 'StatisticsGrid';
export default StatisticsGrid;
