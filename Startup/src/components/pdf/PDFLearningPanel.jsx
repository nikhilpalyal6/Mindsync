import React, { useState } from 'react';
import { MessageSquare, FileText, Layers, HelpCircle, TrendingUp, Sparkles, BookOpen } from 'lucide-react';
import AISidebar from '../ai/AISidebar';
import SummaryPanel from '../summary/SummaryPanel';
import FlashcardPanel from '../summary/FlashcardPanel';
import QuizPanel from '../summary/QuizPanel';

export const PDFLearningPanel = React.memo(({ session }) => {
  const [activeFeature, setActiveFeature] = useState('ask-pdf');
  const resourceId = session?.metadata?.pdf?.pdfFilename || session?.metadata?.pdf?.filename || '';

  return (
    <div className="pdf-learning-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'rgba(20, 25, 35, 0.7)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 18, 26, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: '#66b8ff' }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            PDF AI Workspace
          </h3>
        </div>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: '#66b8ff',
          backgroundColor: 'rgba(102, 184, 255, 0.12)',
          border: '1px solid rgba(102, 184, 255, 0.25)',
          padding: '2px 8px',
          borderRadius: '4px'
        }}>
          {activeFeature === 'ask-pdf' ? 'Ask PDF Active' : `${activeFeature} active`}
        </span>
      </div>

      {/* Mini Workspace Panel Tabs Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        gap: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        <button
          onClick={() => setActiveFeature('ask-pdf')}
          style={{
            background: activeFeature === 'ask-pdf' ? 'rgba(102, 184, 255, 0.15)' : 'none',
            border: activeFeature === 'ask-pdf' ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid transparent',
            color: activeFeature === 'ask-pdf' ? '#66b8ff' : 'rgba(255, 255, 255, 0.6)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquare size={13} />
          <span>Ask AI</span>
        </button>

        <button
          onClick={() => setActiveFeature('summary')}
          style={{
            background: activeFeature === 'summary' ? 'rgba(102, 184, 255, 0.15)' : 'none',
            border: activeFeature === 'summary' ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid transparent',
            color: activeFeature === 'summary' ? '#66b8ff' : 'rgba(255, 255, 255, 0.6)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={13} />
          <span>Summary</span>
        </button>

        <button
          onClick={() => setActiveFeature('flashcards')}
          style={{
            background: activeFeature === 'flashcards' ? 'rgba(102, 184, 255, 0.15)' : 'none',
            border: activeFeature === 'flashcards' ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid transparent',
            color: activeFeature === 'flashcards' ? '#66b8ff' : 'rgba(255, 255, 255, 0.6)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={13} />
          <span>Cards</span>
        </button>

        <button
          onClick={() => setActiveFeature('quiz')}
          style={{
            background: activeFeature === 'quiz' ? 'rgba(102, 184, 255, 0.15)' : 'none',
            border: activeFeature === 'quiz' ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid transparent',
            color: activeFeature === 'quiz' ? '#66b8ff' : 'rgba(255, 255, 255, 0.6)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <HelpCircle size={13} />
          <span>Quiz</span>
        </button>

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('trigger-explain', {
              detail: { concept: '', resourceId, source: 'pdf' }
            }));
          }}
          style={{
            background: 'rgba(102, 184, 255, 0.06)',
            border: '1px solid rgba(102, 184, 255, 0.25)',
            color: '#66b8ff',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(102, 184, 255, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.45)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(102, 184, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.25)';
          }}
        >
          <Sparkles size={13} />
          <span>Explain</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeFeature === 'ask-pdf' ? (
          <AISidebar session={session} />
        ) : activeFeature === 'summary' ? (
          <SummaryPanel session={session} resourceType="pdf" />
        ) : activeFeature === 'flashcards' ? (
          <FlashcardPanel session={session} resourceId={resourceId} resourceType="pdf" />
        ) : activeFeature === 'quiz' ? (
          <QuizPanel session={session} resourceId={resourceId} resourceType="pdf" />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            gap: '12px',
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
              {activeFeature === 'summary' && <FileText size={24} />}
              {activeFeature === 'flashcards' && <Layers size={24} />}
              {activeFeature === 'quiz' && <HelpCircle size={24} />}
              {activeFeature === 'progress' && <TrendingUp size={24} />}
            </div>

            <h4 style={{ fontSize: '0.95rem', color: '#ffffff', margin: 0, textTransform: 'capitalize' }}>
              PDF {activeFeature} Module
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', margin: 0, maxWidth: '240px', lineHeight: '1.4' }}>
              Available in upcoming phase
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

PDFLearningPanel.displayName = 'PDFLearningPanel';
export default PDFLearningPanel;
