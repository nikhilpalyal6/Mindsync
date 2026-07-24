import React from 'react';

export const StatCardSkeleton = () => (
  <div className="admin-card">
    <div className="admin-card-header">
      <div className="skeleton-title skeleton-shimmer"></div>
      <div className="skeleton-avatar skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '8px' }}></div>
    </div>
    <div className="skeleton-value skeleton-shimmer"></div>
    <div className="skeleton-text skeleton-shimmer" style={{ width: '60%', height: '12px' }}></div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="admin-card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
    <div className="skeleton-title skeleton-shimmer" style={{ width: '30%', height: '18px', marginBottom: '24px' }}></div>
    <div className="flex-1 skeleton-shimmer" style={{ borderRadius: '8px', opacity: 0.3 }}></div>
  </div>
);

export const ListSkeleton = () => (
  <div className="admin-card" style={{ minHeight: '380px' }}>
    <div className="skeleton-title skeleton-shimmer" style={{ width: '40%', height: '18px', marginBottom: '24px' }}></div>
    <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4" style={{ display: 'flex', gap: '16px' }}>
          <div className="skeleton-avatar skeleton-shimmer" style={{ width: '36px', height: '36px', flexShrink: 0 }}></div>
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ width: '30%', height: '14px', borderRadius: '4px', marginBottom: '6px' }}></div>
            <div className="skeleton-shimmer" style={{ width: '60%', height: '12px', borderRadius: '4px' }}></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="admin-card">
    <div className="skeleton-title skeleton-shimmer" style={{ width: '25%', height: '20px', marginBottom: '24px' }}></div>
    <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-shimmer" style={{ height: '48px', borderRadius: '8px', opacity: 0.5 }}></div>
      ))}
    </div>
  </div>
);

export const LoadingSkeleton = ({ type = 'stats' }) => {
  switch (type) {
    case 'stats':
      return <StatCardSkeleton />;
    case 'chart':
      return <ChartSkeleton />;
    case 'list':
      return <ListSkeleton />;
    case 'table':
      return <TableSkeleton />;
    default:
      return <StatCardSkeleton />;
  }
};

export default LoadingSkeleton;
