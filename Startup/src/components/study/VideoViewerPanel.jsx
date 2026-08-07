import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Video, List, BookOpen, Search, X, ChevronRight } from 'lucide-react';

export const VideoViewerPanel = React.memo(({ 
  session, 
  activeResource 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  const playerRef = useRef(null);
  const segmentRefs = useRef([]);
  const activeIndexRef = useRef(-1);

  // Derive youtube metadata
  const youtubeData = useMemo(() => {
    return activeResource?.data || session?.metadata?.youtube;
  }, [activeResource, session?.metadata?.youtube]);

  const videoUrl = useMemo(() => {
    return activeResource?.url || youtubeData?.videoUrl || '';
  }, [activeResource, youtubeData?.videoUrl]);

  const videoTitle = useMemo(() => {
    return activeResource?.title || youtubeData?.title || 'YouTube Video';
  }, [activeResource, youtubeData?.title]);

  const getYoutubeId = (url) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  };

  const videoId = useMemo(() => {
    return getYoutubeId(videoUrl);
  }, [videoUrl]);

  // Extract transcript items and chapters
  const transcriptItems = useMemo(() => {
    return youtubeData?.transcriptItems || youtubeData?.originalTranscriptItems || [];
  }, [youtubeData]);

  const chapters = useMemo(() => {
    return youtubeData?.chapters || [];
  }, [youtubeData]);

  // Filter transcript items by search query
  const filteredTranscriptItems = useMemo(() => {
    if (!searchQuery.trim()) return transcriptItems;
    const regex = new RegExp(searchQuery, 'i');
    return transcriptItems.filter(item => regex.test(item.text));
  }, [transcriptItems, searchQuery]);

  // Load YouTube Player API and initialize player
  useEffect(() => {
    if (!videoId) return;

    let playerInstance;

    const createPlayer = () => {
      try {
        playerInstance = new window.YT.Player('youtube-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0
          },
          events: {
            'onReady': (event) => {
              playerRef.current = event.target;
            }
          }
        });
      } catch (err) {
        console.error('[YouTube Player] Failed to construct player instance:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // Set global callback
      window.onYouTubeIframeAPIReady = createPlayer;

      // Inject API script if not loaded
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    }

    return () => {
      if (playerInstance && playerInstance.destroy) {
        playerInstance.destroy();
      }
      playerRef.current = null;
    };
  }, [videoId]);

  // Timer loop to update current playback time
  useEffect(() => {
    if (!videoId) return;

    const intervalId = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
        } catch (e) {
          // Player not fully initialized yet
        }
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [videoId]);

  // Find active segment index
  const activeSegmentIndex = useMemo(() => {
    if (!transcriptItems || transcriptItems.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < transcriptItems.length; i++) {
      if (transcriptItems[i].seconds <= currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [transcriptItems, currentTime]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex !== -1 && activeSegmentIndex !== activeIndexRef.current) {
      activeIndexRef.current = activeSegmentIndex;
      const element = segmentRefs.current[activeSegmentIndex];
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeSegmentIndex]);

  // Seek video helper
  const handleSeek = useCallback((seconds) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(seconds, true);
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } catch (err) {
        console.error('[YouTube Player] Seek failed:', err);
      }
    }
  }, []);

  if (!videoUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--text-muted)' }}>
        <h3>No video resource loaded</h3>
        <p>Please select a video from the sidebar explorer or add a video link from Overview.</p>
      </div>
    );
  }

  return (
    <div className="yt-workspace-container">
      {/* 1. Player Section */}
      <div className={`yt-player-section ${!isSidebarOpen ? 'full-width' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
            {videoTitle}
          </h2>
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Show Transcript</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {/* Video Iframe Viewport */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          width: '100%', 
          backgroundColor: '#000', 
          borderRadius: '12px', 
          border: '1px solid var(--glass-border)',
          overflow: 'hidden',
          minHeight: '200px'
        }}>
          {videoId ? (
            <div id="youtube-player" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading player...
            </div>
          )}
        </div>
      </div>

      {/* 2. Side Panel Section */}
      <div className={`yt-sidebar-section ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="yt-sidebar-header">
          <div className="yt-sidebar-tabs">
            <button
              onClick={() => setActiveSidebarTab('transcript')}
              className={`yt-sidebar-tab ${activeSidebarTab === 'transcript' ? 'active' : ''}`}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveSidebarTab('chapters')}
              className={`yt-sidebar-tab ${activeSidebarTab === 'chapters' ? 'active' : ''}`}
            >
              Chapters
            </button>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="yt-sidebar-close"
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>

        <div className="yt-sidebar-body">
          {activeSidebarTab === 'transcript' ? (
            <>
              {/* Sticky Search bar */}
              <div className="yt-search-sticky">
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="yt-search-input"
                />
              </div>

              {/* Transcript Scroll Area */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredTranscriptItems.map((item, index) => {
                  const isActive = index === activeSegmentIndex;
                  return (
                    <div
                      key={index}
                      ref={el => segmentRefs.current[index] = el}
                      onClick={() => handleSeek(item.seconds)}
                      className={`yt-segment-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="yt-segment-time">{item.time}</span>
                      <span className="yt-segment-text">{item.text}</span>
                    </div>
                  );
                })}

                {transcriptItems.length === 0 && (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No transcript available for this video.
                  </div>
                )}

                {transcriptItems.length > 0 && filteredTranscriptItems.length === 0 && (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No matching segments found.
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Chapters Scroll Area */
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {chapters.map((ch, index) => (
                <div
                  key={index}
                  onClick={() => handleSeek(ch.seconds || 0)}
                  className="yt-chapter-item"
                >
                  <span className="yt-chapter-title">{ch.title}</span>
                  <span className="yt-chapter-time-pill">{ch.time}</span>
                </div>
              ))}

              {chapters.length === 0 && (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No chapters detected.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

VideoViewerPanel.displayName = 'VideoViewerPanel';
export default VideoViewerPanel;
