import React from 'react';

export default function StudyRoomLoading() {
  return (
    <div className="study-room-workspace-wrapper skeleton">
      <header className="study-room-workspace-header">
        <div className="skeleton-shimmer" style={{ width: '120px', height: '36px', borderRadius: '6px' }} />
        <div className="skeleton-shimmer" style={{ width: '200px', height: '24px', borderRadius: '4px' }} />
      </header>

      <main className="study-room-workspace-content">
        <div className="workspace-main-row">
          {/* Main Grid Skeleton */}
          <div className="workspace-left-section">
            <div className="workspace-participant-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="participant-workspace-card skeleton">
                  <div className="camera-feed-placeholder skeleton">
                    <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="participant-card-footer" style={{ border: 'none' }}>
                    <div className="skeleton-shimmer" style={{ width: '100px', height: '16px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Skeletons */}
          <div className="workspace-right-sidebar">
            <div className="workspace-focus-timer-card skeleton">
              <div className="skeleton-shimmer" style={{ width: '60%', height: '18px', borderRadius: '4px', margin: '12px auto' }} />
              <div className="skeleton-shimmer" style={{ width: '120px', height: '48px', borderRadius: '8px', margin: '20px auto' }} />
            </div>

            <div className="workspace-goals-card skeleton">
              <div className="skeleton-shimmer" style={{ width: '80%', height: '20px', borderRadius: '4px', marginBottom: '12px' }} />
              <div className="skeleton-shimmer" style={{ width: '100%', height: '40px', borderRadius: '6px' }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
