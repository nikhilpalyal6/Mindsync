import React from 'react';
import { Sparkles } from 'lucide-react';

export const TypingIndicator = React.memo(() => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      margin: '12px 0',
      maxWidth: '85%'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a78bfa',
        flexShrink: 0
      }}>
        <Sparkles size={16} />
      </div>

      <div style={{
        backgroundColor: 'rgba(20, 25, 35, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#66b8ff', animation: 'bounce 1.4s infinite ease-in-out' }} />
        <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#66b8ff', animation: 'bounce 1.4s infinite ease-in-out 0.2s' }} />
        <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#66b8ff', animation: 'bounce 1.4s infinite ease-in-out 0.4s' }} />
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';
export default TypingIndicator;
