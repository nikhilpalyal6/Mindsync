import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, Mic, Square } from 'lucide-react';

export const MessageComposer = React.memo(({ onSendMessage, loading = false, disabled = false, onStopGeneration }) => {
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
      width: '100%',
      backgroundColor: 'transparent',
      padding: '0 16px 16px 16px',
      boxSizing: 'border-box'
    }}>
      {/* Premium Glass Input Shell */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'linear-gradient(135deg, rgba(20, 26, 38, 0.7), rgba(15, 20, 30, 0.8))',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: isOverLimit ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '12px 16px',
        boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }} className="floating-composer-container">
        
        {/* Text Input Row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px'
        }}>
          {/* Attachment Paperclip Button */}
          <button
            type="button"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              padding: 0
            }}
            className="composer-accessory-btn"
            title="Attach File"
          >
            <Paperclip size={14} />
          </button>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MindSync AI Co-Pilot... (Enter to send)"
            rows={1}
            disabled={loading || disabled}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'none',
              maxHeight: '180px',
              lineHeight: '1.6',
              padding: '6px 0',
              boxSizing: 'border-box'
            }}
          />

          {/* Voice Mic Button (Placeholder) */}
          <button
            type="button"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              padding: 0
            }}
            className="composer-accessory-btn"
            title="Voice Dictation (Coming Soon)"
          >
            <Mic size={14} />
          </button>

          {/* Send / Stop Generation Button */}
          {loading ? (
            <button
              onClick={onStopGeneration}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                padding: 0
              }}
              title="Stop Generation"
              aria-label="Stop generation"
            >
              <Square size={12} fill="#ef4444" stroke="none" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim() || disabled || isOverLimit}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: (!text.trim() || disabled || isOverLimit) ? 'rgba(255,255,255,0.03)' : '#66b8ff',
                color: (!text.trim() || disabled || isOverLimit) ? 'rgba(255,255,255,0.25)' : '#0f121a',
                border: 'none',
                cursor: (!text.trim() || disabled || isOverLimit) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
                padding: 0
              }}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>

        {/* Footer Details Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.675rem',
          color: 'rgba(255,255,255,0.35)',
          padding: '0 4px',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          paddingTop: '8px',
          marginTop: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Tokens: <strong>{Math.round(text.length / 4)}</strong></span>
            <span>•</span>
            <span>Shortcut: <strong>Enter ↵</strong></span>
          </div>
          <span style={{ color: isOverLimit ? '#ef4444' : 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
            {text.length} / {MAX_CHARS}
          </span>
        </div>

      </div>
    </div>
  );
});

MessageComposer.displayName = 'MessageComposer';
export default MessageComposer;
