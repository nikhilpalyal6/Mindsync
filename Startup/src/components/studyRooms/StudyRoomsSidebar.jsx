import React from 'react';
import { Compass, User, Calendar, CheckSquare, History, BarChart2, ChevronDown, Crown } from 'lucide-react';
import StudyStats from './StudyStats';
import { showToast } from '../Toast';

export default function StudyRoomsSidebar({ activeView, onViewChanged, isOpen, onClose }) {
  const menuItems = [
    { id: 'explore', label: 'Explore Rooms', icon: Compass, hasDropdown: true },
    { id: 'my-rooms', label: 'My Rooms', icon: User },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'goals', label: 'Goals', icon: CheckSquare },
    { id: 'history', label: 'History', icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 }
  ];

  return (
    <aside className={`study-rooms-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                onViewChanged(item.id);
                if (onClose) onClose();
              }}
            >
              <div className="sidebar-item-left">
                <span className="sidebar-icon">
                  <Icon size={18} />
                </span>
                <span>{item.label}</span>
              </div>
              {item.hasDropdown && isActive && <ChevronDown size={14} style={{ opacity: 0.6 }} />}
            </button>
          );
        })}
      </div>

      <StudyStats />

      <div className="premium-upgrade-box">
        <div className="premium-crown">
          <Crown size={22} fill="#f59e0b" stroke="#f59e0b" />
        </div>
        <h3>Go Premium</h3>
        <p>Unlock unlimited rooms, advanced insights, and AI study coach.</p>
        <button
          type="button"
          className="btn-upgrade"
          onClick={() => showToast('Premium subscription screen coming soon!', 'info')}
        >
          Upgrade Now
        </button>
      </div>
    </aside>
  );
}
