import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export const PieChartCard = React.memo(({ title, data, innerRadius = 0, height = 300 }) => {
  const COLORS = ['#3b82f6', '#10b981', '#a78bfa', '#f59e0b', '#ef4444', '#6b7280'];

  const hasData = data && data.some(item => item.count > 0);

  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '380px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>{title}</h3>
      
      <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={innerRadius}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0c1221', 
                  border: '1px solid var(--admin-border)', 
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }} 
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconSize={10} 
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', color: 'var(--admin-text-muted)' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: 'var(--admin-text-disabled)', fontSize: '0.85rem' }}>
            No chart metrics available
          </div>
        )}
      </div>
    </div>
  );
});

PieChartCard.displayName = 'PieChartCard';
export default PieChartCard;
