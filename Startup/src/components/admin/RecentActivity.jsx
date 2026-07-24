import React from 'react';
import { motion } from 'framer-motion';
import { FiActivity, FiUserPlus, FiLogIn, FiLogOut, FiSettings } from 'react-icons/fi';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export const RecentActivity = React.memo(({ activities }) => {
  const getActionIcon = (action) => {
    const act = action.toLowerCase();
    if (act.includes('register') || act.includes('signup') || act.includes('create')) {
      return { icon: FiUserPlus, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    }
    if (act.includes('login') || act.includes('signin')) {
      return { icon: FiLogIn, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
    }
    if (act.includes('logout') || act.includes('signout')) {
      return { icon: FiLogOut, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    }
    if (act.includes('settings') || act.includes('update')) {
      return { icon: FiSettings, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    }
    return { icon: FiActivity, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="admin-card" style={{ minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#4b5563' }}>
          <FiActivity style={{ width: '32px', height: '32px', margin: '0 auto 12px auto', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No recent activity available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
      <h3 className="text-base font-semibold text-white mb-4" style={{ margin: '0 0 16px 0' }}>Recent Activity</h3>
      <div className="admin-scrollbar" style={{ flex: 1, overflowY: 'auto', maxHeight: '310px', paddingRight: '4px' }}>
        <motion.div 
          className="admin-activity-list"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {activities.map((activity) => {
            const { icon: Icon, color, bg } = getActionIcon(activity.action);
            const userInitials = activity.userId?.name
              ? activity.userId.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
              : 'U';
            
            return (
              <motion.div 
                key={activity._id} 
                className="admin-activity-item"
                variants={itemVariants}
              >
                <div 
                  className="admin-activity-avatar" 
                  style={{ backgroundColor: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="admin-activity-details">
                  <p className="admin-activity-user">
                    {activity.userId?.name || 'System'} 
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400, marginLeft: '6px' }}>
                      {activity.userId?.username ? `@${activity.userId.username}` : ''}
                    </span>
                  </p>
                  <p className="admin-activity-action">{activity.action}</p>
                  <p className="admin-activity-time">
                    {new Date(activity.createdAt).toLocaleString(undefined, { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
});

RecentActivity.displayName = 'RecentActivity';
export default RecentActivity;
