import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="admin-chart-tooltip">
        <p className="admin-chart-tooltip-label">{label}</p>
        <p className="admin-chart-tooltip-val">
          {payload[0].value} {payload[0].value === 1 ? 'user' : 'users'}
        </p>
      </div>
    );
  }
  return null;
};

export const ChartCard = React.memo(({ title, data, dataKey = 'users', categoryKey = 'date' }) => {
  return (
    <div className="admin-card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
      <h3 className="text-base font-semibold text-white mb-6" style={{ margin: '0 0 24px 0' }}>{title}</h3>
      <div className="flex-1 w-100" style={{ height: '280px' }}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis 
                dataKey={categoryKey} 
                stroke="#4b5563" 
                tickLine={false} 
                axisLine={false}
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="#4b5563" 
                tickLine={false} 
                axisLine={false}
                style={{ fontSize: '0.75rem' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1f2937', strokeWidth: 1.5 }} />
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke="#3b82f6" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#chartGradient)" 
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0b1220', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 font-medium" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
            No chart data available
          </div>
        )}
      </div>
    </div>
  );
});

ChartCard.displayName = 'ChartCard';
export default ChartCard;
