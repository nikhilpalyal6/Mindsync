import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiLogOut, FiUser, FiSettings, FiMenu } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

export const AdminTopNavbar = ({ onMenuToggle }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const adminInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'A';

  return (
    <header className="admin-navbar">
      <div className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={onMenuToggle}
          className="admin-mobile-toggle admin-nav-action-btn"
          aria-label="Toggle Menu"
        >
          <FiMenu className="w-5 h-5" />
        </button>
        
        <div className="admin-search-container">
          <FiSearch className="admin-search-icon" />
          <input 
            type="text" 
            placeholder="Search console..." 
            className="admin-search-input"
            disabled
            title="Search backend not configured"
          />
          <kbd className="admin-search-kbd">⌘K</kbd>
        </div>
      </div>

      <div className="admin-navbar-actions">
        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notificationsRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="admin-nav-action-btn"
            aria-label="View Notifications"
          >
            <FiBell className="w-5 h-5" />
            {/* Displaying no badge because there are no notifications */}
          </button>
          
          {isNotificationsOpen && (
            <div className="admin-dropdown-menu" style={{ width: '280px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Notifications</span>
                <span style={{ fontSize: '0.75rem', color: '#3b82f6', cursor: 'default' }}>0 New</span>
              </div>
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#4b5563' }}>
                <FiBell style={{ width: '24px', height: '24px', margin: '0 auto 8px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.8rem' }}>No notifications available</p>
              </div>
            </div>
          )}
        </div>

        <div className="admin-nav-divider"></div>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="admin-nav-action-btn"
            style={{ padding: '2px', borderRadius: '50%' }}
            aria-label="Admin settings dropdown"
          >
            <div className="admin-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
              {adminInitials}
            </div>
          </button>

          {isProfileOpen && (
            <div className="admin-dropdown-menu">
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #1f2937', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'Administrator'}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </p>
              </div>

              <Link to="/profile" className="admin-dropdown-item">
                <FiUser className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
              
              <Link to="/settings" className="admin-dropdown-item">
                <FiSettings className="w-4 h-4" />
                <span>My Settings</span>
              </Link>

              <div style={{ height: '1px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>

              <button onClick={handleLogout} className="admin-dropdown-item danger">
                <FiLogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminTopNavbar;
