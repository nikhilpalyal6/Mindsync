import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './studyMode.css'
import VideoLearning from '../components/VideoLearning'

export default function StudyMode() {
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showAddContentMenu, setShowAddContentMenu] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const [uploadError, setUploadError] = useState('')
  const sidebarRef = useRef(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

  const handleFileChange = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    const file = files[0]
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Please select a file smaller than 100 MB.')
      e.target.value = ''
      return
    }

    const fileUrl = URL.createObjectURL(file)
    setUploadError('')
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

  const handlePasteSubmit = () => {
    if (pasteUrl || pasteText) {
      console.log('Paste submitted:', { url: pasteUrl, text: pasteText })
      
      // Check if it's a YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
      if (pasteUrl && youtubeRegex.test(pasteUrl)) {
        setVideoUrl(pasteUrl)
        setShowPasteModal(false)
        setPasteUrl('')
        setPasteText('')
        return
      }
      
      // Handle other paste logic here
      setPasteUrl('')
      setPasteText('')
      setShowPasteModal(false)
    }
  }

  const handleRecordSelect = (type) => {
    console.log('Recording type selected:', type)
    // Handle recording logic here
    setShowRecordModal(false)
  }

  const handleSpaceClick = (spaceName) => {
    if (spaceName === 'Create Space') {
      console.log('Create new space')
      // Handle create space logic
    } else {
      console.log('Open space:', spaceName)
      // Handle open space logic
    }
  }

  const handleRecentClick = (recentItem) => {
    console.log('Open recent:', recentItem)
    // Handle open recent item logic
  }

  const handleAddContent = () => {
    setShowAddContentMenu(true)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  const handleBackFromVideo = () => {
    setVideoUrl('')
  }

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        // Check if click is not on hamburger button
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

  // If video URL is set, show the VideoLearning component
  if (videoUrl) {
    return <VideoLearning videoUrl={videoUrl} onBack={handleBackFromVideo} />
  }

  return (
    <div className="study-mode-page">
      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}
      <aside className={`study-sidebar ${isSidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
        {/* Fixed Top Section */}
        <div className="sidebar-top">
          {/* Close Button */}
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

          {/* Add Content Button */}
          <button className="add-content-btn" onClick={handleAddContent}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add content</span>
          </button>

          {/* Search */}
          <button className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span>Search</span>
          </button>
        </div>

        {/* Scrollable Middle Section */}
        <div className="sidebar-scrollable">
          {/* History/Recents Section */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">History</h3>
            <div className="sidebar-section-content">
              <button 
                className="sidebar-item"
                onClick={() => { handleRecentClick('React Tutorial'); closeSidebar(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>React Tutorial for Beginner...</span>
              </button>
              <button 
                className="sidebar-item"
                onClick={() => { handleRecentClick('Sorting Tutorial'); closeSidebar(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Sorting - Part 1 | Selection ...</span>
              </button>
              <button 
                className="sidebar-item"
                onClick={() => { handleRecentClick('React JS Full Course'); closeSidebar(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>React JS 19 Full Course in ...</span>
              </button>
            </div>
          </div>

          {/* Spaces Section */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Spaces</h3>
            <div className="sidebar-section-content">
              <button 
                className="sidebar-item"
                onClick={() => { handleSpaceClick('Create Space'); closeSidebar(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create Space</span>
              </button>
              <button 
                className="sidebar-item"
                onClick={() => { handleSpaceClick("Nikhil's Space"); closeSidebar(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <span>Nikhil's Space</span>
              </button>
            </div>
          </div>

          {/* Help & Tools Section */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Help & Tools</h3>
            <div className="sidebar-section-content">
              <button className="sidebar-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-6 0v4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
                <span>Feedback</span>
              </button>
              <button className="sidebar-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Quick Guide</span>
                <span className="notification-dot"></span>
              </button>
              <button className="sidebar-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <rect x="6" y="5" width="4" height="2" rx="0.5" />
                  <circle cx="17" cy="8" r="1" fill="currentColor" />
                </svg>
                <span>Chrome Extension</span>
              </button>
              <button className="sidebar-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>Discord Server</span>
              </button>
              <button className="sidebar-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Invite & Earn</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Section - Profile */}
        <div className="sidebar-footer">
          <div className="plan-badge">Free Plan</div>
          <div className="user-profile-card">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="user-name">Nikhil Palyal</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron-icon">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="study-main">
        {/* Add Content Menu */}
        {showAddContentMenu && (
          <div className="add-content-menu">
            <div className="add-content-menu-overlay" onClick={() => setShowAddContentMenu(false)}></div>
            <div className="add-content-menu-content">
              <button className="add-content-option" onClick={() => { setShowAddContentMenu(false); handleUploadClick(); }}>
                <div className="add-content-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <h4>Upload</h4>
                  <p>File, audio, video</p>
                </div>
              </button>
              <button className="add-content-option" onClick={() => { setShowAddContentMenu(false); setShowPasteModal(true); }}>
                <div className="add-content-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <div>
                  <h4>Paste</h4>
                  <p>YouTube, website, text</p>
                </div>
              </button>
              <button className="add-content-option" onClick={() => { setShowAddContentMenu(false); setShowRecordModal(true); }}>
                <div className="add-content-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <div>
                  <h4>Record</h4>
                  <p>Record class, video call</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Header with Hamburger, Logo and Upgrade button */}
        <header className="study-header">
          <div className="study-header-left">
            <button 
              className="hamburger-menu-btn"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
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
        <div className="study-container">
          {/* What do you want to learn section */}
          <section className="learn-section">
            <h1 className="learn-title">What do you want to learn?</h1>
            
            <div className="upload-methods">
              <button className="upload-card" onClick={handleUploadClick}>
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3>Upload</h3>
                <p>File, audio, video</p>
              </button>

              <button className="upload-card" onClick={() => setShowPasteModal(true)}>
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <h3>Paste</h3>
                <p>YouTube, website, text</p>
              </button>

              <button className="upload-card" onClick={() => setShowRecordModal(true)}>
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
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

            <div className="learn-input-wrapper">
              <input
                type="text"
                className="learn-input"
                placeholder="Learn anything"
              />
              <button className="learn-submit-btn" aria-label="Submit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </section>

          {/* My Spaces Section */}
          <section className="spaces-section">
            <div className="section-header">
              <h2 className="section-title">My Spaces</h2>
              <div className="sort-dropdown">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="clock-icon">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Newest</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
            <div className="spaces-grid">
              <button 
                className="space-card create-space"
                onClick={() => handleSpaceClick('Create Space')}
              >
                <div className="space-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span>Create Space</span>
              </button>
              <button 
                className="space-card"
                onClick={() => handleSpaceClick("Nikhil's Space")}
              >
                <div className="space-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <div className="space-info">
                  <span className="space-name">Nikhil's Space</span>
                  <span className="space-content">0 content</span>
                </div>
              </button>
            </div>
          </section>

          {/* Recents Section */}
          <section className="recents-section">
            <div className="section-header">
              <h2 className="section-title">Recents</h2>
              <button className="view-all-btn">View all</button>
            </div>
            <div className="recents-grid">
              <button 
                className="recent-card"
                onClick={() => handleRecentClick('React Tutorial')}
              >
                <div className="recent-thumbnail">
                  <div className="thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="recent-info">
                  <h3 className="recent-title">React Tutorial for Beginners (...</h3>
                  <p className="recent-time">3 months ago</p>
                </div>
              </button>
              <button 
                className="recent-card"
                onClick={() => handleRecentClick('Sorting Tutorial')}
              >
                <div className="recent-thumbnail">
                  <div className="thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="recent-info">
                  <h3 className="recent-title">Sorting - Part 1 | Selection So...</h3>
                  <p className="recent-time">3 months ago</p>
                </div>
              </button>
              <button 
                className="recent-card"
                onClick={() => handleRecentClick('React JS Full Course')}
              >
                <div className="recent-thumbnail">
                  <div className="thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="recent-info">
                  <h3 className="recent-title">React JS 19 Full Course in Hi...</h3>
                  <p className="recent-time">3 months ago</p>
                </div>
              </button>
        </div>
      </section>
        </div>
    </main>

      {/* Hidden file input */}
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
                <div className="modal-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <h2 className="modal-title">YouTube, Website, Etc</h2>
              </div>
              <button 
                className="modal-close"
                onClick={() => setShowPasteModal(false)}
                aria-label="Close"
              >
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

              <div className="modal-divider">
                <span>or</span>
              </div>

              <div className="paste-text-section">
                <div className="paste-text-header">
                  <div className="modal-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </div>
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
              <button 
                className="modal-btn cancel-btn"
                onClick={() => setShowPasteModal(false)}
              >
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
              <button 
                className="modal-close"
                onClick={() => setShowRecordModal(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body record-modal-body">
              <button 
                className="record-option"
                onClick={() => handleRecordSelect('microphone')}
              >
                <div className="record-option-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <div className="record-option-content">
                  <h3>Microphone</h3>
                  <p>Record your voice or class</p>
                </div>
              </button>

              <button 
                className="record-option"
                onClick={() => handleRecordSelect('browser-tab')}
              >
                <div className="record-option-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <rect x="6" y="5" width="4" height="2" rx="0.5" />
                  </svg>
                </div>
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
