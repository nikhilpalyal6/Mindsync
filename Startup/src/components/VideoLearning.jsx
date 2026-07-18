import { useState, useEffect } from 'react'
import './videoLearning.css'

// Mock Data Service
const MOCK_DATA = {
  default: {
    title: "Fastest Way to Learn DSA | Full Roadmap",
    chapters: [
      { time: "00:00", title: "Introduction" },
      { time: "02:15", title: "Why DSA is important" },
      { time: "05:30", title: "Big O Notation" },
      { time: "12:45", title: "Arrays & Strings" },
      { time: "25:10", title: "Linked Lists" },
      { time: "38:20", title: "Trees & Graphs" },
      { time: "55:00", title: "Dynamic Programming" },
      { time: "01:10:15", title: "Interview Tips" }
    ],
    transcript: [
      { time: "00:00", text: "Welcome back to the channel! Today we're going to cover the fastest way to learn Data Structures and Algorithms." },
      { time: "00:15", text: "Many of you have asked for a complete roadmap, so I've put together this comprehensive guide." },
      { time: "00:30", text: "We'll start with the basics and move on to more advanced topics." },
      { time: "02:15", text: "So, why is DSA so important? Well, it's the foundation of computer science." },
      { time: "02:30", text: "It helps you write efficient code and is crucial for technical interviews." },
      { time: "05:30", text: "Let's talk about Big O Notation. This is how we measure the efficiency of our algorithms." }
    ]
  },
  // You can add more mock data for specific video IDs here
  'dQw4w9WgXcQ': {
    title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    chapters: [
      { time: "00:00", title: "Intro" },
      { time: "00:18", title: "Verse 1" },
      { time: "00:43", title: "Chorus" },
      { time: "01:15", title: "Verse 2" }
    ],
    transcript: [
      { time: "00:00", text: "[Music]" },
      { time: "00:18", text: "We're no strangers to love" },
      { time: "00:22", text: "You know the rules and so do I" }
    ]
  }
}

export default function VideoLearning({ videoUrl, onBack }) {
  const [videoId, setVideoId] = useState('')
  const [activeTab, setActiveTab] = useState('chapters')
  const [activeToolTab, setActiveToolTab] = useState('chat')

  // Dynamic Data State
  const [videoTitle, setVideoTitle] = useState('')
  const [chapters, setChapters] = useState([])
  const [transcript, setTranscript] = useState([])

  useEffect(() => {
    if (videoUrl) {
      // Extract Video ID
      let id = ''
      try {
        if (videoUrl.includes('youtube.com/watch')) {
          const urlParams = new URLSearchParams(new URL(videoUrl).search)
          id = urlParams.get('v')
        } else if (videoUrl.includes('youtu.be/')) {
          id = videoUrl.split('youtu.be/')[1]?.split('?')[0]
        }
      } catch (e) {
        console.error("Error parsing URL", e)
      }

      setVideoId(id)

      // Fetch Mock Data
      const data = MOCK_DATA[id] || MOCK_DATA.default
      setVideoTitle(data.title)
      setChapters(data.chapters)
      setTranscript(data.transcript)
    }
  }, [videoUrl])

  return (
    <div className="video-learning-page">
      {/* Header */}
      <header className="vl-header">
        <div className="vl-header-left">
          <button className="vl-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="vl-logo">
            <img src="/logo.png" alt="Logo" />
          </div>
          <h1 className="vl-title">{videoTitle}</h1>
        </div>
        <div className="vl-header-right">
          <button className="vl-upgrade-btn">Upgrade</button>
          <button className="vl-share-btn">Share</button>
        </div>
      </header>

      <div className="vl-main">
        {/* Left Panel: Video & Content */}
        <div className="vl-left-panel">
          <div className="vl-video-container">
            {videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="vl-video-placeholder">
                <p>Loading Video...</p>
              </div>
            )}

            <div className="vl-video-overlay-controls">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vl-yt-link"
              >
                Watch on YouTube
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>

          <div className="vl-content-tabs">
            <div className="vl-tab-headers">
              <button
                className={`vl-tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
                onClick={() => setActiveTab('chapters')}
              >
                Chapters
                {activeTab === 'chapters' && <span className="dot"></span>}
              </button>
              <button
                className={`vl-tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setActiveTab('transcript')}
              >
                Transcript
                {activeTab === 'transcript' && <span className="dot"></span>}
              </button>

              <div className="vl-auto-scroll">
                <span>Auto-scroll</span>
                <button className="vl-toggle-btn active"></button>
              </div>
            </div>

            <div className="vl-tab-content">
              {activeTab === 'chapters' && (
                <div className="vl-chapters-list">
                  {chapters.map((chapter, index) => (
                    <div key={index} className="vl-chapter-item">
                      <span className="vl-time">{chapter.time}</span>
                      <span className="vl-chapter-title">{chapter.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="vl-transcripts-list">
                  {transcript.map((item, index) => (
                    <div key={index} className="vl-transcript-item">
                      <span className="vl-time">{item.time}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: AI Tutor */}
        <div className="vl-right-panel">
          <div className="vl-tools-nav">
            {['Chat', 'Flashcards', 'Quizzes', 'Podcast', 'Summary', 'Notes'].map((tool) => (
              <button
                key={tool}
                className={`vl-tool-btn ${activeToolTab === tool.toLowerCase() ? 'active' : ''}`}
                onClick={() => setActiveToolTab(tool.toLowerCase())}
              >
                {tool === 'Chat' && <span className="status-dot"></span>}
                {tool === 'Flashcards' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /></svg>}
                {tool === 'Quizzes' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>}
                {tool === 'Podcast' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /></svg>}
                {tool === 'Summary' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /></svg>}
                {tool === 'Notes' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>}
                {tool}
              </button>
            ))}
          </div>

          <div className="vl-ai-content">
            {activeToolTab === 'chat' && (
              <div className="vl-chat-interface">
                <div className="vl-chat-empty-state">
                  <div className="vl-chat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3>Learn with the AI Tutor</h3>

                  <div className="vl-suggestion-chips">
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      Quiz
                    </button>
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m6.24 6.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m6.24-6.24l4.24-4.24" /></svg>
                      Mind Map
                    </button>
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                      Voice Mode
                    </button>
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                      Flashcards
                    </button>
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                      Search
                    </button>
                    <button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      Timeline
                    </button>
                  </div>
                </div>

                <div className="vl-chat-input-container">
                  <div className="vl-chat-input-header">
                    <span className="vl-input-label">Learn anything</span>
                  </div>
                  <div className="vl-chat-input-wrapper">
                    <div className="vl-input-actions-left">
                      <button className="vl-input-action-btn">
                        Auto <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <button className="vl-input-action-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                        Add Context
                      </button>
                    </div>
                    <div className="vl-input-actions-right">
                      <button className="vl-icon-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      </button>
                      <button className="vl-icon-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                      </button>
                      <button className="vl-voice-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                        Voice
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
