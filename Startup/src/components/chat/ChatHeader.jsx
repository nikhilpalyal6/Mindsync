import React from 'react';
import { Sparkles, MessageSquare, Plus, ChevronDown } from 'lucide-react';

export const ChatHeader = React.memo(({ 
  sessionTitle, 
  activeConversation, 
  conversations = [], 
  onSelectConversation, 
  onCreateConversation,
  onOpenConversationManager 
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: 'rgba(20, 25, 35, 0.7)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      backdropFilter: 'blur(12px)',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Left Title & Conversation Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.2), rgba(72, 239, 179, 0.2))',
          border: '1px solid rgba(102, 184, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#66b8ff',
          flexShrink: 0
        }}>
          <Sparkles size={18} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>
              {sessionTitle || 'Study Workspace'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onOpenConversationManager}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                padding: 0
              }}
              title="Click to switch conversation thread"
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                {activeConversation?.title || 'General Discussion'}
              </span>
              <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Controls & Provider Placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onCreateConversation}
          className="admin-btn admin-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
          title="New Conversation Thread"
        >
          <Plus size={14} />
          <span>New Thread</span>
        </button>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: 'rgba(102, 184, 255, 0.08)',
          border: '1px solid rgba(102, 184, 255, 0.2)',
          color: '#66b8ff',
          fontSize: '0.725rem',
          fontWeight: 600
        }}>
          <Sparkles size={12} />
          <span>MindSync AI Engine (Phase 3.2.2)</span>
        </div>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
export default ChatHeader;
