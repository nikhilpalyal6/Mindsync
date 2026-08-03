import React, { useState } from 'react';
import { MessageSquare, FileText, Layers, HelpCircle, TrendingUp, Sparkles, Edit3 } from 'lucide-react';
import AISidebar from '../ai/AISidebar';
import SummaryPanel from '../summary/SummaryPanel';
import FlashcardPanel from '../summary/FlashcardPanel';
import QuizPanel from '../summary/QuizPanel';

export const NotesLearningPanel = React.memo(({ session }) => {
  const [activeFeature, setActiveFeature] = useState('ask-notes');
  const resourceId = session?.metadata?.notes?.noteId || 'default_notes_id';

  return (
    <div className="notes-learning-panel" style={{
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
          <Sparkles size={16} style={{ color: '#a78bfa' }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Notes AI Workspace
          </h3>
        </div>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.12)',
          border: '1px solid rgba(167, 139, 250, 0.25)',
          padding: '2px 8px',
          borderRadius: '4px'
        }}>
          {activeFeature === 'ask-notes' ? 'Ask Notes Active' : `${activeFeature} active`}
        </span>
      </div>

      {/* Navigation Tools Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(20, 25, 35, 0.5)',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveFeature('ask-notes')}
          style={{
            background: activeFeature === 'ask-notes' ? 'rgba(167, 139, 250, 0.15)' : 'none',
            border: activeFeature === 'ask-notes' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
            color: activeFeature === 'ask-notes' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
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
          <span>Ask Notes</span>
        </button>

        <button
          onClick={() => setActiveFeature('summary')}
          style={{
            background: activeFeature === 'summary' ? 'rgba(167, 139, 250, 0.15)' : 'none',
            border: activeFeature === 'summary' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
            color: activeFeature === 'summary' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
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
            background: activeFeature === 'flashcards' ? 'rgba(167, 139, 250, 0.15)' : 'none',
            border: activeFeature === 'flashcards' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
            color: activeFeature === 'flashcards' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
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
          <span>Flashcards</span>
        </button>

        <button
          onClick={() => setActiveFeature('quiz')}
          style={{
            background: activeFeature === 'quiz' ? 'rgba(167, 139, 250, 0.15)' : 'none',
            border: activeFeature === 'quiz' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
            color: activeFeature === 'quiz' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
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
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeFeature === 'ask-notes' ? (
          <AISidebar session={session} />
        ) : activeFeature === 'summary' ? (
          <SummaryPanel session={session} resourceType="notes" />
        ) : activeFeature === 'flashcards' ? (
          <FlashcardPanel session={session} resourceId={resourceId} resourceType="notes" />
        ) : activeFeature === 'quiz' ? (
          <QuizPanel session={session} resourceId={resourceId} resourceType="notes" />
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
              Notes {activeFeature} Module
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

NotesLearningPanel.displayName = 'NotesLearningPanel';
export default NotesLearningPanel;
