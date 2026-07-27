import React from 'react';
import { Sparkles, HelpCircle, FileText, Layers, BookOpen } from 'lucide-react';

export const EmptyConversation = React.memo(({ onSelectPrompt }) => {
  const prompts = [
    { label: 'Explain this topic', desc: 'Break down complex concepts into simple terms', icon: HelpCircle },
    { label: 'Summarize my notes', desc: 'Compile key points into concise bullet points', icon: FileText },
    { label: 'Generate quiz', desc: 'Test your understanding with practice questions', icon: BookOpen },
    { label: 'Create flashcards', desc: 'Build quick memory cards for key terms', icon: Layers },
  ];

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
      maxWidth: '560px'
    }}>
      {/* Icon Badge */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.2), rgba(167, 139, 250, 0.2))',
        border: '1px solid rgba(102, 184, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#66b8ff'
      }}>
        <Sparkles size={28} />
      </div>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', margin: 0 }}>
          Welcome to MindSync AI
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)', margin: '6px 0 0 0' }}>
          Start your first conversation. Select a suggested prompt or type your question below.
        </p>
      </div>

      {/* Prompts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '10px',
        width: '100%'
      }}>
        {prompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(p.label)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className="prompt-chip-btn"
            >
              <Icon size={16} style={{ color: '#66b8ff', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: '0.725rem', color: 'rgba(255, 255, 255, 0.4)' }}>{p.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

EmptyConversation.displayName = 'EmptyConversation';
export default EmptyConversation;
