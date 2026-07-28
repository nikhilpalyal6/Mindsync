import { useState, useEffect, useCallback, useRef } from 'react';
import './videoLearning.css';
import AISidebar from './ai/AISidebar';
import SummaryPanel from './summary/SummaryPanel';
import { fetchYouTubeData } from '../services/api';

export default function VideoLearning({ videoUrl, session, onBack, onSwitchTab }) {
  // 1. Single Source of Truth for YouTube Intelligence
  const [youtubeData, setYoutubeData] = useState(() => {
    return session?.metadata?.youtube && session.metadata.youtube.videoUrl === videoUrl
      ? session.metadata.youtube
      : null;
  });

  const [videoId, setVideoId] = useState('');
  const [activeTab, setActiveTab] = useState('chapters');
  const [activeToolTab, setActiveToolTab] = useState('chat');
  const [seekSeconds, setSeekSeconds] = useState(0);
  const [transcriptMode, setTranscriptMode] = useState('english'); // 'english' | 'original'
  const [loading, setLoading] = useState(false);

  // Polling ref to prevent duplicate polling and handle cleanups
  const pollingTimerRef = useRef(null);
  const pollCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Helper to convert HH:MM:SS or MM:SS to seconds
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  // Helper to stop active polling safely
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
      console.log('[Polling Stopped]');
    }
  }, []);

  // Cleanup poll timer on component unmount and handle isMountedRef
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Stop polling and reset youtubeData on changes to videoUrl or session?._id
  useEffect(() => {
    stopPolling();
    setYoutubeData(null);
  }, [videoUrl, session?._id, stopPolling]);

  // Extract Video ID when videoUrl changes
  useEffect(() => {
    if (!videoUrl) return;
    let id = '';
    try {
      if (videoUrl.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(videoUrl).search);
        id = urlParams.get('v');
      } else if (videoUrl.includes('youtu.be/')) {
        id = videoUrl.split('youtu.be/')[1]?.split('?')[0];
      }
    } catch (e) {
      console.error("Error parsing Video URL", e);
    }
    if (isMountedRef.current) {
      setVideoId(id);
    }
  }, [videoUrl]);

  // Load YouTube Intelligence and start polling if processing
  const loadVideoIntelligence = useCallback(async () => {
    if (!videoUrl || !session?._id) return;

    // Check if initial cached state already contains valid transcript items
    if (youtubeData && youtubeData.videoUrl === videoUrl) {
      const origItems = youtubeData.originalTranscriptItems || youtubeData.transcriptItems || [];
      if (origItems.length > 0) {
        console.log(`[Transcript Loaded from Cache] Reused youtubeData state (${origItems.length} items)`);
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }
    }

    if (isMountedRef.current) {
      setLoading(true);
    }
    console.log('[Transcript Processing Started]');

    try {
      const res = await fetchYouTubeData(session._id, videoUrl);
      if (!isMountedRef.current) return;

      if (res) {
        const data = res;

        // SINGLE SOURCE OF TRUTH UPDATE
        setYoutubeData(data);
        console.log('[Frontend Transcript Updated]');
        console.log('[Chapters Updated]');

        // If completed or failed immediately
        if (data.processingStatus === 'completed' || data.processingStatus === 'failed') {
          console.log('[Transcript Processing Completed]');
          setLoading(false);
          return;
        }

        // Start polling if status is processing and not already polling
        if (!pollingTimerRef.current) {
          console.log('[Polling Started]');
          pollCountRef.current = 0;

          pollingTimerRef.current = setInterval(async () => {
            if (!isMountedRef.current) {
              stopPolling();
              return;
            }

            pollCountRef.current += 1;
            console.log(`[Polling Attempt ${pollCountRef.current}/30] Checking YouTube status...`);

            if (pollCountRef.current > 30) {
              stopPolling();
              if (isMountedRef.current) {
                setLoading(false);
              }
              return;
            }

            try {
              const pollRes = await fetchYouTubeData(session._id, videoUrl);
              if (!isMountedRef.current) {
                stopPolling();
                return;
              }

              if (pollRes) {
                const pollData = pollRes;

                // Update single source of truth state
                setYoutubeData(pollData);

                if (pollData.processingStatus === 'completed' || pollData.processingStatus === 'failed') {
                  stopPolling();
                  console.log('[Transcript Processing Completed]');
                  console.log('[Frontend Transcript Updated]');
                  console.log('[Chapters Updated]');
                  setLoading(false);
                }
              }
            } catch (pollErr) {
              console.error('Polling error:', pollErr);
              stopPolling();
              if (isMountedRef.current) {
                setLoading(false);
              }
            }
          }, 2000);
        } else {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('[YouTube Intelligence Error] Failed to load video intelligence:', err);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [videoUrl, session?._id, stopPolling]);

  useEffect(() => {
    loadVideoIntelligence();
  }, [loadVideoIntelligence]);

  // Derived Properties from Single Source of Truth (youtubeData)
  const videoTitle = youtubeData?.title || 'YouTube Educational Video';
  const channelName = youtubeData?.authorName || 'YouTube Creator';

  const origItems = youtubeData?.originalTranscriptItems || youtubeData?.transcriptItems || [];
  const isEn = youtubeData?.transcriptLanguage === 'en' || !youtubeData?.translated;
  const engItems = youtubeData?.englishTranscriptItems || (isEn ? origItems : []);

  const chapters = youtubeData?.chapters || [];

  // Chapter Click -> Seek Video Player
  const handleChapterClick = (timeStr) => {
    const sec = parseTimeToSeconds(timeStr);
    setSeekSeconds(sec);
  };

  // Determine displayed items based on transcriptMode
  let displayedTranscriptItems = [];
  let isGeneratingTranslation = false;

  if (transcriptMode === 'english') {
    if (engItems && engItems.length > 0) {
      displayedTranscriptItems = engItems;
    } else if (origItems && origItems.length > 0) {
      if (isEn) {
        displayedTranscriptItems = origItems;
      } else {
        isGeneratingTranslation = true;
      }
    }
  } else {
    displayedTranscriptItems = origItems.length > 0 ? origItems : engItems;
  }

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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="vl-title" style={{ margin: 0, fontSize: '0.95rem' }}>{videoTitle}</h1>
            <span style={{ fontSize: '0.725rem', color: 'rgba(255, 255, 255, 0.5)' }}>
              Channel: {channelName}
            </span>
          </div>
        </div>

        {/* Resource Switcher */}
        <div className="vl-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
            <button 
              onClick={() => onSwitchTab?.('pdf')} 
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              📄 PDF
            </button>
            <button 
              onClick={() => onSwitchTab?.('youtube')} 
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#66b8ff',
                backgroundColor: 'rgba(102, 184, 255, 0.15)',
                border: '1px solid rgba(102, 184, 255, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ▶️ YouTube
            </button>
            <button 
              onClick={() => onSwitchTab?.('notes')} 
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              📝 Notes
            </button>
          </div>
          <button className="vl-upgrade-btn">Upgrade</button>
        </div>
      </header>

      <div className="vl-main">
        {/* Left Panel: Video & Content */}
        <div className="vl-left-panel">
          <div className="vl-video-container">
            {videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?start=${seekSeconds}&autoplay=${seekSeconds > 0 ? 1 : 0}`}
                title={videoTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="vl-video-placeholder">
                <p>Loading Video...</p>
              </div>
            )}
          </div>

          <div className="vl-content-tabs">
            <div className="vl-tab-headers" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`vl-tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chapters')}
                >
                  Chapters ({chapters.length})
                  {activeTab === 'chapters' && <span className="dot"></span>}
                </button>
                <button
                  className={`vl-tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                  onClick={() => setActiveTab('transcript')}
                >
                  Transcript
                  {activeTab === 'transcript' && <span className="dot"></span>}
                </button>
              </div>

              {/* Multilingual Transcript Switcher */}
              {activeTab === 'transcript' && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    onClick={() => setTranscriptMode('english')}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: transcriptMode === 'english' ? '#66b8ff' : 'rgba(255,255,255,0.5)',
                      backgroundColor: transcriptMode === 'english' ? 'rgba(102, 184, 255, 0.18)' : 'transparent',
                      border: transcriptMode === 'english' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid transparent',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setTranscriptMode('original')}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: transcriptMode === 'original' ? '#66b8ff' : 'rgba(255,255,255,0.5)',
                      backgroundColor: transcriptMode === 'original' ? 'rgba(102, 184, 255, 0.18)' : 'transparent',
                      border: transcriptMode === 'original' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid transparent',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Original
                  </button>
                </div>
              )}
            </div>

            <div className="vl-tab-content">
              {activeTab === 'chapters' && (
                <div className="vl-chapters-list">
                  {loading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#66b8ff', fontSize: '0.9rem' }}>
                      Generating chapters...
                    </div>
                  ) : chapters.length > 0 ? (
                    chapters.map((chapter, index) => (
                      <div 
                        key={index} 
                        className="vl-chapter-item"
                        onClick={() => handleChapterClick(chapter.time)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="vl-time">▶ {chapter.time}</span>
                        <span className="vl-chapter-title">{chapter.title}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      No chapters available for this video.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="vl-transcripts-list">
                  {loading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#66b8ff', fontSize: '0.9rem' }}>
                      Generating transcript...
                    </div>
                  ) : isGeneratingTranslation ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(102, 184, 255, 0.8)', fontSize: '0.9rem' }}>
                      English translation is still being generated...
                    </div>
                  ) : displayedTranscriptItems.length > 0 ? (
                    displayedTranscriptItems.map((item, index) => (
                      <div key={index} className="vl-transcript-item" onClick={() => handleChapterClick(item.time)} style={{ cursor: 'pointer' }}>
                        <span className="vl-time">{item.time}</span>
                        <p>{item.text}</p>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                      I can see the video, but no transcript is available yet.
                    </div>
                  )}
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

          <div className="vl-ai-content" style={{ height: 'calc(100% - 50px)', overflow: 'hidden' }}>
            {activeToolTab === 'chat' && (
              <AISidebar session={session} />
            )}
            {activeToolTab === 'summary' && (
              <SummaryPanel session={session} resourceType="youtube" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
