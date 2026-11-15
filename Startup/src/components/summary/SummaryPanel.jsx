import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, FileText, Zap, Key, Lightbulb, Check, AlertCircle } from 'lucide-react';
import { generateSummary, getSummary } from '../../services/api';

export const SummaryPanel = React.memo(({ session, resourceId, resourceType }) => {
  const [summaryType, setSummaryType] = useState('quick');
  const [summaryContent, setSummaryContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);

  // Load existing summary from MongoDB if available
  const loadSavedSummary = useCallback(async () => {
    if (!session?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSummary(session._id, resourceType, summaryType, resourceId);
      if (res && res.found && res.summaryContent) {
        setSummaryContent(res.summaryContent);
        setIsCached(true);
        setGeneratedAt(res.generatedAt);
      } else {
        setSummaryContent('');
        setIsCached(false);
        setGeneratedAt(null);
      }
    } catch (err) {
      console.warn('Failed to load saved summary:', err);
      setSummaryContent('');
    } finally {
      setLoading(false);
    }
  }, [session?._id, resourceId, resourceType, summaryType]);

  useEffect(() => {
    loadSavedSummary();
  }, [session?._id, resourceId, resourceType, summaryType]);

  // Trigger AI Summary Generation
  const handleGenerateSummary = async (forceRefresh = false) => {
    if (!session?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateSummary(session._id, {
        summaryType,
        forceRefresh,
        resourceId,
        resourceType
      });

      if (res && res.summaryContent) {
        setSummaryContent(res.summaryContent);
        setIsCached(res.cached || false);
        setGeneratedAt(res.generatedAt || new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
      setError(err.message || 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summary-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'rgba(15, 18, 26, 0.75)',
      overflow: 'hidden'
    }}>
      {/* Summary Type Controls */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(20, 25, 35, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
            Select Mode:
          </span>

          {summaryContent && (
            <button
              onClick={() => handleGenerateSummary(true)}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.725rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RefreshCw size={12} className={loading ? 'spin-icon' : ''} />
              <span>Refresh Summary</span>
            </button>
          )}
        </div>

        {/* Modes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            onClick={() => setSummaryType('quick')}
            style={{
              background: summaryType === 'quick' ? 'rgba(102, 184, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: summaryType === 'quick' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: summaryType === 'quick' ? '#00ff88' : 'rgba(255, 255, 255, 0.7)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Zap size={13} />
            <span>Quick Summary</span>
          </button>

          <button
            onClick={() => setSummaryType('detailed')}
            style={{
              background: summaryType === 'detailed' ? 'rgba(102, 184, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: summaryType === 'detailed' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: summaryType === 'detailed' ? '#00ff88' : 'rgba(255, 255, 255, 0.7)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={13} />
            <span>Detailed</span>
          </button>

          <button
            onClick={() => setSummaryType('key-takeaways')}
            style={{
              background: summaryType === 'key-takeaways' ? 'rgba(102, 184, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: summaryType === 'key-takeaways' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: summaryType === 'key-takeaways' ? '#00ff88' : 'rgba(255, 255, 255, 0.7)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Key size={13} />
            <span>Key Takeaways</span>
          </button>

          <button
            onClick={() => setSummaryType('beginner')}
            style={{
              background: summaryType === 'beginner' ? 'rgba(102, 184, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: summaryType === 'beginner' ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: summaryType === 'beginner' ? '#00ff88' : 'rgba(255, 255, 255, 0.7)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lightbulb size={13} />
            <span>Beginner</span>
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '240px',
            gap: '12px',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <div className="pdf-spinner" />
            <span style={{ fontSize: '0.85rem' }}>Synthesizing {resourceType.toUpperCase()} Summary...</span>
          </div>
        ) : error ? (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
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
        ) : summaryContent ? (
          <div>
            {/* Status Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <span style={{
                fontSize: '0.675rem',
                fontWeight: 600,
                color: isCached ? '#34d399' : '#00ff88',
                backgroundColor: isCached ? 'rgba(52, 211, 153, 0.12)' : 'rgba(102, 184, 255, 0.12)',
                border: isCached ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(102, 184, 255, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={11} />
                <span>{isCached ? 'Saved Summary' : 'Generated'}</span>
              </span>

              {generatedAt && (
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                  {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Markdown Output */}
            <div style={{
              fontSize: '0.875rem',
              lineHeight: '1.65',
              color: 'rgba(255, 255, 255, 0.9)',
              whiteSpace: 'pre-wrap'
            }}>
              {summaryContent}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '240px',
            textAlign: 'center',
            gap: '14px',
            color: 'rgba(255, 255, 255, 0.6)'
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
              <Sparkles size={24} />
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', color: '#ffffff', margin: '0 0 4px 0' }}>
                AI Summary Engine
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', margin: 0, maxWidth: '240px' }}>
                Generate an instant AI summary for this active {resourceType.toUpperCase()} resource.
              </p>
            </div>

            <button
              onClick={() => handleGenerateSummary(false)}
              disabled={loading}
              className="pdf-toolbar-btn accent"
              style={{ padding: '8px 18px', fontSize: '0.825rem', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <Sparkles size={14} />
              <span>Generate Summary</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

SummaryPanel.displayName = 'SummaryPanel';
export default SummaryPanel;
