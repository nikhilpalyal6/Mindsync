import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import AdminTopNavbar from './AdminTopNavbar';
import LoadingSkeleton from './LoadingSkeleton';
import './admin.css';

export const AdminLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Handle automatic collapsing on mid-size screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center" style={{ backgroundColor: '#0b1220', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Double check authorization on layout mount
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return <Navigate to="/study" replace />;
  }

  return (
    <div className="admin-container">
      {/* Mobile Drawer Overlay */}
      <div 
        className={`admin-overlay ${mobileSidebarOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      ></div>

      <AdminSidebar 
        collapsed={sidebarCollapsed} 
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
      />

      <div className="admin-main-wrapper">
        <AdminTopNavbar onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        
        <main className="admin-content">
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="skeleton-shimmer" style={{ width: '40%', height: '32px', borderRadius: '6px', marginBottom: '8px' }}></div>
              <div className="admin-stats-grid">
                <LoadingSkeleton type="stats" />
                <LoadingSkeleton type="stats" />
                <LoadingSkeleton type="stats" />
                <LoadingSkeleton type="stats" />
              </div>
              <div className="admin-dashboard-layout-grid">
                <LoadingSkeleton type="chart" />
                <LoadingSkeleton type="list" />
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
