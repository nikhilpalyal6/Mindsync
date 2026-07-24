import React from 'react';
import { FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';

export const DashboardCard = React.memo(({ title, value, icon: Icon, trend }) => {
  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h4 className="admin-card-title">{title}</h4>
        <div className="admin-card-icon-wrapper">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="admin-card-value">{value}</p>
      
      {trend && (
        <div className={`admin-card-trend ${trend.type}`}>
          {trend.type === 'up' && <FiArrowUpRight className="w-3.5 h-3.5" />}
          {trend.type === 'down' && <FiArrowDownRight className="w-3.5 h-3.5" />}
          <span className="font-semibold">{trend.value}</span>
          <span className="text-[#9ca3af] font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
});

DashboardCard.displayName = 'DashboardCard';
export default DashboardCard;
