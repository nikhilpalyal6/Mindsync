import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export const LineChartCard = React.memo(({ title, data, dataKey, xKey = 'date', color = '#3b82f6', height = 300 }) => {
  return (
    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '380px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>{title}</h3>
      
      <div style={{ width: '100%', height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" opacity={0.3} />
            <XAxis 
              dataKey={xKey} 
              stroke="var(--admin-text-muted)" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="var(--admin-text-muted)" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false} 
              allowDecimals={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0c1221', 
                border: '1px solid var(--admin-border)', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px'
              }} 
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              dot={{ r: 3, strokeWidth: 1 }} 
              activeDot={{ r: 5 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

LineChartCard.displayName = 'LineChartCard';
export default LineChartCard;
