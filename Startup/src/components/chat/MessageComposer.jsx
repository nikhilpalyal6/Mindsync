import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export const MessageComposer = React.memo(({ onSendMessage, loading = false, disabled = false }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const MAX_CHARS = 4000;

  // Auto-grow textarea height up to 180px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || loading || disabled || text.length > MAX_CHARS) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = text.length > MAX_CHARS;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '14px 18px',
      backgroundColor: 'rgba(15, 20, 30, 0.85)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(16px)',
      width: '100%'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: isOverLimit ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '14px',
        padding: '10px 14px',
        transition: 'all 0.2s ease',
        boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.2)'
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MindSync AI Co-Pilot... (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={loading || disabled}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '0.925rem',
            fontFamily: 'inherit',
            resize: 'none',
            maxHeight: '180px',
            lineHeight: '1.55',
            padding: 0
          }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || loading || disabled || isOverLimit}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: (!text.trim() || loading || disabled || isOverLimit) ? 'rgba(255,255,255,0.06)' : '#66b8ff',
            color: (!text.trim() || loading || disabled || isOverLimit) ? 'rgba(255,255,255,0.3)' : '#000000',
            border: 'none',
            cursor: (!text.trim() || loading || disabled || isOverLimit) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          aria-label="Send message"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>

      {/* Character Count & Shortcut Hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'rgba(255,255,255,0.5)', padding: '0 4px' }}>
        <span>Press <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Enter ↵</strong> to send</span>
        <span style={{ color: isOverLimit ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
          {text.length} / {MAX_CHARS}
        </span>
      </div>
    </div>
  );
});

MessageComposer.displayName = 'MessageComposer';
export default MessageComposer;
