import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Search, RefreshCw, MoreVertical, Pin, Trash2, Edit3, Copy, Archive, FileText, Video, BookOpen, Layers, HelpCircle, MessageSquare, Plus, Clock, Folder, Sparkles } from 'lucide-react'
import { 
  getStudySessions, 
  createStudySession, 
  updateStudySession, 
  deleteStudySession,
  getStudyActivities
} from '../services/api'
import './studyMode.css'
import VideoLearning from '../components/VideoLearning'
import ChatLayout from '../components/chat/ChatLayout'
import AISidebar from '../components/ai/AISidebar'
import PDFWorkspace from '../components/pdf/PDFWorkspace'
import PDFLearningPanel from '../components/pdf/PDFLearningPanel'
import NotesLearningPanel from '../components/notes/NotesLearningPanel'

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

  // Active Workspace View Tab (PDF, YouTube, Notes resource launcher)
  const [activeTab, setActiveTab] = useState('pdf')
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Modals & Upload logic
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [learnQuery, setLearnQuery] = useState('')

  // Create Workspace Modal States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState('')
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('')
  const [createModalError, setCreateModalError] = useState('')
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)

  const fileInputRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const sidebarRef = useRef(null)
  const isMountedRef = useRef(true)

  // Handle component mounting lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load Sessions and Recent Activity
  const fetchSessionsAndActivities = useCallback(async (selectLastOpened = false) => {
    if (isMountedRef.current) {
      setLoading(true)
      setError(null)
    }
    try {
      const [resSessions, resActivities] = await Promise.allSettled([
        getStudySessions(),
        getStudyActivities()
      ])

      if (!isMountedRef.current) return;

      const fetchedSessions = resSessions.status === 'fulfilled' ? (resSessions.value || []) : []
      setSessions(fetchedSessions)

      if (resActivities.status === 'fulfilled') {
        setActivities(resActivities.value || [])
      }

    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load study sessions.')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Always land on Study Mode Home page when entering Study Mode
  useEffect(() => {
    fetchSessionsAndActivities(false)
  }, [fetchSessionsAndActivities])

  // Select session & restore active resource state directly from MongoDB metadata
  const selectSession = async (session) => {
    setActiveSession(session)
    localStorage.setItem('mindsync_last_study_session_id', session._id)

    // Read metadata from MongoDB document
    const meta = session.metadata || {}
    const restoredResource = meta.activeResourceType || meta.lastTab || 'pdf'
    setActiveTab(restoredResource)

    if (meta.youtube?.videoUrl) {
      setVideoUrl(meta.youtube.videoUrl)
    } else {
      setVideoUrl('')
    }

    console.log(`[Persistent Workspace] Workshop Opened from Home: ${session.title}`)
    console.log(`[Persistent Workspace] Resource Restored from MongoDB: ${restoredResource.toUpperCase()}`)

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

  // Open Create Workspace Modal
  const handleOpenCreateModal = (defaultTitle = '') => {
    setNewWorkspaceTitle(defaultTitle)
    setNewWorkspaceDesc('')
    setCreateModalError('')
    setShowCreateModal(true)
  }

  // Submit Create Workspace Modal Form
  const handleCreateWorkspaceSubmit = async (e) => {
    if (e) e.preventDefault()
    const title = newWorkspaceTitle.trim()
    const description = newWorkspaceDesc.trim()

    if (!title) {
      setCreateModalError('Workspace name is required.')
      return
    }

    if (title.length > 100) {
      setCreateModalError('Workspace name cannot exceed 100 characters.')
      return
    }

    // Client-side duplicate check
    const isDuplicate = sessions.some(s => s.title.toLowerCase() === title.toLowerCase())
    if (isDuplicate) {
      setCreateModalError('A workspace with this name already exists. Please choose a different name.')
      return
    }

    setCreatingWorkspace(true)
    setCreateModalError('')

    try {
      const res = await createStudySession({ title, description })
      const newSession = res
      setSessions(prev => [newSession, ...prev])
      selectSession(newSession)
      fetchSessionsAndActivities(false)
      setShowCreateModal(false)
      setNewWorkspaceTitle('')
      setNewWorkspaceDesc('')
    } catch (err) {
      setCreateModalError(err.message || 'Failed to create study workspace. Please try again.')
    } finally {
      setCreatingWorkspace(false)
    }
  }

  // Create Session helper for auto-uploads / records
  const handleCreateSession = async (title = 'Untitled Study Workspace', description = '') => {
    try {
      const res = await createStudySession({ title, description })
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

  // Active Resource Manager: Switch active resource ('pdf' | 'youtube' | 'notes')
  const handleTabChange = async (tabId) => {
    const resourceType = tabId.toLowerCase()
    setActiveTab(resourceType)

    if (resourceType === 'youtube') {
      const savedVideoUrl = activeSession?.metadata?.youtube?.videoUrl || activeSession?.metadata?.videoUrl || ''
      if (savedVideoUrl) {
        setVideoUrl(savedVideoUrl)
      }
    }

    console.log(`[Active Resource Manager] Active Resource Changed: ${resourceType.toUpperCase()}`)

    // Dispatch internal event for Future Context Builders & AI co-pilots
    if (activeSession) {
      window.dispatchEvent(new CustomEvent('activeResourceChanged', {
        detail: {
          sessionId: activeSession._id,
          activeResourceType: resourceType,
          timestamp: new Date().toISOString()
        }
      }))

      try {
        const updatedMeta = { 
          ...(activeSession.metadata || {}), 
          activeResourceType: resourceType,
          lastTab: resourceType,
          lastOpened: new Date()
        }
        await updateStudySession(activeSession._id, { metadata: updatedMeta })
        setActiveSession(prev => ({ ...prev, metadata: updatedMeta }))
      } catch (err) {
        console.error('Failed to update active resource metadata:', err)
      }
    }
  }

  const handleSelectResource = async (resource) => {
    try {
      const updatedMeta = {
        ...(activeSession.metadata || {}),
        activeResourceType: resource.type,
        lastTab: resource.type,
        lastOpened: new Date().toISOString()
      }

      if (resource.type === 'pdf') {
        updatedMeta.pdf = resource.data
        setActiveTab('pdf')
      } else if (resource.type === 'youtube') {
        updatedMeta.youtube = resource.data
        setVideoUrl(resource.url)
        setActiveTab('youtube')
      } else if (resource.type === 'notes') {
        updatedMeta.notes = resource.data
        setActiveTab('notes')
      }

      setActiveSession(prev => ({
        ...prev,
        metadata: updatedMeta
      }))

      const res = await updateStudySession(activeSession._id, { metadata: updatedMeta })
      setActiveSession(res)
      setSessions(prev => prev.map(s => s._id === res._id ? res : s))
    } catch (err) {
      console.error('Failed to switch resource:', err)
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
      setActiveTab('notes')
    } catch (err) {
      console.error('Failed to create new note resource:', err)
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
            fileData: fileUrl, // placeholder local DataUrl, PDFWorkspace will extract & save
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
        setActiveTab('pdf');
      } else {
        const sessionTitle = file.name.replace(/\.pdf$/i, '') + ' Workspace'
        const res = await createStudySession({ 
          title: sessionTitle, 
          description: `PDF Document: ${file.name}`,
          metadata: {
            pdf: {
              filename: file.name,
              pdfFilename: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileData: fileUrl,
              lastOpened: new Date().toISOString()
            }
          }
        })
        const newSession = res
        setSessions(prev => [newSession, ...prev])
        selectSession(newSession)
        
        navigate('/study/viewer', {
          state: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl
          }
        })
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
            setActiveTab('youtube')
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
          setActiveTab('notes')
        } catch (err) {
          console.error('Failed to save note resource:', err)
        }
      } else {
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
      }

      setPasteUrl('')
      setPasteText('')
      setShowPasteModal(false)
    }
  }

  const handleLearnSubmit = (e) => {
    e.preventDefault()
    if (!learnQuery.trim()) return
    handleOpenCreateModal(learnQuery.trim())
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

  // Live Dashboard Statistics
  const totalWorkspaces = useMemo(() => sessions.length, [sessions])
  const totalNotes = useMemo(() => sessions.reduce((acc, s) => acc + (s.notesCount || 0), 0), [sessions])
  const totalPDFs = useMemo(() => sessions.reduce((acc, s) => acc + (s.pdfCount || 0), 0), [sessions])
  const totalChats = useMemo(() => sessions.reduce((acc, s) => acc + (s.chatCount || 0), 0), [sessions])

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

  const handleSwitchFromVideo = async (targetResource) => {
    await handleTabChange(targetResource)
  }

  if (videoUrl && activeTab === 'youtube') {
    return <VideoLearning videoUrl={videoUrl} session={activeSession} onBack={handleBackFromVideo} onSwitchTab={handleSwitchFromVideo} />
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
          <div className="study-workspace-container" style={{ display: 'flex', width: '100%', gap: '16px', flex: 1, minHeight: 0 }}>
            {/* Resources Navigation Sidebar */}
            <aside className="resources-sidebar" style={{
              width: '240px',
              backgroundColor: 'rgba(15, 18, 26, 0.5)',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              gap: '16px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: 0 }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                  Resources
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {/* PDFs Group */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📄 PDFs
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(activeSession.resources || []).filter(r => r.type === 'pdf').map(res => {
                        const isActive = activeTab === 'pdf' && (activeSession.metadata?.pdf?.pdfFilename === res.url || activeSession.metadata?.pdf?.filename === res.url);
                        return (
                          <button
                            key={res.url}
                            onClick={() => handleSelectResource(res)}
                            style={{
                              background: isActive ? 'rgba(102, 184, 255, 0.12)' : 'none',
                              border: 'none',
                              color: isActive ? '#66b8ff' : 'rgba(255, 255, 255, 0.65)',
                              textAlign: 'left',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: isActive ? 600 : 500,
                              cursor: 'pointer',
                              width: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; } }}
                            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>📄</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</span>
                          </button>
                        );
                      })}
                      {(activeSession.resources || []).filter(r => r.type === 'pdf').length === 0 && (
                        <span style={{ fontSize: '0.775rem', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', paddingLeft: '8px' }}>No PDFs</span>
                      )}
                    </div>
                  </div>

                  {/* Videos Group */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ▶ Videos
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(activeSession.resources || []).filter(r => r.type === 'youtube').map(res => {
                        const isActive = activeTab === 'youtube' && videoUrl === res.url;
                        return (
                          <button
                            key={res.url}
                            onClick={() => handleSelectResource(res)}
                            style={{
                              background: isActive ? 'rgba(102, 184, 255, 0.12)' : 'none',
                              border: 'none',
                              color: isActive ? '#66b8ff' : 'rgba(255, 255, 255, 0.65)',
                              textAlign: 'left',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: isActive ? 600 : 500,
                              cursor: 'pointer',
                              width: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; } }}
                            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>🎥</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</span>
                          </button>
                        );
                      })}
                      {(activeSession.resources || []).filter(r => r.type === 'youtube').length === 0 && (
                        <span style={{ fontSize: '0.775rem', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', paddingLeft: '8px' }}>No Videos</span>
                      )}
                    </div>
                  </div>

                  {/* Notes Group */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📝 Notes
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(activeSession.resources || []).filter(r => r.type === 'notes').map(res => {
                        const isActive = activeTab === 'notes' && activeSession.metadata?.notes?.noteId === res.url;
                        return (
                          <button
                            key={res.url}
                            onClick={() => handleSelectResource(res)}
                            style={{
                              background: isActive ? 'rgba(102, 184, 255, 0.12)' : 'none',
                              border: 'none',
                              color: isActive ? '#66b8ff' : 'rgba(255, 255, 255, 0.65)',
                              textAlign: 'left',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: isActive ? 600 : 500,
                              cursor: 'pointer',
                              width: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; } }}
                            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>📝</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</span>
                          </button>
                        );
                      })}
                      {(activeSession.resources || []).filter(r => r.type === 'notes').length === 0 && (
                        <span style={{ fontSize: '0.775rem', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', paddingLeft: '8px' }}>No Notes</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Resource Button & Dropdown Options */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  style={{
                    backgroundColor: 'rgba(167, 139, 250, 0.12)',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    borderRadius: '6px',
                    color: '#a78bfa',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%'
                  }}
                >
                  + Add Resource
                </button>
                {showAddMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '44px',
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(20, 25, 35, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '4px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => {
                        handleUploadClick();
                        setShowAddMenu(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.8)',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      📄 Add PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowPasteModal(true);
                        setShowAddMenu(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.8)',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      ▶ Add YouTube
                    </button>
                    <button
                      onClick={() => {
                        handleAddNotes();
                        setShowAddMenu(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.8)',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      📝 Add Notes
                    </button>
                  </div>
                )}
              </div>
            </aside>

            <div className="study-workspace-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Flat Notion-style Workspace Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                paddingBottom: '10px',
                marginBottom: '4px',
                width: '100%',
                flexShrink: 0
              }}>
                {/* Left Section: Back button and Workspace Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    onClick={() => setActiveSession(null)}
                    style={{ 
                      fontSize: '0.8rem', 
                      color: 'rgba(255,255,255,0.6)', 
                      padding: '5px 10px', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      fontWeight: 500
                    }}
                  >
                    ← Back
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      {activeSession.title}
                    </h2>
                    <button 
                      onClick={(e) => handleTogglePinSession(activeSession, e)}
                      style={{ fontSize: '1rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    >
                      {activeSession.pinned ? '📌' : '⭐'}
                    </button>
                  </div>
                </div>

                {/* Right Section: Workspace Resource Tabs */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleTabChange('pdf')}
                    className={`workspace-tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '0.775rem' }}
                  >
                    📁 PDF
                  </button>
                  <button 
                    onClick={() => handleTabChange('youtube')}
                    className={`workspace-tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '0.775rem' }}
                  >
                    🎥 YouTube
                  </button>
                  <button 
                    onClick={() => handleTabChange('notes')}
                    className={`workspace-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '0.775rem' }}
                  >
                    📝 Notes
                  </button>
                </div>
              </div>

              {/* Workspace Content Panels */}
              <div className="study-workspace-panels-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
                {activeTab === 'pdf' && (
                  <PDFWorkspace session={activeSession} />
                )}

                {activeTab === 'youtube' && (
                  videoUrl ? (
                    <VideoLearning 
                      videoUrl={videoUrl} 
                      session={activeSession} 
                      onBack={() => setVideoUrl('')} 
                      onSwitchTab={handleTabChange} 
                    />
                  ) : (
                    <div className="workspace-placeholder-box">
                      <Video size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <h3>AI YouTube Learning Workspace</h3>
                      <p style={{ maxWidth: '420px', fontSize: '0.85rem' }}>
                        Paste any YouTube educational video URL to load interactive transcripts, chapters, and video AI co-pilot.
                      </p>
                      <button className="add-content-btn" onClick={() => setShowPasteModal(true)} style={{ maxWidth: '220px', marginTop: '12px' }}>
                        Paste YouTube Video Link
                      </button>
                    </div>
                  )
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

            {/* Right Panel: Dedicated Resource AI Workspace Panels (PDF & Notes) vs General Overview */}
            {activeTab === 'pdf' ? (
              <aside className="study-right-panel" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent' }}>
                <PDFLearningPanel session={activeSession} />
              </aside>
            ) : activeTab === 'notes' ? (
              <aside className="study-right-panel" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent' }}>
                <NotesLearningPanel session={activeSession} />
              </aside>
            ) : (
              <aside className="study-right-panel">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Sparkles size={14} style={{ color: '#66b8ff' }} />
                    <h3 className="right-panel-title">Learning Features</h3>
                  </div>
                  <p className="right-panel-desc">Workspace co-pilot modules and interactive learning tools.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, marginTop: '6px' }}>
                <div className="learning-feature-card active">
                  <div className="feature-card-header">
                    <div className="feature-icon active"><MessageSquare size={14} /></div>
                    <div className="feature-info">
                      <h4>AI Tutor Chat</h4>
                      <p>Active inside YouTube, PDF, & Notes viewers</p>
                    </div>
                    <span className="feature-badge active">Active AI</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><Layers size={14} /></div>
                    <div className="feature-info">
                      <h4>Smart Flashcards</h4>
                      <p>Auto-generate study cards from lectures</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><HelpCircle size={14} /></div>
                    <div className="feature-info">
                      <h4>Interactive Quizzes</h4>
                      <p>Test knowledge with practice questions</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><Clock size={14} /></div>
                    <div className="feature-info">
                      <h4>Audio Podcast</h4>
                      <p>Convert notes to audio summaries</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><Video size={14} /></div>
                    <div className="feature-info">
                      <h4>Video Checkpoints</h4>
                      <p>Interactive timestamps & chapters</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><BookOpen size={14} /></div>
                    <div className="feature-info">
                      <h4>Concept Mind Map</h4>
                      <p>Visual subject connection trees</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="learning-feature-card locked">
                  <div className="feature-card-header">
                    <div className="feature-icon"><Search size={14} /></div>
                    <div className="feature-info">
                      <h4>Deep Search</h4>
                      <p>Cross-workspace semantic search</p>
                    </div>
                    <span className="feature-badge">Coming Soon</span>
                  </div>
                </div>
              </div>
            </aside>
          )}
          </div>
        ) : (
          /* Workspaces Main Management Dashboard View */
          <div className="study-container">
            {/* Notion / Linear / Cursor Style Hero Section */}
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

            {/* Quick Live Statistics Row */}
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

            {/* Workspaces List Anchor */}
            <div id="workspaces-list-section"></div>

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
                  onClick={() => handleOpenCreateModal('My First Study Workspace')}
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
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'right' }}>
                    {newWorkspaceTitle.length} / 100
                  </span>
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
