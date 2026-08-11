import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  Layers, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  AlertCircle, 
  Bookmark, 
  BookOpen, 
  Eye, 
  EyeOff, 
  Check, 
  Info,
  X
} from 'lucide-react';
import { getFlashcards, generateFlashcards, updateFlashcardState, generateExplanation, getExplanations } from '../../services/api';

const getExplainErrorMessage = (err) => {
  console.error('[Explain Concept Error Detail]:', err);
  const status = err?.statusCode || err?.status;
  const msg = err?.message || '';

  if (status === 400) {
    return `Unable to generate explanation: ${msg || 'Invalid request parameters.'}`;
  }
  if (status === 401 || status === 403) {
    return 'Authentication failed or AI service configuration is incorrect. Please log in again or check API keys.';
  }
  if (status === 404) {
    return 'The explanation endpoint or resource was not found. Please contact support.';
  }
  if (status === 429) {
    return 'Rate limit exceeded. Please wait a moment before trying again.';
  }
  if (status === 500) {
    return `AI service error: ${msg || 'The backend was unable to complete the tutoring request.'}`;
  }
  if (err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('timed out')) {
    return 'The request timed out. Please check your internet connection and try again.';
  }
  if (!navigator.onLine) {
    return 'You are offline. Please check your internet connection.';
  }
  return msg || 'Unable to explain this concept right now. Please try again.';
};

