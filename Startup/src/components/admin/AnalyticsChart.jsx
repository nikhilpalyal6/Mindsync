import React from 'react';
import BarChartCard from './BarChartCard';
import LineChartCard from './LineChartCard';

export const AnalyticsChart = React.memo(({ userGrowthData, loginTrendData, activeUsersTrend }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Registrations & Logins Row */}
      <div className="admin-dashboard-layout-grid" style={{ marginBottom: 0 }}>
        <BarChartCard
          title="User Registrations Trend"
          data={userGrowthData}
          dataKey="count"
          color="#3b82f6"
        />

        <BarChartCard
          title="Login Frequency Trend"
          data={loginTrendData}
          dataKey="count"
          color="#10b981"
        />
      </div>

      {/* Daily Active Users Line Chart */}
      <div style={{ width: '100%' }}>
        <LineChartCard
          title="Active Users Trend (DAU)"
          data={activeUsersTrend}
          dataKey="count"
          color="#a78bfa"
          height={320}
        />
      </div>
    </div>
  );
});

AnalyticsChart.displayName = 'AnalyticsChart';
export default AnalyticsChart;
