import React from 'react';
import { Sparkles, HelpCircle, FileText, Layers, BookOpen } from 'lucide-react';

export const EmptyConversation = React.memo(({ onSelectPrompt, prompts, resourceType = 'pdf' }) => {
  const defaultPrompts = [
    { label: 'Explain this topic', desc: 'Break down complex concepts into simple terms', icon: HelpCircle },
    { label: 'Summarize my notes', desc: 'Compile key points into concise bullet points', icon: FileText },
    { label: 'Generate quiz', desc: 'Test your understanding with practice questions', icon: BookOpen },
    { label: 'Create flashcards', desc: 'Build quick memory cards for key terms', icon: Layers },
  ];

  const listToRender = prompts || defaultPrompts;

  const headerTitle = React.useMemo(() => {
    if (resourceType === 'pdf') return 'Ask anything about this PDF';
    if (resourceType === 'youtube') return 'Ask anything about this Video';
    if (resourceType === 'notes') return 'Ask anything about your Notes';
    return 'Ask anything about this Resource';
  }, [resourceType]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1.5rem',
      textAlign: 'center',
      gap: '1.5rem',
      margin: 'auto',
      maxWidth: '560px',
      height: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Icon Badge */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.15), rgba(167, 139, 250, 0.15))',
        border: '1px solid rgba(102, 184, 255, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#66b8ff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <Sparkles size={24} />
      </div>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: 0 }}>
          {headerTitle}
        </h2>
        <p style={{ fontSize: '0.825rem', color: 'rgba(255, 255, 255, 0.45)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
          Select a quick action card below or type your question in the box to begin.
        </p>
      </div>

      {/* Prompts Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '8px',
        width: '100%'
      }}>
        {listToRender.map((p, idx) => {
          const Icon = p.icon || Sparkles;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(p.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '20px',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.775rem',
                fontWeight: 500
              }}
              className="prompt-chip-btn"
            >
              <Icon size={13} style={{ color: '#66b8ff', flexShrink: 0 }} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

EmptyConversation.displayName = 'EmptyConversation';
export default EmptyConversation;
