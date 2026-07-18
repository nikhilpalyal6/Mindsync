import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './studyViewer.css'

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${mb.toFixed(1)} MB`
}

export default function StudyViewer() {
  const location = useLocation()
  const navigate = useNavigate()
  const fileData = location.state

  useEffect(() => {
    return () => {
      if (fileData?.fileUrl) {
        URL.revokeObjectURL(fileData.fileUrl)
      }
    }
  }, [fileData])

  if (!fileData?.fileUrl) {
    return (
      <div className="study-viewer-page empty-state">
        <div className="empty-card">
          <h1>No content loaded</h1>
          <p>Upload a PDF from Study Mode to view it with AI tools.</p>
          <button className="primary-btn" onClick={() => navigate('/study')}>
            Back to Study Mode
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="study-viewer-page">
      <header className="viewer-header">
        <div className="viewer-brand">
          <button className="back-button" onClick={() => navigate('/study')} aria-label="Back to Study Mode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="viewer-title-group">
            <span className="viewer-subtitle">PDF Workspace</span>
            <h1 className="viewer-title">{fileData.fileName || 'Untitled.pdf'}</h1>
          </div>
        </div>
        <div className="viewer-actions">
          <span className="file-size">{formatFileSize(fileData.fileSize)}</span>
          <button className="ghost-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Tools
          </button>
          <button className="ghost-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 0 0-12 0v4a6 6 0 0 0 12 0V8z" />
              <line x1="12" y1="1" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Dictate
          </button>
          <button className="primary-btn ghost">
            Upgrade
          </button>
        </div>
      </header>

      <div className="viewer-layout">
        <section className="viewer-document">
          <div className="document-toolbar">
            <div className="toolbar-left">
              <button className="toolbar-btn" aria-label="Previous page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button className="toolbar-btn" aria-label="Next page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <span className="page-indicator">Page 1</span>
            </div>
            <div className="toolbar-right">
              <button className="toolbar-btn" aria-label="Zoom out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button className="toolbar-btn" aria-label="Zoom in">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button className="toolbar-btn" aria-label="Download file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
          </div>
          <div className="document-frame">
            <iframe
              src={`${fileData.fileUrl}#view=fitH&toolbar=0`}
              title={fileData.fileName}
              frameBorder="0"
            />
          </div>
        </section>

        <aside className="viewer-ai-panel">
          <div className="ai-panel-header">
            <h2>Learn with MindSync AI</h2>
            <p>Ask questions, generate flashcards, and build quizzes from this PDF.</p>
          </div>

          <div className="ai-actions-grid">
            <button className="ai-action-card">
              <span>Chat</span>
              <p>Ask anything about this PDF</p>
            </button>
            <button className="ai-action-card">
              <span>Flashcards</span>
              <p>Create smart flashcards instantly</p>
            </button>
            <button className="ai-action-card">
              <span>Quiz</span>
              <p>Test yourself in seconds</p>
            </button>
            <button className="ai-action-card">
              <span>Mind Map</span>
              <p>See the big picture visually</p>
            </button>
          </div>

          <div className="ai-chat-card">
            <div className="chat-header">
              <div className="chat-avatar">AI</div>
              <div>
                <h3>MindSync Tutor</h3>
                <p>Ready to help</p>
              </div>
            </div>
            <div className="chat-body">
              <p>👋 Need a summary, explanation, or study plan? Just ask.</p>
              <p>Try: “Summarize chapter 2 in 5 bullet points.”</p>
            </div>
            <div className="chat-input">
              <input type="text" placeholder="Ask anything about this PDF..." />
              <button aria-label="Send message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}



