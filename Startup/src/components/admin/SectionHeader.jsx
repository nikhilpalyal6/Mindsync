import React, { useMemo } from 'react';

export const SectionHeader = React.memo(({ user }) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  return (
    <div className="admin-welcome-card" style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--admin-primary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {currentDate}
        </span>
        <h1 className="admin-welcome-title" style={{ marginTop: '4px' }}>
          {greeting}, {user?.name || 'Administrator'} 👋
        </h1>
        <p className="admin-welcome-subtitle">
          Welcome back to the MindSync Administration Console. Currently authenticated as <strong style={{ color: '#fff' }}>{user?.role || 'Admin'}</strong>.
        </p>
      </div>
    </div>
  );
});

SectionHeader.displayName = 'SectionHeader';
export default SectionHeader;