export const FlashcardPanel = React.memo(({ session, resourceId, resourceType }) => {
  const studySessionId = session?._id;

  const [cards, setCards] = useState([]);
  const [originalCards, setOriginalCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [isCached, setIsCached] = useState(false);

  const [explanationsList, setExplanationsList] = useState([]);
  const [generatingExplain, setGeneratingExplain] = useState(false);
  const [activeExplanation, setActiveExplanation] = useState(null);
  const [explainError, setExplainError] = useState(null);

  const loadExplanations = useCallback(async () => {
    if (!resourceId || !studySessionId) return;
    try {
      const res = await getExplanations(resourceId, studySessionId);
      if (Array.isArray(res)) {
        setExplanationsList(res);
      }
    } catch (err) {
      console.error('Failed to load explanations:', err);
    }
  }, [resourceId, studySessionId]);

  useEffect(() => {
    loadExplanations();
  }, [resourceId, studySessionId]);

  // Prevent Spacebar page scrolling
  const containerRef = useRef(null);

  // Fetch cached flashcards
  const loadFlashcards = useCallback(async () => {
    if (!studySessionId || !resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getFlashcards(studySessionId, resourceId);
      if (res && res.found && res.flashcards?.length > 0) {
        setCards(res.flashcards);
        setOriginalCards(res.flashcards);
        setMetadata(res.metadata);
        setIsCached(true);
      } else {
        setCards([]);
        setOriginalCards([]);
        setMetadata(null);
        setIsCached(false);
      }
    } catch (err) {
      console.error('Failed to load flashcards:', err);
      setError(err.message || 'Failed to fetch flashcards.');
    } finally {
      setLoading(false);
    }
  }, [studySessionId, resourceId]);

  useEffect(() => {
    loadFlashcards();
  }, [resourceId, studySessionId]);

  // Generate Flashcards
  const handleGenerate = async (forceRegenerate = false) => {
    if (!studySessionId || !resourceId || !resourceType) return;
    setLoading(true);
    setError(null);
    setFlipped(false);
    setActiveExplanation(null);
    setExplainError(null);
    setGeneratingExplain(false);
    setIsShuffled(false);
    setCurrentIndex(0);
    try {
      const res = await generateFlashcards({
        studySessionId,
        resourceId,
        resourceType,
        forceRegenerate
      });

      if (res && res.flashcards) {
        setCards(res.flashcards);
        setOriginalCards(res.flashcards);
        setMetadata(res.metadata);
        setIsCached(res.cached || false);
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      setError(err.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Navigations
  const handleNext = useCallback(() => {
    if (cards.length === 0) return;
    setFlipped(false);
    setActiveExplanation(null);
    setExplainError(null);
    setGeneratingExplain(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  const handlePrev = useCallback(() => {
    if (cards.length === 0) return;
    setFlipped(false);
    setActiveExplanation(null);
    setExplainError(null);
    setGeneratingExplain(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }, [cards.length]);

  // Flip and review count tracker
  const handleCardFlip = useCallback(async () => {
    const isRevealing = !flipped;
    setFlipped(isRevealing);

    if (isRevealing && cards.length > 0) {
      const currentCard = cards[currentIndex];
      if (!currentCard) return;

      try {
        // Optimistically increment review locally
        setCards(prev => prev.map((c, idx) => idx === currentIndex ? { ...c, reviewCount: (c.reviewCount || 0) + 1 } : c));
        setOriginalCards(prev => prev.map(c => c.id === currentCard.id ? { ...c, reviewCount: (c.reviewCount || 0) + 1 } : c));

        await updateFlashcardState(resourceId, currentCard.id, {
          studySessionId,
          incrementReview: true
        });
      } catch (err) {
        console.warn('Failed to increment review count:', err);
      }
    }
  }, [flipped, cards, currentIndex, resourceId, studySessionId]);

  // Toggle Shuffling
  const handleToggleShuffle = () => {
    if (cards.length === 0) return;
    setFlipped(false);
    setActiveExplanation(null);
    setExplainError(null);
    setGeneratingExplain(false);
    if (!isShuffled) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setCards(shuffled);
      setIsShuffled(true);
      setCurrentIndex(0);
    } else {
      setCards(originalCards);
      setIsShuffled(false);
      // Try to find index of current item in original cards
      const currentCardId = cards[currentIndex]?.id;
      const originalIdx = originalCards.findIndex(c => c.id === currentCardId);
      setCurrentIndex(originalIdx > -1 ? originalIdx : 0);
    }
  };

  // Toggle bookmark spacing state
  const handleToggleBookmark = async (cardId, e) => {
    e.stopPropagation(); // Prevent card flipping
    const currentCard = cards.find(c => c.id === cardId);
    if (!currentCard) return;

    const newBookmarkState = !currentCard.bookmarked;

    try {
      // Optimistically update
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, bookmarked: newBookmarkState } : c));
      setOriginalCards(prev => prev.map(c => c.id === cardId ? { ...c, bookmarked: newBookmarkState } : c));

      await updateFlashcardState(resourceId, cardId, {
        studySessionId,
        bookmarked: newBookmarkState
      });
    } catch (err) {
      console.error('Bookmark update failed:', err);
      // Revert on error
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, bookmarked: !newBookmarkState } : c));
      setOriginalCards(prev => prev.map(c => c.id === cardId ? { ...c, bookmarked: !newBookmarkState } : c));
    }
  };

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Filter out typing events
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable
      ) {
        return;
      }

      if (cards.length === 0 || loading) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleCardFlip();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cards, loading, handleCardFlip, handleNext, handlePrev]);

  // Color mappings for difficulty badge
  const getDifficultyColor = (difficulty = 'medium') => {
    const d = difficulty.toLowerCase();
    if (d === 'easy') return { border: 'rgba(52, 211, 153, 0.3)', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' };
    if (d === 'hard') return { border: 'rgba(248, 113, 113, 0.3)', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' };
    return { border: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' }; // Medium
  };

  const activeCard = cards[currentIndex];
  const totalCards = cards.length;

  return (
    <div ref={containerRef} className="flashcard-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'rgba(15, 18, 26, 0.75)',
      overflow: 'hidden',
      color: '#ffffff'
    }}>
      {/* CSS Injected Styles for Card Flip Animation */}
      <style>{`
        .flashcard-perspective {
          perspective: 1000px;
          width: 100%;
          flex: 1;
          min-height: 240px;
          margin: 10px 0;
        }
        .flashcard-flipper {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .flashcard-perspective.flipped .flashcard-flipper {
          transform: rotateY(180deg);
        }
        .flashcard-front, .flashcard-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          justify-content: center;
          align-items: center;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
          overflow-y: auto;
          text-align: center;
        }
        .flashcard-back {
          transform: rotateY(180deg);
          background: rgba(102, 184, 255, 0.05);
          border: 1px solid rgba(102, 184, 255, 0.2);
        }
        .pdf-spinner {
          width: 32px;
          height: 32px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #66b8ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header and Caching Status */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(20, 25, 35, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={16} style={{ color: '#66b8ff' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
            AI Flashcards
          </span>
        </div>

        {totalCards > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: isCached ? '#34d399' : '#66b8ff',
              backgroundColor: isCached ? 'rgba(52, 211, 153, 0.1)' : 'rgba(102, 184, 255, 0.1)',
              border: `1px solid ${isCached ? 'rgba(52, 211, 153, 0.25)' : 'rgba(102, 184, 255, 0.25)'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Check size={10} />
              <span>{isCached ? 'Cached' : 'Generated'}</span>
            </span>

            <button
              onClick={() => handleGenerate(true)}
              disabled={loading}
              title="Force Regenerate Flashcards"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Main content display */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: '12px',
            color: 'rgba(255, 255, 255, 0.6)',
            minHeight: '240px'
          }}>
            <div className="pdf-spinner" />
            <span style={{ fontSize: '0.85rem' }}>Analyzing content & creating flashcards...</span>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '14px',
            flex: 1,
            padding: '20px',
            minHeight: '240px'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => handleGenerate(false)}
              disabled={loading}
              className="pdf-toolbar-btn accent"
              style={{ padding: '8px 18px', fontSize: '0.825rem', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} style={{ marginRight: '6px' }} />
              Retry Generation
            </button>
          </div>
        ) : totalCards > 0 && activeCard ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
            
            {/* Progress indicator */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <span>Card {currentIndex + 1} of {totalCards}</span>
                {isShuffled && <span style={{ color: '#66b8ff', fontWeight: 600 }}>Shuffled</span>}
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${((currentIndex + 1) / totalCards) * 100}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #66b8ff, #3b82f6)', 
                  transition: 'width 0.3s ease' 
                }} />
              </div>
            </div>

            {/* Topic and Bookmark header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                background: 'rgba(255, 255, 255, 0.06)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Topic: {activeCard.topic || 'General'}
              </div>

              <button
                onClick={(e) => handleToggleBookmark(activeCard.id, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeCard.bookmarked ? '#fbbf24' : 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s ease'
                }}
                title={activeCard.bookmarked ? 'Remove Bookmark' : 'Bookmark Card'}
              >
                <Bookmark size={16} fill={activeCard.bookmarked ? '#fbbf24' : 'none'} />
              </button>
            </div>

            {activeExplanation ? (
              <div className="flashcard-explanation-container" style={{
                width: '100%',
                flex: 1,
                minHeight: '240px',
                margin: '10px 0',
                borderRadius: '12px',
                border: '1px solid rgba(102, 184, 255, 0.2)',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                padding: '20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} style={{ color: '#66b8ff' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Concept Explanation
                    </span>
                  </div>
                  <button 
                    onClick={() => setActiveExplanation(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.4)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.color = '#ffffff'}
                    onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, fontSize: '0.8rem', lineHeight: '1.5' }}>
                  
                  {/* Title */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#66b8ff', margin: '0 0 4px 0' }}>
                    {activeExplanation.title || `${activeExplanation.concept} Explained`}
                  </h3>

                  {/* Simple Explanation */}
                  {activeExplanation.simpleExplanation && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ color: '#34d399', fontWeight: 700, margin: '0 0 6px 0', fontSize: '0.85rem' }}>💡 Simple Explanation</h4>
                      <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>{activeExplanation.simpleExplanation}</p>
                    </div>
                  )}

                  {/* How It Works */}
                  {Array.isArray(activeExplanation.howItWorks) && activeExplanation.howItWorks.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ color: '#a78bfa', fontWeight: 700, margin: '0 0 8px 0', fontSize: '0.85rem' }}>⚙️ How It Works</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {activeExplanation.howItWorks.map((step, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ color: '#a78bfa', fontWeight: 800 }}>{idx + 1}.</span>
                            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Example */}
                  {activeExplanation.example && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ color: '#fbbf24', fontWeight: 700, margin: '0 0 6px 0', fontSize: '0.85rem' }}>📝 Example</h4>
                      <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontStyle: 'italic' }}>"{activeExplanation.example}"</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {Array.isArray(activeExplanation.keyPoints) && activeExplanation.keyPoints.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ color: '#66b8ff', fontWeight: 700, margin: '0 0 6px 0', fontSize: '0.85rem' }}>📌 Key Points</h4>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.8)' }}>
                        {activeExplanation.keyPoints.map((point, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Remember */}
                  {activeExplanation.remember && (
                    <div style={{ background: 'rgba(102,184,255,0.05)', border: '1px solid rgba(102,184,255,0.15)', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ color: '#66b8ff', fontWeight: 700, margin: '0 0 4px 0', fontSize: '0.85rem' }}>🧠 Remember</h4>
                      <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 500 }}>{activeExplanation.remember}</p>
                    </div>
                  )}

                </div>

                <button
                  onClick={() => setActiveExplanation(null)}
                  style={{
                    marginTop: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  Close Explanation
                </button>
              </div>
            ) : explainError ? (
              <div className="flashcard-explanation-container" style={{
                width: '100%',
                flex: 1,
                minHeight: '240px',
                margin: '10px 0',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.03)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                padding: '20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171'
                }}>
                  <AlertCircle size={20} />
                </div>
                
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#ffffff', margin: '0 0 6px 0', fontWeight: 600 }}>
                    Explanation Failed
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0, maxWidth: '240px', lineHeight: '1.4' }}>
                    {explainError}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '240px' }}>
                  <button
                    onClick={() => setExplainError(null)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setExplainError(null);
                      setGeneratingExplain(true);
                      try {
                        const concept = activeCard.answer;
                        const res = await generateExplanation({
                          concept,
                          question: activeCard.question,
                          answer: activeCard.answer,
                          topic: activeCard.topic,
                          resourceId,
                          resourceType,
                          studySessionId,
                          difficulty: activeCard.difficulty || 'Medium'
                        });
                        if (res && res.concept) {
                          setExplanationsList(prev => [...prev, res]);
                          setActiveExplanation(res);
                        } else {
                          setExplainError("The AI generated an empty response. Please try again.");
                        }
                      } catch (err) {
                        setExplainError(getExplainErrorMessage(err));
                      } finally {
                        setGeneratingExplain(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className={`flashcard-perspective ${flipped ? 'flipped' : ''}`}
                onClick={handleCardFlip}
              >
                <div className="flashcard-flipper">
                  
                  {/* Front Side */}
                  <div className="flashcard-front">
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        ...getDifficultyColor(activeCard.difficulty),
                        border: `1px solid ${getDifficultyColor(activeCard.difficulty).border}`,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {activeCard.difficulty}
                      </span>
                    </div>

                    <p style={{ 
                      fontSize: '1rem', 
                      lineHeight: '1.5', 
                      fontWeight: 500, 
                      color: '#ffffff', 
                      margin: '10px 0 0 0' 
                    }}>
                      {activeCard.question}
                    </p>

                    <div style={{ 
                      position: 'absolute', 
                      bottom: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.725rem', 
                      color: 'rgba(255,255,255,0.35)' 
                    }}>
                      <Eye size={12} />
                      <span>Click to Reveal Answer</span>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div className="flashcard-back">
                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        ...getDifficultyColor(activeCard.difficulty),
                        border: `1px solid ${getDifficultyColor(activeCard.difficulty).border}`,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {activeCard.difficulty}
                      </span>
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        color: 'rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        Reviews: {activeCard.reviewCount || 0}
                      </span>
                    </div>

                    <p style={{ 
                      fontSize: '0.9rem', 
                      lineHeight: '1.6', 
                      color: 'rgba(255, 255, 255, 0.95)', 
                      margin: '20px 0 0 0',
                      maxWidth: '100%',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {activeCard.answer}
                    </p>

                    <button
                      disabled={generatingExplain}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setExplainError(null);
                        const concept = activeCard.answer;
                        if (!concept || !concept.trim()) {
                          setExplainError("This flashcard does not contain enough information to generate an explanation.");
                          return;
                        }
                        
                        const existing = explanationsList.find(
                          ex => ex.concept.toLowerCase() === concept.toLowerCase()
                        );
                        
                        if (existing) {
                          setActiveExplanation(existing);
                          window.dispatchEvent(new CustomEvent('trigger-explain', {
                            detail: {
                              concept,
                              resourceId,
                              source: 'flashcard',
                              explanationData: existing
                            }
                          }));
                        } else {
                          setGeneratingExplain(true);
                          try {
                            const res = await generateExplanation({
                              concept,
                              question: activeCard.question,
                              answer: activeCard.answer,
                              topic: activeCard.topic,
                              resourceId,
                              resourceType,
                              studySessionId,
                              difficulty: activeCard.difficulty || 'Medium'
                            });
                            if (res && res.concept) {
                              setExplanationsList(prev => [...prev, res]);
                              setActiveExplanation(res);
                              window.dispatchEvent(new CustomEvent('trigger-explain', {
                                detail: {
                                  concept,
                                  resourceId,
                                  source: 'flashcard',
                                  explanationData: res
                                }
                              }));
                            } else {
                              setExplainError("The AI generated an empty response. Please try again.");
                            }
                          } catch (err) {
                            setExplainError(getExplainErrorMessage(err));
                          } finally {
                            setGeneratingExplain(false);
                          }
                        }
                      }}
                      style={{
                        marginTop: '14px',
                        background: generatingExplain 
                          ? 'linear-gradient(135deg, rgba(102, 184, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)' 
                          : 'linear-gradient(135deg, rgba(102, 184, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                        border: '1px solid rgba(102, 184, 255, 0.35)',
                        borderRadius: '100px',
                        color: '#ffffff',
                        padding: '8px 18px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: generatingExplain ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        position: 'relative',
                        zIndex: 20,
                        backdropFilter: 'blur(12px)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 15px rgba(102, 184, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                      }}
                      onMouseOver={(e) => {
                        if (!generatingExplain) {
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 184, 255, 0.35)';
                          e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.6)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!generatingExplain) {
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 184, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.35)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <Sparkles 
                        size={12} 
                        className={generatingExplain ? "spin-icon" : ""}
                        style={{ color: '#66b8ff' }} 
                      />
                      <span>{generatingExplain ? 'Generating...' : 'Explain Concept'}</span>
                      
                      {explanationsList.some(ex => ex.concept.toLowerCase() === (activeCard.answer || '').toLowerCase()) && (
                        <span style={{
                          fontSize: '0.6rem',
                          backgroundColor: 'rgba(52, 211, 153, 0.2)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          color: '#34d399',
                          padding: '1px 6px',
                          borderRadius: '100px',
                          marginLeft: '4px',
                          fontWeight: 800
                        }}>
                          Cached
                        </span>
                      )}
                    </button>

                    <div style={{ 
                      position: 'absolute', 
                      bottom: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.725rem', 
                      color: 'rgba(102, 184, 255, 0.6)' 
                    }}>
                      <EyeOff size={12} />
                      <span>Click to Hide Answer</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Controls navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handlePrev}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <button
                onClick={handleCardFlip}
                style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: flipped ? 'rgba(255, 255, 255, 0.04)' : 'rgba(102, 184, 255, 0.15)',
                  border: flipped ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(102, 184, 255, 0.3)',
                  color: flipped ? '#ffffff' : '#66b8ff',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {flipped ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{flipped ? 'Hide' : 'Reveal'}</span>
              </button>

              <button
                onClick={handleNext}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Shuffle and keyboard info strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <button
                onClick={handleToggleShuffle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isShuffled ? 'rgba(102, 184, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isShuffled ? 'rgba(102, 184, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                  color: isShuffled ? '#66b8ff' : 'rgba(255, 255, 255, 0.5)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Shuffle size={12} />
                <span>Shuffle</span>
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.3)'
              }}>
                <Info size={10} />
                <span>Space to Flip • ←/→ to Navigate</span>
              </div>
            </div>

            {/* Model Metadata footer info */}
            {metadata && (
              <div style={{
                marginTop: '10px',
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                paddingTop: '6px'
              }}>
                <span>Model: {metadata.aiModel || 'AI'} (v{metadata.version || '1.0'})</span>
                <span>Generated: {new Date(metadata.generatedAt).toLocaleDateString()}</span>
              </div>
            )}

          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            textAlign: 'center',
            gap: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            minHeight: '240px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.4)'
            }}>
              <BookOpen size={22} />
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', color: '#ffffff', margin: '0 0 4px 0' }}>
                AI Flashcard Generator
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', margin: 0, maxWidth: '240px', lineHeight: '1.4' }}>
                Generate interactive flashcards from this active {resourceType.toUpperCase()} resource to test your concepts.
              </p>
            </div>

            <button
              onClick={() => handleGenerate(false)}
              disabled={loading}
              className="pdf-toolbar-btn accent"
              style={{ padding: '8px 18px', fontSize: '0.825rem', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <Sparkles size={13} style={{ marginRight: '6px' }} />
              <span>Generate Flashcards</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

FlashcardPanel.displayName = 'FlashcardPanel';
export default FlashcardPanel;
