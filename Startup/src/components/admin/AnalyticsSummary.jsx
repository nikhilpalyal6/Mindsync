import React from 'react';

export const AnalyticsSummary = React.memo(({ browserData, osData, deviceData }) => {
  const renderList = (title, items) => (
    <div className="admin-card" style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items && items.length > 0 ? (
          items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#9ca3af', fontWeight: 500 }}>{item.name}</span>
              <span style={{ color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
                {item.count ? item.count.toLocaleString() : '0'}
              </span>
            </div>
          ))
        ) : (
          <span style={{ color: 'var(--admin-text-disabled)', fontSize: '0.85rem' }}>No data available</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
      {renderList('Browser Ratios', browserData)}
      {renderList('Operating System Ratios', osData)}
      
      {/* Device Ratios */}
      <div className="admin-card" style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="text-base font-semibold text-white" style={{ margin: 0 }}>Device Percentages</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {deviceData && deviceData.length > 0 ? (
            deviceData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: '#9ca3af', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{item.percentage}% ({item.count})</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
                  <div style={{ 
                    width: `${item.percentage}%`, 
                    height: '100%', 
                    backgroundColor: 'var(--admin-primary)',
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }}></div>
                </div>
              </div>
            ))
          ) : (
            <span style={{ color: 'var(--admin-text-disabled)', fontSize: '0.85rem' }}>No data available</span>
          )}
        </div>
      </div>
    </div>
  );
});

AnalyticsSummary.displayName = 'AnalyticsSummary';
export default AnalyticsSummary;
