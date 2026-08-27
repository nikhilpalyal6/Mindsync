import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Cpu, 
  BellRing, 
  FileSpreadsheet, 
  Sliders, 
  Terminal, 
  ChevronLeft, 
  ChevronRight, 
  LogOut,
  Video
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const AdminSidebar = ({ collapsed, onCollapseToggle, mobileOpen }) => {
  const { user, signOut } = useAuth();

  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/ai', label: 'AI Monitor', icon: Cpu },
    { path: '/admin/notifications', label: 'Notifications', icon: BellRing },
    { path: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
    { path: '/admin/study-rooms', label: 'Study Rooms', icon: Video },
    { path: '/admin/settings', label: 'Settings', icon: Sliders },
    { path: '/admin/system-logs', label: 'System Logs', icon: Terminal },
  ];

  const adminInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'A';

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="admin-sidebar-header">
        <NavLink to="/admin" className="admin-logo-area">
          <div className="admin-logo-dot"></div>
          {!collapsed && <span className="admin-logo-text">MindSync Admin</span>}
        </NavLink>
      </div>

      <nav className="admin-nav admin-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <Icon className="admin-nav-item-icon" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        {!collapsed && (
          <div className="admin-profile-section">
            <div className="admin-avatar">
              {adminInitials}
            </div>
            <div className="admin-profile-info">
              <span className="admin-profile-name">{user?.name || 'Admin'}</span>
              <span className="admin-profile-role">{user?.role || 'Administrator'}</span>
            </div>
          </div>
        )}

        <button 
          onClick={onCollapseToggle} 
          className="admin-sidebar-toggle-btn"
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
