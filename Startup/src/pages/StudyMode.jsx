import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Search, RefreshCw, MoreVertical, Pin, Trash2, Edit3, Copy, Archive, FileText, Video, BookOpen, Layers, HelpCircle, MessageSquare, Plus, Clock } from 'lucide-react'
import { 
  getStudySessions, 
  createStudySession, 
  updateStudySession, 
  deleteStudySession,
  getStudyActivities
} from '../services/api'
import './studyMode.css'
import VideoLearning from '../components/VideoLearning'

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

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

              <button className="card-dropdown-item disabled" disabled>
                <Copy size={12} />
                <span>Duplicate</span>
                <span className="disabled-badge">Phase 3.2+</span>
              </button>
              <button className="card-dropdown-item disabled" disabled>
                <Archive size={12} />
                <span>Archive</span>
                <span className="disabled-badge">Phase 3.2+</span>
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

// Main StudyMode Component
export default function StudyMode() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Navigation & Dropdown toggles
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  // Real Sessions & Activities State
  const [sessions, setSessions] = useState([])
  const [activities, setActivities] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Inline editing state for sidebar item
  const [editingSidebarId, setEditingSidebarId] = useState(null)
  const [sidebarTitleText, setSidebarTitleText] = useState('')

  // Active Workspace View Tab
  const [activeTab, setActiveTab] = useState('pdf')

  // Modals & Upload logic
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [learnQuery, setLearnQuery] = useState('')

  const fileInputRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const sidebarRef = useRef(null)

  // Load Sessions and Recent Activity
  const fetchSessionsAndActivities = useCallback(async (selectLastOpened = false) => {
    setLoading(true)
    setError(null)
    try {
      const [resSessions, resActivities] = await Promise.allSettled([
        getStudySessions(),
        getStudyActivities()
      ])

      const fetchedSessions = resSessions.status === 'fulfilled' ? (resSessions.value || []) : []
      setSessions(fetchedSessions)

      if (resActivities.status === 'fulfilled') {
        setActivities(resActivities.value || [])
      }

      if (selectLastOpened && fetchedSessions.length > 0) {
        const lastSessionId = localStorage.getItem('mindsync_last_study_session_id')
        if (lastSessionId) {
          const lastSess = fetchedSessions.find(s => s._id === lastSessionId)
          if (lastSess) {
            setActiveSession(lastSess)
            if (lastSess.metadata?.lastTab) {
              setActiveTab(lastSess.metadata.lastTab)
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load study sessions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessionsAndActivities(true)
  }, [fetchSessionsAndActivities])

  // Select session & persist last opened
  const selectSession = async (session) => {
    setActiveSession(session)
    localStorage.setItem('mindsync_last_study_session_id', session._id)
    if (session.metadata?.lastTab) {
      setActiveTab(session.metadata.lastTab)
    }

    try {
      await updateStudySession(session._id, { lastOpened: new Date() })
      const [resSessions, resActivities] = await Promise.all([
        getStudySessions(),
        getStudyActivities()
      ])
      setSessions(resSessions || [])
      setActivities(resActivities || [])
    } catch (err) {
      console.error('Failed to update last opened timestamp:', err)
    }
    setIsSidebarOpen(false)
  }

  // Optimistic Create Session
  const handleCreateSession = async (title = 'Untitled Study Workspace') => {
    try {
      const res = await createStudySession({ title })
      const newSession = res
      setSessions(prev => [newSession, ...prev])
      selectSession(newSession)
      fetchSessionsAndActivities(false)
    } catch (err) {
      console.error('Failed to create study workspace:', err)
    }
  }

  // Optimistic Rename Session
  const handleRenameSession = async (id, newTitle) => {
    if (!newTitle.trim()) return
    const trimmed = newTitle.trim()

    // Optimistic state update
    setSessions(prev => prev.map(s => s._id === id ? { ...s, title: trimmed } : s))
    if (activeSession?._id === id) {
      setActiveSession(prev => ({ ...prev, title: trimmed }))
    }
    setEditingSidebarId(null)

    try {
      await updateStudySession(id, { title: trimmed })
      const resActs = await getStudyActivities()
      setActivities(resActs || [])
    } catch (err) {
      console.error('Failed to rename study workspace:', err)
      fetchSessionsAndActivities(false)
    }
  }

  // Optimistic Delete Session
  const handleDeleteSession = async (id, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this study workspace?')) return

    setSessions(prev => prev.filter(s => s._id !== id))
    if (activeSession?._id === id) {
      setActiveSession(null)
      localStorage.removeItem('mindsync_last_study_session_id')
    }

    try {
      await deleteStudySession(id)
      const resActs = await getStudyActivities()
      setActivities(resActs || [])
    } catch (err) {
      console.error('Failed to delete study workspace:', err)
      fetchSessionsAndActivities(false)
    }
  }

  // Optimistic Pin/Unpin Toggle
  const handleTogglePinSession = async (session, e) => {
    if (e) e.stopPropagation()
    const updatedPinned = !session.pinned

    setSessions(prev => prev.map(s => s._id === session._id ? { ...s, pinned: updatedPinned } : s))
    if (activeSession?._id === session._id) {
      setActiveSession(prev => ({ ...prev, pinned: updatedPinned }))
    }

    try {
      await updateStudySession(session._id, { pinned: updatedPinned })
      const resActs = await getStudyActivities()
      setActivities(resActs || [])
    } catch (err) {
      console.error('Failed to toggle pin state:', err)
      fetchSessionsAndActivities(false)
    }
  }

  // Auto-save active tab state
  const handleTabChange = async (tabId) => {
    setActiveTab(tabId)
    if (activeSession) {
      try {
        const updatedMeta = { ...(activeSession.metadata || {}), lastTab: tabId }
        await updateStudySession(activeSession._id, { metadata: updatedMeta })
        setActiveSession(prev => ({ ...prev, metadata: updatedMeta }))
      } catch (err) {
        console.error('Failed to save tab metadata:', err)
      }
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
      const sessionTitle = file.name.replace(/\.pdf$/i, '') + ' Workspace'
      const res = await createStudySession({ 
        title: sessionTitle, 
        description: `PDF Document: ${file.name}`
      })
      const newSession = res
      setSessions(prev => [newSession, ...prev])
      selectSession(newSession)
    } catch (err) {
      console.error('Failed to auto-create workspace for PDF:', err)
    }

    navigate('/study/viewer', {
      state: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl
      }
    })
    e.target.value = ''
  }

  const handlePasteSubmit = async () => {
    if (pasteUrl || pasteText) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
      if (pasteUrl && youtubeRegex.test(pasteUrl)) {
        setVideoUrl(pasteUrl)
        setShowPasteModal(false)
        setPasteUrl('')
        setPasteText('')
        return
      }

      try {
        const sessionTitle = pasteUrl ? 'Web Link Study Workspace' : 'Lecture Notes Workspace'
        const description = pasteUrl ? `Web resources: ${pasteUrl}` : 'Pasted text content.'
        const res = await createStudySession({
          title: sessionTitle,
          description,
          metadata: { pasteUrl, pasteText: pasteText.substring(0, 100) }
        })
        const newSession = res
        setSessions(prev => [newSession, ...prev])
        selectSession(newSession)
      } catch (err) {
        console.error('Failed to create session for pasted content:', err)
      }

      setPasteUrl('')
      setPasteText('')
      setShowPasteModal(false)
    }
  }

  const handleLearnSubmit = (e) => {
    e.preventDefault()
    if (!learnQuery.trim()) return
    handleCreateSession(learnQuery.trim())
    setLearnQuery('')
  }

  const handleRecordSelect = (type) => {
    handleCreateSession(`Voice Lecture Workspace (${type})`)
    setShowRecordModal(false)
  }

  // Filtered Sessions Memo
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const regex = new RegExp(searchQuery, 'i')
    return sessions.filter(s => regex.test(s.title) || regex.test(s.description || ''))
  }, [sessions, searchQuery])

  // Separate Pinned Workspaces
  const pinnedWorkspaces = useMemo(() => {
    return filteredSessions.filter(s => s.pinned)
  }, [filteredSessions])

  // Group Non-Pinned Workspaces by History Categories (Today, Yesterday, This Week, Older)
  const groupedHistoryWorkspaces = useMemo(() => {
    const unpinned = filteredSessions.filter(s => !s.pinned)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterdayStart = todayStart - 86400000
    const weekStart = todayStart - (6 * 86400000)

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    }

    unpinned.forEach(s => {
      const openedTime = new Date(s.lastOpened || s.updatedAt || s.createdAt).getTime()
      if (openedTime >= todayStart) {
        groups.today.push(s)
      } else if (openedTime >= yesterdayStart) {
        groups.yesterday.push(s)
      } else if (openedTime >= weekStart) {
        groups.thisWeek.push(s)
      } else {
        groups.older.push(s)
      }
    })

    // Sort inside each group descending by lastOpened
    const sortByOpened = (a, b) => new Date(b.lastOpened || b.createdAt) - new Date(a.lastOpened || a.createdAt)
    groups.today.sort(sortByOpened)
    groups.yesterday.sort(sortByOpened)
    groups.thisWeek.sort(sortByOpened)
    groups.older.sort(sortByOpened)

    return groups
  }, [filteredSessions])

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
  const closeSidebar = () => setIsSidebarOpen(false)
  const toggleProfileDropdown = () => setShowProfileDropdown(!showProfileDropdown)
  const closeProfileDropdown = () => setShowProfileDropdown(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
    closeProfileDropdown()
  }

  const handleBackFromVideo = () => setVideoUrl('')

  // Event listener cleanups
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
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
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

  if (videoUrl) {
    return <VideoLearning videoUrl={videoUrl} onBack={handleBackFromVideo} />
  }

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
          <button className="add-content-btn" onClick={() => handleCreateSession('New Study Workspace')}>
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
                            onBlur={() => handleRenameSession(session._id, sidebarTitleText)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSession(session._id, sidebarTitleText)
                              if (e.key === 'Escape') setEditingSidebarId(null)
                            }}
                            autoFocus
                            className="admin-select"
                            style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                          />
                        ) : (
                          <button
                            className={`session-list-item ${activeSession?._id === session._id ? 'active' : ''}`}
                            onClick={() => selectSession(session)}
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
                                onClick={(e) => handleTogglePinSession(session, e)}
                                title="Unpin Workspace"
                              >
                                ⭐
                              </button>
                              <button 
                                className="session-action-btn delete"
                                onClick={(e) => handleDeleteSession(session._id, e)}
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
                          onBlur={() => handleRenameSession(session._id, sidebarTitleText)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSession(session._id, sidebarTitleText)
                            if (e.key === 'Escape') setEditingSidebarId(null)
                          }}
                          autoFocus
                          className="admin-select"
                          style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                        />
                      ) : (
                        <button
                          className={`session-list-item ${activeSession?._id === session._id ? 'active' : ''}`}
                          onClick={() => selectSession(session)}
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
                              onClick={(e) => handleTogglePinSession(session, e)}
                              title="Pin Workspace"
                            >
                              📌
                            </button>
                            <button 
                              className="session-action-btn delete"
                              onClick={(e) => handleDeleteSession(session._id, e)}
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
              {user?.profileImage ? (
                <img src={user.profileImage} alt={user.name || user.username} />
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

      {/* Main Workspace Layout */}
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

        {activeSession ? (
          /* Active Session Workspace */
          <div className="study-workspace-container">
            <div className="study-workspace-main">
              {/* Session Control Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setActiveSession(null)}
                    style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    ← All Workspaces
                  </button>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                    {activeSession.title}
                  </h2>
                  <button 
                    onClick={(e) => handleTogglePinSession(activeSession, e)}
                    style={{ fontSize: '1.1rem', cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    {activeSession.pinned ? '📌' : '⭐'}
                  </button>
                </div>

                {/* Workspace Content Tabs */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleTabChange('pdf')}
                    className={`workspace-tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                  >
                    📁 PDF
                  </button>
                  <button 
                    onClick={() => handleTabChange('youtube')}
                    className={`workspace-tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                  >
                    🎥 YouTube
                  </button>
                  <button 
                    onClick={() => handleTabChange('notes')}
                    className={`workspace-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                  >
                    📝 Notes
                  </button>
                </div>
              </div>

              {/* Workspace Content Panels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                {activeTab === 'pdf' && (
                  <div className="workspace-placeholder-box">
                    <FileText size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <h3>AI PDF Reader Placeholder</h3>
                    <p style={{ maxWidth: '420px', fontSize: '0.85rem' }}>
                      Upload educational PDFs to summarize chapters and generate key concepts with MindSync AI co-pilot in Phase 3.2+.
                    </p>
                    <button className="add-content-btn" onClick={handleUploadClick} style={{ maxWidth: '220px', marginTop: '12px' }}>
                      Upload Test PDF Document
                    </button>
                  </div>
                )}

                {activeTab === 'youtube' && (
                  <div className="workspace-placeholder-box">
                    <Video size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <h3>AI YouTube Learning Placeholder</h3>
                    <p style={{ maxWidth: '420px', fontSize: '0.85rem' }}>
                      Interactive video transcripts extraction and automated video checkpoints will be available in Phase 3.2+.
                    </p>
                    <button className="add-content-btn" onClick={() => setShowPasteModal(true)} style={{ maxWidth: '220px', marginTop: '12px' }}>
                      Paste YouTube Video Link
                    </button>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="workspace-placeholder-box">
                    <BookOpen size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <h3>AI Notes Workspace Placeholder</h3>
                    <p style={{ maxWidth: '420px', fontSize: '0.85rem' }}>
                      Rich markdown notes editor and automated concepts summaries will be available in Phase 3.2+.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Co-Pilot Panel */}
            <aside className="study-right-panel">
              <div>
                <h3 className="right-panel-title">MindSync AI Co-Pilot</h3>
                <p className="right-panel-desc">Interactive tools synced to your active workspace.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div className="locked-tool-card">
                  <span className="locked-tool-badge">Phase 3.2+</span>
                  <h4>AI Tutor Chat</h4>
                  <p>Ask questions and get explanations for complex subjects.</p>
                </div>
                <div className="locked-tool-card">
                  <span className="locked-tool-badge">Phase 3.2+</span>
                  <h4>Smart Flashcards</h4>
                  <p>Auto-generate study cards from your lecture documents.</p>
                </div>
                <div className="locked-tool-card">
                  <span className="locked-tool-badge">Phase 3.2+</span>
                  <h4>Interactive Quizzes</h4>
                  <p>Test your knowledge with multiple choice questions.</p>
                </div>
                <div className="locked-tool-card">
                  <span className="locked-tool-badge">Phase 3.2+</span>
                  <h4>Markdown Notes</h4>
                  <p>Save notes and export them to your personal workspace.</p>
                </div>
                <div className="locked-tool-card">
                  <span className="locked-tool-badge">Phase 3.2+</span>
                  <h4>Concept Summaries</h4>
                  <p>Compile chapters into quick 5-bullet summary cards.</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* Workspaces Main View */
          <div className="study-container">
            <section className="learn-section">
              <h1 className="learn-title">What do you want to learn?</h1>
              
              <div className="upload-methods">
                <button className="upload-card" onClick={handleUploadClick}>
                  <div className="upload-icon"><FileText size={24} /></div>
                  <h3>Upload</h3>
                  <p>File, audio, video</p>
                </button>

                <button className="upload-card" onClick={() => setShowPasteModal(true)}>
                  <div className="upload-icon"><Video size={24} /></div>
                  <h3>Paste</h3>
                  <p>YouTube, website, text</p>
                </button>

                <button className="upload-card" onClick={() => setShowRecordModal(true)}>
                  <div className="upload-icon"><BookOpen size={24} /></div>
                  <h3>Record</h3>
                  <p>Record class, video call</p>
                </button>
              </div>

              {uploadError && (
                <div className="upload-error-banner">
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError('')} aria-label="Dismiss error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              <form onSubmit={handleLearnSubmit} className="learn-input-wrapper">
                <input
                  type="text"
                  className="learn-input"
                  placeholder="Type anything you want to learn..."
                  value={learnQuery}
                  onChange={(e) => setLearnQuery(e.target.value)}
                />
                <button type="submit" className="learn-submit-btn" aria-label="Submit query">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </section>

            {/* Empty State vs Workspaces List */}
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
                  onClick={() => handleCreateSession('My First Study Workspace')}
                  style={{ maxWidth: '240px', background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.2), rgba(72, 239, 179, 0.2))' }}
                >
                  <Plus size={16} />
                  <span>Create Workspace</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '24px' }}>
                {/* Pinned Section */}
                {pinnedWorkspaces.length > 0 && (
                  <div className="history-group">
                    <div className="history-group-title">📌 Pinned Workspaces</div>
                    <div className="spaces-grid">
                      {pinnedWorkspaces.map(session => (
                        <WorkspaceCard
                          key={session._id}
                          session={session}
                          activeSessionId={activeSession?._id}
                          onSelect={selectSession}
                          onRename={handleRenameSession}
                          onTogglePin={handleTogglePinSession}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* History Grouped Workspaces (Today, Yesterday, This Week, Older) */}
                {groupedHistoryWorkspaces.today.length > 0 && (
                  <div className="history-group">
                    <div className="history-group-title">Today's Workspaces</div>
                    <div className="spaces-grid">
                      {groupedHistoryWorkspaces.today.map(session => (
                        <WorkspaceCard
                          key={session._id}
                          session={session}
                          activeSessionId={activeSession?._id}
                          onSelect={selectSession}
                          onRename={handleRenameSession}
                          onTogglePin={handleTogglePinSession}
                          onDelete={handleDeleteSession}
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
                          onSelect={selectSession}
                          onRename={handleRenameSession}
                          onTogglePin={handleTogglePinSession}
                          onDelete={handleDeleteSession}
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
                          onSelect={selectSession}
                          onRename={handleRenameSession}
                          onTogglePin={handleTogglePinSession}
                          onDelete={handleDeleteSession}
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
                          onSelect={selectSession}
                          onRename={handleRenameSession}
                          onTogglePin={handleTogglePinSession}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity Section */}
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
        )}
      </main>

      {/* File input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
      />

      {/* Paste Modal */}
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
              <button className="record-option" onClick={() => handleRecordSelect('microphone')}>
                <div className="record-option-icon"><BookOpen size={20} /></div>
                <div className="record-option-content">
                  <h3>Microphone</h3>
                  <p>Record your voice or class</p>
                </div>
              </button>

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
    </div>
  )
}
