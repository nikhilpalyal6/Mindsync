import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, BookOpen, ThumbsUp, ChevronDown, ChevronUp, 
  Clock, Award, AlertCircle, ArrowRight, Search, CheckCircle2, X 
} from 'lucide-react';
import { generateExplanation, getExplanations, updateExplanationFeedback } from '../../services/api';

export default function ExplainPanel({ session, resourceId, resourceType }) {
  const studySessionId = session?._id;
  const [isOpen, setIsOpen] = useState(false);
  const [conceptInput, setConceptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [history, setHistory] = useState([]);
  const [feedbackRegistered, setFeedbackRegistered] = useState(null);
  const [resourceIdState, setResourceIdState] = useState(resourceId || '');
  const [sourceState, setSourceState] = useState(resourceType || 'pdf'); // 'pdf' | 'youtube' | 'notes' | 'flashcard' | 'quiz'
  const [width, setWidth] = useState(480);
  const isResizing = useRef(false);

  const [openAccordions, setOpenAccordions] = useState({
    simple: true,
    steps: true,
    example: false,
    analogy: false,
    mistakes: false,
    related: false,
    objectives: false
  });

  const scrollContainerRef = useRef(null);

  // Local analytics tracking helper
  const trackAnalytic = useCallback((metric, data) => {
    try {
      const stats = JSON.parse(localStorage.getItem('mindsync_explain_analytics') || '{}');
      if (metric === 'open') {
        stats.openedCount = (stats.openedCount || 0) + 1;
      } else if (metric === 'concept') {
        stats.concepts = stats.concepts || {};
        stats.concepts[data] = (stats.concepts[data] || 0) + 1;
      } else if (metric === 'readingTime') {
        // Parse "X minutes" or "X mins" to integer
        const mins = parseInt(data) || 2;
        stats.totalReadingTime = (stats.totalReadingTime || 0) + mins;
        stats.readCount = (stats.readCount || 0) + 1;
        stats.avgReadingTime = Math.round(stats.totalReadingTime / stats.readCount);
      }
      localStorage.setItem('mindsync_explain_analytics', JSON.stringify(stats));
    } catch (err) {
      console.warn('Analytics tracking error:', err);
    }
  }, []);

  // Fetch explanation history
  const loadHistory = useCallback(async (resId) => {
    if (!resId || !studySessionId) return;
    try {
      const res = await getExplanations(resId, studySessionId);
      if (Array.isArray(res)) {
        setHistory(res);
      }
    } catch (err) {
      console.error('Error fetching explanations history:', err);
    }
  }, [studySessionId]);

  useEffect(() => {
    if (resourceId) {
      setResourceIdState(resourceId);
      loadHistory(resourceId);
    }
    if (resourceType) {
      setSourceState(resourceType);
    }
  }, [resourceId, resourceType, studySessionId]);

  const handleExplain = useCallback(async (conceptName, difficultyLevel = 'Medium', mode = null, customResId = null, customSource = null) => {
    if (loading) return;
    if (!conceptName || !conceptName.trim()) return;
    
    const targetResId = customResId || resourceIdState;
    const targetSource = customSource || sourceState;

    if (!targetResId || !studySessionId) {
      console.warn('[Explain Panel] Missing resource or session identifiers');
      return;
    }

    setSourceState(targetSource);
    setLoading(true);
    setFeedbackRegistered(null);
    trackAnalytic('concept', conceptName.trim());

    try {
      const res = await generateExplanation({
        concept: conceptName.trim(),
        resourceId: targetResId,
        resourceType: targetSource,
        studySessionId,
        difficulty: difficultyLevel,
        mode
      });

      if (res && (res._id || res.id || res.concept)) {
        setCurrentExplanation(res);
        if (res.estimatedReadingTime) {
          trackAnalytic('readingTime', res.estimatedReadingTime);
        }
        
        // Refresh history
        loadHistory(targetResId);
        
        // Auto-scroll to top
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error('Explain concept call failed:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, resourceIdState, sourceState, studySessionId, loadHistory, trackAnalytic]);

  // Global listener for Explain triggers
  useEffect(() => {
    console.log('[Explain Panel Mount] Listener setup. studySessionId:', studySessionId);
    
    const handleTrigger = (e) => {
      console.log('[Explain Panel Event] Received trigger-explain event:', e.detail);
      const { concept: targetConcept, resourceId: targetResourceId, source: targetSource, explanationData } = e.detail;
      setIsOpen(true);
      trackAnalytic('open');
      if (targetResourceId) {
        setResourceIdState(targetResourceId);
      }
      if (targetSource) {
        setSourceState(targetSource);
      }

      // If explanation already exists, open panel immediately using cached data and skip AI call
      if (explanationData) {
        const conceptToShow = targetConcept || explanationData.concept || '';
        setConceptInput(conceptToShow);
        setCurrentExplanation({ ...explanationData, cached: true });
        if (explanationData.estimatedReadingTime) {
          trackAnalytic('readingTime', explanationData.estimatedReadingTime);
        }
        if (targetResourceId) {
          loadHistory(targetResourceId);
        }
        return;
      }

      if (targetConcept && targetConcept.trim()) {
        setConceptInput(targetConcept);
        handleExplain(targetConcept, 'Medium', null, targetResourceId, targetSource || 'pdf');
      }
    };

    window.addEventListener('trigger-explain', handleTrigger);
    return () => {
      console.log('[Explain Panel Unmount] Removing listener.');
      window.removeEventListener('trigger-explain', handleTrigger);
    };
  }, [handleExplain, trackAnalytic, studySessionId, loadHistory]);

  // Keyboard Shortcuts (Esc to close, Ctrl+Enter to explain selection)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      
      if (e.ctrlKey && e.key === 'Enter') {
        const selection = window.getSelection().toString().trim();
        if (selection) {
          const activeRes = window.currentActiveResource || {};
          window.dispatchEvent(new CustomEvent('trigger-explain', {
            detail: {
              concept: selection,
              resourceId: activeRes.id || resourceIdState || 'default_resource',
              source: activeRes.type || sourceState || 'pdf'
            }
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resourceIdState, sourceState]);

  // Drag resizing handlers (standard functions to avoid dependency lints)
  const resize = (e) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 350 && newWidth < 800) {
      setWidth(newWidth);
    }
  };

  const stopResize = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
  };

  const startResize = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
  };

  const handleFeedback = async (type) => {
    if (!currentExplanation) return;
    setFeedbackRegistered(type);
    
    try {
      await updateExplanationFeedback(currentExplanation.id, {
        resourceId: resourceIdState,
        studySessionId,
        feedback: type
      });
      
      if (type === 'simpler') {
        handleExplain(currentExplanation.concept, currentExplanation.difficulty, 'simpler');
      } else if (type === 'deeper') {
        handleExplain(currentExplanation.concept, currentExplanation.difficulty, 'deeper');
      }
    } catch (err) {
      console.error('Feedback update failed:', err);
    }
  };

  const toggleAccordion = (section) => {
    setOpenAccordions(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Keyboard navigation
  const handleKeyDownAction = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: `${width}px`,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 18, 26, 0.96)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
      aria-label="Explain Concept sliding drawer"
    >
      {/* Resizing Edge */}
      <div 
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'ew-resize',
          backgroundColor: 'transparent',
          zIndex: 1000,
          transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(102, 184, 255, 0.3)'; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      />

      {/* Sticky Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(20, 25, 35, 0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: '#00ff88' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Explain Mode
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close Explain Panel"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '6px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search Input bar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(15, 18, 26, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{
            position: 'absolute',
            left: '12px',
            color: 'rgba(255, 255, 255, 0.4)'
          }} />
          <input
            type="text"
            placeholder="Search another concept..."
            value={conceptInput}
            onChange={(e) => setConceptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleExplain(conceptInput);
            }}
            disabled={loading}
            aria-label="Explain Concept Input"
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px 12px 8px 32px',
              fontSize: '0.8rem',
              color: '#ffffff',
              outline: 'none',
              cursor: loading ? 'not-allowed' : 'text'
            }}
          />
        </div>

        {/* Previous Explanations Chip List */}
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
            {history.map((h, i) => (
              <button
                key={h.id || i}
                onClick={() => handleExplain(h.concept, h.difficulty)}
                disabled={loading}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '100px',
                  padding: '3px 8px',
                  fontSize: '0.675rem',
                  color: loading ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.65)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {h.concept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content body */}
      <div 
        ref={scrollContainerRef}
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {loading ? (
          /* skeleton lines */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', width: '50%', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '80px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '60px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          </div>
        ) : currentExplanation ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header concept badges */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                {/* Source Badge */}
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  backgroundColor: 'rgba(102, 184, 255, 0.15)',
                  border: '1px solid rgba(102, 184, 255, 0.3)',
                  color: '#00ff88',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  Source: {sourceState}
                </span>

                {/* Generated vs Cached Badge */}
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  backgroundColor: currentExplanation.cached ? 'rgba(52, 211, 153, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                  border: currentExplanation.cached ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)',
                  color: currentExplanation.cached ? '#34d399' : '#a78bfa',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {currentExplanation.cached ? 'Smart Cached' : 'Newly Generated'}
                </span>
              </div>

              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {currentExplanation.title}
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>{currentExplanation.estimatedReadingTime} read</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Award size={12} />
                  <span style={{ 
                    fontWeight: 700, 
                    color: currentExplanation.difficulty === 'Easy' ? '#34d399' : currentExplanation.difficulty === 'Hard' ? '#f87171' : '#fbbf24' 
                  }}>
                    {currentExplanation.difficulty} Level
                  </span>
                </div>
              </div>
            </div>

            {/* Accordions */}
            {/* 1. Simple Explanation */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('simple')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('simple'))}
                aria-expanded={openAccordions.simple}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>1. Simple Explanation</span>
                {openAccordions.simple ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.simple && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', fontSize: '0.775rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                  {currentExplanation.simpleExplanation}
                </div>
              )}
            </div>

            {/* 2. Step-by-Step Breakdown */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('steps')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('steps'))}
                aria-expanded={openAccordions.steps}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>2. Step-by-Step Breakdown</span>
                {openAccordions.steps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.steps && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.isArray(currentExplanation.stepByStep) && currentExplanation.stepByStep.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '0.775rem', lineHeight: '1.4' }}>
                      <span style={{ color: '#00ff88', fontWeight: 800 }}>{idx + 1}.</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)' }}>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Real World Example */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('example')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('example'))}
                aria-expanded={openAccordions.example}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>3. Real World Example</span>
                {openAccordions.example ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.example && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', fontSize: '0.775rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                  {currentExplanation.realWorldExample}
                </div>
              )}
            </div>

            {/* 4. Visual Analogy */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('analogy')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('analogy'))}
                aria-expanded={openAccordions.analogy}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>4. Visual Analogy</span>
                {openAccordions.analogy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.analogy && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', fontSize: '0.775rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                  {currentExplanation.visualAnalogy}
                </div>
              )}
            </div>

            {/* 5. Common Mistakes */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('mistakes')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('mistakes'))}
                aria-expanded={openAccordions.mistakes}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>5. Common Mistakes</span>
                {openAccordions.mistakes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.mistakes && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', fontSize: '0.775rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                  {currentExplanation.commonMistakes}
                </div>
              )}
            </div>

            {/* 6. Related Concepts */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('related')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('related'))}
                aria-expanded={openAccordions.related}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>6. Related Concepts</span>
                {openAccordions.related ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.related && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Array.isArray(currentExplanation.relatedConcepts) && currentExplanation.relatedConcepts.map((concept, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // Dispatch event carrying concept name for future AI Tutor routing (does NOT call AI Explain)
                        window.dispatchEvent(new CustomEvent('explain-concept-click', { 
                          detail: { concept, resourceId: resourceIdState, studySessionId } 
                        }));
                      }}
                      style={{
                        backgroundColor: 'rgba(102, 184, 255, 0.08)',
                        border: '1px solid rgba(102, 184, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        color: '#00ff88',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {concept}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 7. Learning Objectives */}
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleAccordion('objectives')}
                onKeyDown={(e) => handleKeyDownAction(e, () => toggleAccordion('objectives'))}
                aria-expanded={openAccordions.objectives}
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <span>7. Learning Objectives</span>
                {openAccordions.objectives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openAccordions.objectives && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Array.isArray(currentExplanation.learningObjectives) && currentExplanation.learningObjectives.map((obj, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                      <CheckCircle2 size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{obj}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. Visual Knowledge Level */}
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                8. Knowledge Difficulty Level
              </span>
              <div style={{ display: 'flex', gap: '4px', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ flex: 1, backgroundColor: '#4ade80' }} />
                <div style={{ flex: 1, backgroundColor: '#fbbf24', opacity: currentExplanation.difficulty === 'Medium' || currentExplanation.difficulty === 'Hard' ? 1 : 0.2 }} />
                <div style={{ flex: 1, backgroundColor: '#f87171', opacity: currentExplanation.difficulty === 'Hard' ? 1 : 0.2 }} />
              </div>
            </div>

            {/* 9. Feedback Action Row */}
            <div style={{
              padding: '14px',
              border: '1px solid rgba(102, 184, 255, 0.12)',
              borderRadius: '8px',
              background: 'rgba(102, 184, 255, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#fff' }}>
                9. Did this help your understanding?
              </span>
              <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                <button
                  onClick={() => handleFeedback('yes')}
                  disabled={feedbackRegistered === 'yes'}
                  style={{
                    flex: 1,
                    backgroundColor: feedbackRegistered === 'yes' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: feedbackRegistered === 'yes' ? '#4ade80' : '#ffffff',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <ThumbsUp size={12} />
                  <span>👍 Yes</span>
                </button>

                <button
                  onClick={() => handleFeedback('simpler')}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: '#ffffff',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span>🤔 Simpler</span>
                </button>

                <button
                  onClick={() => handleFeedback('deeper')}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: '#ffffff',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span>🔬 Deeper</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyRules: 'center', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', justifyContent: 'center' }}>
            <BookOpen size={24} style={{ marginBottom: '8px' }} />
            <h4 style={{ margin: 0, color: '#fff', fontSize: '0.85rem' }}>AI Explain Assistant</h4>
            <p style={{ fontSize: '0.75rem', maxWidth: '200px', marginTop: '4px' }}>
              Highlight text or trigger an explain concept action to begin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
