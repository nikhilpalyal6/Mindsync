import React, { useMemo } from 'react';
import { Sparkles, Plus, ChevronDown, Bot } from 'lucide-react';

export const ChatHeader = React.memo(({ 
  sessionTitle, 
  activeConversation, 
  conversations = [], 
  activeResource,
  onSelectConversation, 
  onCreateConversation,
  onOpenConversationManager 
}) => {
  // Determine resource metadata for the context card
  const resourceType = activeResource?.type || 'pdf';
  
  const resourceIcon = useMemo(() => {
    if (resourceType === 'youtube') return '🎥';
    if (resourceType === 'notes') return '📝';
    return '📄';
  }, [resourceType]);

  const resourceTitle = useMemo(() => {
    if (activeResource) {
      return activeResource.title || 'Untitled Resource';
    }
    return 'Document.pdf';
  }, [activeResource]);

  const badges = useMemo(() => {
    const list = [];
    if (resourceType === 'pdf') {
      const pageCount = activeResource?.data?.pageCount || 33;
      const bytes = activeResource?.data?.fileSize || 3000000;
      const sizeStr = bytes > 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
      
      list.push({ text: 'Indexed', bg: 'rgba(102, 184, 255, 0.1)', border: '1px solid rgba(102, 184, 255, 0.2)', color: '#66b8ff' });
      list.push({ text: `${pageCount} Pages` });
      list.push({ text: sizeStr });
    } else if (resourceType === 'youtube') {
      list.push({ text: 'Transcript Ready', bg: 'rgba(72, 239, 179, 0.1)', border: '1px solid rgba(72, 239, 179, 0.2)', color: '#48efb3' });
      list.push({ text: 'AI Ready' });
    } else if (resourceType === 'notes') {
      list.push({ text: 'Indexed', bg: 'rgba(102, 184, 255, 0.1)', border: '1px solid rgba(102, 184, 255, 0.2)', color: '#66b8ff' });
      list.push({ text: 'Markdown' });
    }
    return list;
  }, [resourceType, activeResource]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 16px',
      background: 'rgba(15, 20, 30, 0.45)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Top Row: Title, Dropdown & Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: '12px'
      }}>
        
        {/* Left Side: Brand Icon & Dropdown Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.15), rgba(167, 139, 250, 0.15))',
            border: '1px solid rgba(102, 184, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#66b8ff',
            flexShrink: 0
          }}>
            <Bot size={15} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              Thread:
            </span>
            <button
              onClick={onOpenConversationManager}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                maxWidth: '140px',
                transition: 'all 0.2s ease'
              }}
              title="Click to switch conversation thread"
              className="thread-dropdown-btn"
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeConversation?.title || 'General Chat'}
              </span>
              <ChevronDown size={11} style={{ opacity: 0.6 }} />
            </button>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
              ({conversations.length} threads)
            </span>
          </div>
        </div>

        {/* Right Side: New Thread button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onCreateConversation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '0.725rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255,255,255,0.85)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
            className="composer-accessory-btn"
            title="New Conversation Thread"
          >
            <Plus size={11} />
            <span>New Thread</span>
          </button>
        </div>

      </div>

      {/* Bottom Context Card */}
      {activeResource && (
        <div style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.015)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.02)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{resourceIcon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
              <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Currently Studying</span>
              <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                {resourceTitle}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
            {badges.map((badge, idx) => (
              <span 
                key={idx} 
                style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  backgroundColor: badge.bg || 'rgba(255,255,255,0.03)',
                  border: badge.border || '1px solid rgba(255,255,255,0.05)',
                  color: badge.color || 'rgba(255,255,255,0.6)'
                }}
              >
                {badge.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
export default ChatHeader;
