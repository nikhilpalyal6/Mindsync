import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Search, RefreshCw, MoreVertical, Pin, Trash2, Edit3, Copy, Archive, FileText, Video, BookOpen, Layers, HelpCircle, MessageSquare, Plus, Clock, Folder, Sparkles } from 'lucide-react'
import { 
  getStudySessions, 
  getStudySessionById,
  createStudySession, 
  updateStudySession, 
  deleteStudySession,
  getStudyActivities
} from '../services/api'
import './studyMode.css'
import './studyWorkspaceRedesign.css'
import StudyWorkspaceLayout from '../components/study/StudyWorkspaceLayout'
import { 
  useWorkspaceState, 
  useTabState, 
  useResourceState, 
  useViewerState, 
  useUploadState, 
  useSearchState, 
  useFilterState 
} from '../hooks/useStudyWorkspace'

// Memoized Workspace Card Subcomponent with Context Menu and Count Chips
const WorkspaceCard = React.memo(({ 
  session, 
  activeSessionId, 
  onSelect, 
  onRename, 
  onTogglePin, 
  onDelete 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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

  const isSelected = activeSessionId === session._id;

  return (
    <div 
      className={`enhanced-workspace-card ${session.pinned ? 'pinned' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => !isEditing && onSelect(session)}
    >
      <div className="card-header-row">
        <div className="card-title-area">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="admin-select"
              style={{ fontSize: '0.9rem', padding: '4px 8px', width: '100%' }}
            />
          ) : (
            <h3 
              className="card-title-text" 
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              title="Double-click to rename"
            >
              {session.pinned && <span style={{ marginRight: '6px' }}>📌</span>}
              {session.title}
            </h3>
          )}
          {session.description && (
            <p className="card-desc-text">{session.description}</p>
          )}
        </div>

        {/* Action Context Menu */}
        <div className="card-menu-wrapper" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button 
            className="card-menu-btn" 
            onClick={() => setShowMenu(!showMenu)} 
            aria-label="Workspace Options"
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div className="card-dropdown-menu">
              <button className="card-dropdown-item" onClick={() => { setShowMenu(false); setIsEditing(true); }}>
                <Edit3 size={12} />
                <span>Rename</span>
              </button>
              <button className="card-dropdown-item" onClick={(e) => { setShowMenu(false); onTogglePin(session, e); }}>
                <Pin size={12} />
                <span>{session.pinned ? 'Unpin' : 'Pin'}</span>
              </button>
              <button className="card-dropdown-item delete" onClick={(e) => { setShowMenu(false); onDelete(session._id, e); }}>
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dates Row */}
      <div className="card-dates-row">
        <span>Created: {new Date(session.createdAt || Date.now()).toLocaleDateString()}</span>
        <span>Opened: {new Date(session.lastOpened || session.updatedAt || Date.now()).toLocaleDateString()}</span>
      </div>

      {/* Placeholder Count Chips */}
      <div className="card-counts-grid">
        <div className="count-chip" title="PDF Documents">
          <FileText size={10} /> <span>{session.pdfCount || 0}</span>
        </div>
        <div className="count-chip" title="YouTube Videos">
          <Video size={10} /> <span>{session.youtubeCount || 0}</span>
        </div>
        <div className="count-chip" title="Notes">
          <BookOpen size={10} /> <span>{session.notesCount || 0}</span>
        </div>
        <div className="count-chip" title="Flashcards">
          <Layers size={10} /> <span>{session.flashcardsCount || 0}</span>
        </div>
        <div className="count-chip" title="Quizzes">
          <HelpCircle size={10} /> <span>{session.quizCount || 0}</span>
        </div>
        <div className="count-chip" title="AI Chats">
          <MessageSquare size={10} /> <span>{session.chatCount || 0}</span>
        </div>
      </div>
    </div>
  );
});
WorkspaceCard.displayName = 'WorkspaceCard';

export default function StudyMode() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Navigation & Dropdown toggles
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  // Centralized React State hooks
  const workspaceState = useWorkspaceState()
  const {
    sessions,
    activities,
    activeSession,
    loading,
    error,
    setActiveSession,
    setSessions,
    setActivities,
    fetchSessionsAndActivities,
    selectSession,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    togglePinWorkspace
  } = workspaceState

  const tabState = useTabState('overview')
  const { activeTab, setActiveTab } = tabState

  const resourceState = useResourceState(activeSession, setActiveSession, setSessions)
  const { handleSelectResource } = resourceState

  const viewerState = useViewerState()
  const { setVideoUrl } = viewerState

  const uploadState = useUploadState()
  const {
    showPasteModal,
    setShowPasteModal,
    showRecordModal,
    setShowRecordModal,
    showCreateModal,
    setShowCreateModal,
    pasteUrl,
    setPasteUrl,
    pasteText,
    setPasteText,
    uploadError,
    setUploadError,
    creatingWorkspace,
    setCreatingWorkspace
  } = uploadState

  const searchState = useSearchState(sessions)
  const { searchQuery, setSearchQuery, filteredSessions, pinnedWorkspaces, groupedHistoryWorkspaces } = searchState

  const filterState = useFilterState()

  // Inline editing state for sidebar items on the Selector Dashboard
  const [editingSidebarId, setEditingSidebarId] = useState(null)
  const [sidebarTitleText, setSidebarTitleText] = useState('')
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState('')
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('')
  const [createModalError, setCreateModalError] = useState('')

  const fileInputRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const sidebarRef = useRef(null)

  const handleOpenCreateModal = (defaultTitle = '') => {
    setNewWorkspaceTitle(defaultTitle)
    setNewWorkspaceDesc('')
    setCreateModalError('')
    setShowCreateModal(true)
  }

  const handleCreateWorkspaceSubmit = async (e) => {
    if (e) e.preventDefault()
    const title = newWorkspaceTitle.trim()
    const description = newWorkspaceDesc.trim()

    if (!title) {
      setCreateModalError('Workspace name is required.')
      return
    }

    const isDuplicate = sessions.some(s => s.title.toLowerCase() === title.toLowerCase())
    if (isDuplicate) {
      setCreateModalError('A workspace with this name already exists.')
      return
    }

    setCreatingWorkspace(true)
    setCreateModalError('')

    try {
      const res = await createWorkspace(title, description)
      setShowCreateModal(false)
      selectSession(res, (restored) => setActiveTab(restored))
    } catch (err) {
      setCreateModalError(err.message || 'Failed to create study workspace.')
    } finally {
      setCreatingWorkspace(false)
    }
  }

  // PDF File Upload handler
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Please select a file smaller than 100 MB.')
      e.target.value = ''
      return
    }

    const fileUrl = URL.createObjectURL(file)
    setUploadError('')

    try {
      if (activeSession) {
        const updatedMeta = {
          ...(activeSession.metadata || {}),
          pdf: {
            filename: file.name,
            pdfFilename: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileData: fileUrl,
            lastOpened: new Date().toISOString()
          },
          activeResourceType: 'pdf',
          lastTab: 'pdf'
        };

        const res = await updateStudySession(activeSession._id, {
          metadata: updatedMeta
        });
        setActiveSession(res);
        setSessions(prev => prev.map(s => s._id === res._id ? res : s));
        setActiveTab('pdf_viewer');
      } else {
        const sessionTitle = file.name.replace(/\.pdf$/i, '') + ' Workspace'
        const res = await createWorkspace(sessionTitle, `PDF Document: ${file.name}`)
        
        // Add PDF to metadata
        const updatedMeta = {
          pdf: {
            filename: file.name,
            pdfFilename: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileData: fileUrl,
            lastOpened: new Date().toISOString()
          }
        };
        const updatedSession = await updateStudySession(res._id, { metadata: updatedMeta });
        selectSession(updatedSession, () => setActiveTab('pdf_viewer'));
      }
    } catch (err) {
      console.error('Failed to auto-create workspace for PDF:', err)
    }
    e.target.value = ''
  }

  const handlePasteSubmit = async () => {
    if (pasteUrl || pasteText) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
      if (pasteUrl && youtubeRegex.test(pasteUrl)) {
        setVideoUrl(pasteUrl)
        setShowPasteModal(false)

        if (activeSession) {
          try {
            const updatedMeta = {
              ...(activeSession.metadata || {}),
              youtube: { videoUrl: pasteUrl, lastOpened: new Date().toISOString() },
              activeResourceType: 'youtube',
              lastTab: 'youtube'
            }
            const res = await updateStudySession(activeSession._id, {
              metadata: updatedMeta
            })
            setActiveSession(res)
            setSessions(prev => prev.map(s => s._id === res._id ? res : s))
            setActiveTab('video_viewer')
          } catch (err) {
            console.error('Failed to save YouTube metadata to MongoDB:', err)
          }
        }
        setPasteUrl('')
        setPasteText('')
        return
      }

      if (activeSession) {
        try {
          const noteTitle = pasteUrl ? 'Web Link Notes' : 'Lecture Notes';
          const updatedMeta = {
            ...(activeSession.metadata || {}),
            notes: {
              noteId: `note_${Date.now()}`,
              title: noteTitle,
              content: pasteText || pasteUrl || '',
              lastOpened: new Date().toISOString()
            },
            activeResourceType: 'notes',
            lastTab: 'notes'
          }

          const res = await updateStudySession(activeSession._id, {
            metadata: updatedMeta
          })
          setActiveSession(res)
          setSessions(prev => prev.map(s => s._id === res._id ? res : s))
          setActiveTab('notes_viewer')
        } catch (err) {
          console.error('Failed to save note resource:', err)
        }
      } else {
        try {
          const sessionTitle = pasteUrl ? 'Web Link Study Workspace' : 'Lecture Notes Workspace'
          const description = pasteUrl ? `Web resources: ${pasteUrl}` : 'Pasted text content.'
          const res = await createWorkspace(sessionTitle, description)
          selectSession(res, () => setActiveTab('overview'))
        } catch (err) {
          console.error('Failed to create session for pasted content:', err)
        }
      }

      setPasteUrl('')
      setPasteText('')
      setShowPasteModal(false)
    }
  }

  const handleAddNotes = async () => {
    try {
      const noteTitle = window.prompt("Enter Note Title:", "My Revision Notes") || "My Notes"
      const noteId = `note_${Date.now()}`
      
      const updatedMeta = {
        ...(activeSession.metadata || {}),
        notes: {
          noteId,
          title: noteTitle,
          content: '',
          lastOpened: new Date().toISOString()
        },
        activeResourceType: 'notes',
        lastTab: 'notes'
      }

      const res = await updateStudySession(activeSession._id, {
        metadata: updatedMeta
      })

      setActiveSession(res)
      setSessions(prev => prev.map(s => s._id === res._id ? res : s))
      setActiveTab('notes_viewer')
    } catch (err) {
      console.error('Failed to create new note resource:', err)
    }
  }

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
  const closeSidebar = () => setIsSidebarOpen(false)
  const toggleProfileDropdown = () => setShowProfileDropdown(!showProfileDropdown)
  const closeProfileDropdown = () => setShowProfileDropdown(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
    closeProfileDropdown()
  }

  // Sidebar click listeners
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (!event.target.closest('.hamburger-menu-btn')) {
          setIsSidebarOpen(false)
        }
      }
    }
    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSidebarOpen])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
    }
    if (showProfileDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  // Fix page layout shift issues
  useEffect(() => {
    document.body.classList.add('study-mode-active');
    return () => {
      document.body.classList.remove('study-mode-active');
    };
  }, []);

  // If a workspace is active, render the permanent, highly advanced StudyWorkspaceLayout
  if (activeSession) {
    return (
      <StudyWorkspaceLayout 
        session={activeSession}
        onBack={() => setActiveSession(null)}
        onSessionUpdate={(updatedSession) => {
          setActiveSession(updatedSession);
          setSessions(prev => prev.map(s => s._id === updatedSession._id ? updatedSession : s));
        }}
        onUploadPdfClick={handleUploadClick}
        onAddVideoClick={() => setShowPasteModal(true)}
        onAddNotesClick={handleAddNotes}
        onFileChange={handleFileChange}
        tabState={tabState}
        resourceState={resourceState}
        viewerState={viewerState}
        filterState={filterState}
      />
    );
  }

  // Otherwise, render the Global Dashboard Selector View
  const totalWorkspaces = sessions.length
  const totalNotes = sessions.reduce((acc, s) => acc + (s.notesCount || 0), 0)
  const totalPDFs = sessions.reduce((acc, s) => acc + (s.pdfCount || 0), 0)
  const totalChats = sessions.reduce((acc, s) => acc + (s.chatCount || 0), 0)

  return (
    <div className="study-mode-page">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      {/* Left Sidebar */}
      <aside className={`study-sidebar ${isSidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
        <div className="sidebar-top">
          <button className="sidebar-close-btn" onClick={closeSidebar} aria-label="Close sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Brand */}
          <div className="sidebar-brand">
            <Link to="/" className="brand-link" onClick={closeSidebar}>
              <div className="brand-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="brand-text">
                <span className="brand-mind">Mind</span>
                <span className="brand-sync">Sync</span>
              </span>
            </Link>
          </div>

          {/* Create Session Button */}
          <button className="add-content-btn" onClick={() => handleOpenCreateModal()}>
            <Plus size={16} />
            <span>Create Workspace</span>
          </button>

          {/* Search Bar */}
          <div className="sidebar-search-container">
            <Search size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Middle Section */}
        <div className="sidebar-scrollable">
          {loading && sessions.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', padding: '12px 0' }}>
              Loading workspaces...
            </div>
          ) : error ? (
            <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</span>
              <button 
                onClick={() => fetchSessionsAndActivities()}
                style={{ fontSize: '0.75rem', color: '#66b8ff', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={10} /> Retry
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', padding: '12px 0', lineHeight: '1.4' }}>
              No study workspaces yet. Create your first workspace above!
            </div>
          ) : (
            <>
              {/* Pinned Workspaces */}
              {pinnedWorkspaces.length > 0 && (
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">Pinned</h3>
                  <div className="sidebar-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pinnedWorkspaces.map((session) => (
                      <div key={session._id} style={{ position: 'relative' }}>
                        {editingSidebarId === session._id ? (
                          <input
                            type="text"
                            value={sidebarTitleText}
                            onChange={(e) => setSidebarTitleText(e.target.value)}
                            onBlur={() => { renameWorkspace(session._id, sidebarTitleText); setEditingSidebarId(null); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { renameWorkspace(session._id, sidebarTitleText); setEditingSidebarId(null); }
                              if (e.key === 'Escape') setEditingSidebarId(null)
                            }}
                            autoFocus
                            className="admin-select"
                            style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                          />
                        ) : (
                          <button
                            className="session-list-item"
                            onClick={() => selectSession(session, () => setActiveTab('overview'))}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                              📌 {session.title}
                            </span>
                            <div className="session-item-actions">
                              <button 
                                className="session-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingSidebarId(session._id)
                                  setSidebarTitleText(session.title)
                                }}
                                title="Rename Workspace"
                              >
                                ✏️
                              </button>
                              <button 
                                className="session-action-btn"
                                onClick={(e) => { e.stopPropagation(); togglePinWorkspace(session); }}
                                title="Unpin Workspace"
                              >
                                ⭐
                              </button>
                              <button 
                                className="session-action-btn delete"
                                onClick={(e) => { e.stopPropagation(); deleteWorkspace(session._id); }}
                                title="Delete Workspace"
                              >
                                🗑️
                              </button>
                            </div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sidebar Workspaces Feed */}
              <div className="sidebar-section">
                <h3 className="sidebar-section-title">All Workspaces</h3>
                <div className="sidebar-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredSessions.filter(s => !s.pinned).map((session) => (
                    <div key={session._id} style={{ position: 'relative' }}>
                      {editingSidebarId === session._id ? (
                        <input
                          type="text"
                          value={sidebarTitleText}
                          onChange={(e) => setSidebarTitleText(e.target.value)}
                          onBlur={() => { renameWorkspace(session._id, sidebarTitleText); setEditingSidebarId(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { renameWorkspace(session._id, sidebarTitleText); setEditingSidebarId(null); }
                            if (e.key === 'Escape') setEditingSidebarId(null)
                          }}
                          autoFocus
                          className="admin-select"
                          style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                        />
                      ) : (
                        <button
                          className="session-list-item"
                          onClick={() => selectSession(session, () => setActiveTab('overview'))}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', fontWeight: 600 }}>
                              {session.title}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                              Opened: {new Date(session.lastOpened || session.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="session-item-actions">
                            <button 
                              className="session-action-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                  setEditingSidebarId(session._id)
                                  setSidebarTitleText(session.title)
                              }}
                              title="Rename Workspace"
                            >
                              ✏️
                            </button>
                            <button 
                              className="session-action-btn"
                              onClick={(e) => { e.stopPropagation(); togglePinWorkspace(session); }}
                              title="Pin Workspace"
                            >
                              📌
                            </button>
                            <button 
                              className="session-action-btn delete"
                              onClick={(e) => { e.stopPropagation(); deleteWorkspace(session._id); }}
                              title="Delete Workspace"
                            >
                              🗑️
                            </button>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Profile Dropdown */}
        <div className="sidebar-footer" ref={profileDropdownRef}>
          <div className="plan-badge">Free Plan</div>
          <button 
            className="user-profile-section" 
            onClick={toggleProfileDropdown}
            aria-expanded={showProfileDropdown}
          >
            <div className="user-avatar">
              {user?.profileImage || user?.avatar ? (
                <img src={user.profileImage || user.avatar} alt={user.name || user.username} />
              ) : (
                <span>{(user?.name || user?.username || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || user?.username || 'Your Profile'}</span>
              <span className="user-email">{user?.email || 'No email'}</span>
            </div>
          </button>

          {showProfileDropdown && (
            <div className="profile-dropdown" role="menu">
              <button className="dropdown-item" onClick={() => { navigate('/profile'); closeProfileDropdown(); }}>
                <span>Profile</span>
              </button>
              <button className="dropdown-item" onClick={() => { navigate('/settings'); closeProfileDropdown(); }}>
                <span>Settings</span>
              </button>
              <div className="dropdown-divider"></div>
              <button className="dropdown-item logout-item" onClick={handleLogout}>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Selector Dashboard Layout */}
      <main className="study-main">
        {/* Header */}
        <header className="study-header">
          <div className="study-header-left">
            <button className="hamburger-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="study-logo">
              <img src="/logo.png" alt="MindSync" />
            </Link>
          </div>
          <button className="upgrade-btn">
            <span>Upgrade</span>
          </button>
        </header>

        {/* Dashboard Workspaces Selection panel */}
        <div className="study-container">
          <section className="dashboard-hero-section">
            <div className="hero-content">
              <h1 className="hero-greeting-title">
                {getGreeting()}, {user?.name || user?.username || 'Scholar'}
              </h1>
              <p className="hero-greeting-subtitle">
                Continue where you left off or launch a new study workspace to manage your subjects, notes, and AI co-pilots.
              </p>

              <div className="hero-action-buttons">
                <button 
                  className="add-content-btn hero-primary-btn" 
                  onClick={() => handleOpenCreateModal()}
                >
                  <Plus size={16} />
                  <span>New Workspace</span>
                </button>

                <button 
                  className="admin-btn admin-btn-secondary hero-secondary-btn" 
                  onClick={() => {
                    const el = document.getElementById('workspaces-list-section')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <BookOpen size={15} />
                  <span>Browse Workspaces</span>
                </button>
              </div>
            </div>
          </section>

          {/* Statistics Grid */}
          <div className="dashboard-stats-grid">
            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Total Workspaces</span>
                <div className="stat-card-icon blue"><Folder size={16} /></div>
              </div>
              <div className="stat-card-value">{totalWorkspaces}</div>
              <span className="stat-card-subtitle">{pinnedWorkspaces.length} Pinned Workspaces</span>
            </div>

            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Notes Created</span>
                <div className="stat-card-icon green"><BookOpen size={16} /></div>
              </div>
              <div className="stat-card-value">{totalNotes}</div>
              <span className="stat-card-subtitle">Organized in Workspaces</span>
            </div>

            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">PDF Documents</span>
                <div className="stat-card-icon purple"><FileText size={16} /></div>
              </div>
              <div className="stat-card-value">{totalPDFs}</div>
              <span className="stat-card-subtitle">Uploaded PDF Files</span>
            </div>

            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">AI Conversations</span>
                <div className="stat-card-icon cyan"><MessageSquare size={16} /></div>
              </div>
              <div className="stat-card-value">{totalChats}</div>
              <span className="stat-card-subtitle">AI Co-Pilot Exchanges</span>
            </div>
          </div>

          <div id="workspaces-list-section"></div>

          {/* List of sessions */}
          {sessions.length === 0 && !loading ? (
            <div className="empty-workspace-container">
              <div className="empty-workspace-icon">
                <BookOpen size={28} />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
                  No Study Workspaces Yet
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                  Create your first Study Workspace to begin organizing your subjects and notes.
                </p>
              </div>
              <button 
                className="add-content-btn" 
                onClick={() => handleOpenCreateModal('My First Study Workspace')}
                style={{ maxWidth: '240px', background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.2), rgba(72, 239, 179, 0.2))' }}
              >
                <Plus size={16} />
                <span>Create Workspace</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '24px' }}>
              {pinnedWorkspaces.length > 0 && (
                <div className="history-group">
                  <div className="history-group-title">📌 Pinned Workspaces</div>
                  <div className="spaces-grid">
                    {pinnedWorkspaces.map(session => (
                      <WorkspaceCard
                        key={session._id}
                        session={session}
                        activeSessionId={activeSession?._id}
                        onSelect={(session) => selectSession(session, () => setActiveTab('overview'))}
                        onRename={renameWorkspace}
                        onTogglePin={togglePinWorkspace}
                        onDelete={deleteWorkspace}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedHistoryWorkspaces.today.length > 0 && (
                <div className="history-group">
                  <div className="history-group-title">Today's Workspaces</div>
                  <div className="spaces-grid">
                    {groupedHistoryWorkspaces.today.map(session => (
                      <WorkspaceCard
                        key={session._id}
                        session={session}
                        activeSessionId={activeSession?._id}
                        onSelect={(session) => selectSession(session, () => setActiveTab('overview'))}
                        onRename={renameWorkspace}
                        onTogglePin={togglePinWorkspace}
                        onDelete={deleteWorkspace}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedHistoryWorkspaces.yesterday.length > 0 && (
                <div className="history-group">
                  <div className="history-group-title">Yesterday</div>
                  <div className="spaces-grid">
                    {groupedHistoryWorkspaces.yesterday.map(session => (
                      <WorkspaceCard
                        key={session._id}
                        session={session}
                        activeSessionId={activeSession?._id}
                        onSelect={(session) => selectSession(session, () => setActiveTab('overview'))}
                        onRename={renameWorkspace}
                        onTogglePin={togglePinWorkspace}
                        onDelete={deleteWorkspace}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedHistoryWorkspaces.thisWeek.length > 0 && (
                <div className="history-group">
                  <div className="history-group-title">This Week</div>
                  <div className="spaces-grid">
                    {groupedHistoryWorkspaces.thisWeek.map(session => (
                      <WorkspaceCard
                        key={session._id}
                        session={session}
                        activeSessionId={activeSession?._id}
                        onSelect={(session) => selectSession(session, () => setActiveTab('overview'))}
                        onRename={renameWorkspace}
                        onTogglePin={togglePinWorkspace}
                        onDelete={deleteWorkspace}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedHistoryWorkspaces.older.length > 0 && (
                <div className="history-group">
                  <div className="history-group-title">Older</div>
                  <div className="spaces-grid">
                    {groupedHistoryWorkspaces.older.map(session => (
                      <WorkspaceCard
                        key={session._id}
                        session={session}
                        activeSessionId={activeSession?._id}
                        onSelect={(session) => selectSession(session, () => setActiveTab('overview'))}
                        onRename={renameWorkspace}
                        onTogglePin={togglePinWorkspace}
                        onDelete={deleteWorkspace}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Timeline on Selector Page */}
              <div className="activity-feed-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <Clock size={16} style={{ color: '#66b8ff' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                    Recent Study Activity
                  </h3>
                </div>

                {activities.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>
                    No recent activity recorded yet.
                  </div>
                ) : (
                  <div className="activity-feed-list">
                    {activities.slice(0, 8).map((act, i) => (
                      <div key={act._id || i} className="activity-feed-item">
                        <span className={`activity-dot ${act.action}`} />
                        <span style={{ fontWeight: 600, color: '#fff' }}>{act.details || act.action}</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden file selector input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
      />

      {/* Paste URL / Text Modal */}
      {showPasteModal && (
        <div className="modal-overlay" onClick={() => setShowPasteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon"><Video size={18} /></div>
                <h2 className="modal-title">YouTube, Website, Etc</h2>
              </div>
              <button className="modal-close" onClick={() => setShowPasteModal(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="paste-url-section">
                <p className="modal-instruction">Enter a YouTube Link / Playlist, Website URL, Doc, ArXiv, Etc</p>
                <input
                  type="url"
                  className="modal-input"
                  placeholder="https://youtu.be/dQw4w9WgXcQ"
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                />
              </div>

              <div className="modal-divider"><span>or</span></div>

              <div className="paste-text-section">
                <div className="paste-text-header">
                  <div className="modal-icon"><FileText size={18} /></div>
                  <h3 className="paste-text-title">Paste Text</h3>
                </div>
                <p className="modal-instruction">Copy and paste text to add as content</p>
                <textarea
                  className="modal-textarea"
                  placeholder="Paste your notes here"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows="6"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={() => setShowPasteModal(false)}>
                Cancel
              </button>
              <button 
                className="modal-btn add-btn" 
                onClick={handlePasteSubmit} 
                disabled={!pasteUrl && !pasteText}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Modal */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal-content record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Select Audio Type</h2>
              <button className="modal-close" onClick={() => setShowRecordModal(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body record-modal-body">
              <button className="record-option" onClick={() => handleRecordSelect('browser-tab')}>
                <div className="record-option-icon"><Video size={20} /></div>
                <div className="record-option-content">
                  <h3>Browser Tab</h3>
                  <p>Capture audio playing in a browser tab</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon"><Plus size={18} /></div>
                <h2 className="modal-title">Create Study Workspace</h2>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateWorkspaceSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {createModalError && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {createModalError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                    Workspace Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Organic Chemistry, Quantum Physics..."
                    value={newWorkspaceTitle}
                    onChange={(e) => {
                      setNewWorkspaceTitle(e.target.value)
                      if (createModalError) setCreateModalError('')
                    }}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    className="modal-textarea"
                    placeholder="Brief notes or summary about this workspace..."
                    value={newWorkspaceDesc}
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-btn cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="modal-btn add-btn" 
                  disabled={!newWorkspaceTitle.trim() || creatingWorkspace}
                >
                  {creatingWorkspace ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
