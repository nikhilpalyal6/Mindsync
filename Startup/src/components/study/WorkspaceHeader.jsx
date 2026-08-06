import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Edit3, Bell, Settings, LogOut, Pin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const WorkspaceHeader = React.memo(({ 
  session, 
  onRename, 
  onTogglePin,
  isAiOpen,
  onToggleAi,
  activeResource
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (session) {
      setEditTitle(session.title);
    }
  }, [session]);

  useEffect(() => {
    if (user) {
      console.log('[WorkspaceHeader] Profile paths loaded:', user.profileImage, user.avatar);
    }
  }, [user]);

  // Handle outside click to close user dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAvatarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save rename
  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(session._id, editTitle.trim());
    } else {
      setEditTitle(session.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveRename();
    if (e.key === 'Escape') {
      setEditTitle(session.title);
      setIsEditing(false);
    }
  };

  if (!session) return null;

  return (
    <div className="sw-center-header">
      <div className="workspace-title-row">
        
        {/* Left Side: Workspace Title + Edit + AI context indicator */}
        <div className="workspace-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="workspace-title-icon" style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent-purple-glow)',
            color: 'var(--accent-purple)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: '1px solid rgba(159, 122, 234, 0.2)'
          }}>
            {session.title.charAt(0).toUpperCase()}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--accent-blue)',
                  color: '#fff',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  outline: 'none'
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="workspace-title-text" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {session.title}
                </h2>
                <button 
                  onClick={() => setIsEditing(true)} 
                  style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Rename Workspace"
                >
                  <Edit3 size={13} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Edit</span>
                </button>
              </div>
            )}
          </div>

          {activeResource && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--glass-border)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginLeft: '12px'
            }}>
              <span style={{ opacity: 0.6 }}>Currently Using:</span>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff' }}>
                {activeResource.type === 'pdf' ? '📄 PDF AI' : activeResource.type === 'youtube' ? '▶ YouTube AI' : '✏ Notes AI'}
              </strong>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action Toolbar */}
        <div className="workspace-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          
          {/* Ask AI toggle button */}
          <button 
            onClick={onToggleAi}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: isAiOpen ? 'var(--accent-purple)' : 'rgba(255,255,255,0.02)', 
              color: isAiOpen ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={isAiOpen ? 'Hide AI Assistant' : 'Show AI Assistant'}
          >
            <Sparkles size={13} style={{ color: isAiOpen ? '#fff' : 'var(--accent-purple)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Ask AI</span>
          </button>

          {/* User Avatar with Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue-glow)',
                border: '1px solid var(--glass-border)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                overflow: 'hidden',
                padding: 0
              }}
              title="User Account"
            >
              {user?.profileImage || user?.avatar ? (
                <img 
                  src={user.profileImage || user.avatar} 
                  alt={user.name || user.username || 'User'} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    display: 'block',
                    borderRadius: '50%'
                  }} 
                />
              ) : (
                <span>{(user?.name || user?.username || 'U').charAt(0).toUpperCase()}</span>
              )}
            </button>

            {showAvatarDropdown && (
              <div 
                style={{
                  position: 'absolute',
                  top: '36px',
                  right: 0,
                  backgroundColor: '#141923',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '140px'
                }}
              >
                <button
                  onClick={() => { setShowAvatarDropdown(false); navigate('/profile'); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.85)',
                    padding: '8px 12px',
                    fontSize: '0.775rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Profile
                </button>
                <button
                  onClick={() => { setShowAvatarDropdown(false); navigate('/settings'); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.85)',
                    padding: '8px 12px',
                    fontSize: '0.775rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Settings
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--glass-border)', margin: '4px 0' }} />
                <button
                  onClick={async () => {
                    setShowAvatarDropdown(false);
                    await signOut();
                    navigate('/login');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    padding: '8px 12px',
                    fontSize: '0.775rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
});

WorkspaceHeader.displayName = 'WorkspaceHeader';
export default WorkspaceHeader;
