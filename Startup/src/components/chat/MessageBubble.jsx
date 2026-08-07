import React, { useState } from 'react';
import { Sparkles, User, Copy, Check, Edit2, RotateCw, ThumbsUp, Bookmark } from 'lucide-react';

const keyframes = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Helper to parse inline Markdown (bold, italic, inline code, inline math)
const parseInline = (text) => {
  if (!text) return '';
  // Split on **bold**, *italic*, `code`, or $math$
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$.*?\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: '#ffffff', fontWeight: 650 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ color: 'rgba(255, 255, 255, 0.85)', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '5px',
          padding: '2px 5px',
          fontSize: '0.8rem',
          color: '#a78bfa',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      return (
        <span key={i} style={{
          fontFamily: '"Times New Roman", Times, Georgia, serif',
          fontStyle: 'italic',
          color: '#e9d5ff',
          padding: '0 2px',
          fontSize: '0.95rem'
        }}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
};

// Zero-Dependency Markdown Renderer with enhanced code, tables, headings, and lists
const renderMarkdown = (text = '') => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let tableRows = [];

  lines.forEach((line, idx) => {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-wrap-${idx}`} style={{ overflowX: 'auto', width: '100%', margin: '12px 0' }}>
            <pre style={{
              backgroundColor: 'rgba(10, 14, 23, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '0.825rem',
              color: '#d8b4fe',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: '1.6',
              overflowX: 'auto',
              margin: 0,
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.4)'
            }}>
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Markdown Table lines
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableRows.push(line);
      // Check if next line is not a table line, or if this is the last line
      const nextLine = lines[idx + 1];
      if (!nextLine || !nextLine.trim().startsWith('|')) {
        // Process table
        const rows = tableRows.filter(r => !r.includes('---'));
        elements.push(
          <div key={`table-${idx}`} style={{ overflowX: 'auto', margin: '12px 0', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', border: '1px solid rgba(255,255,255,0.06)' }}>
              <tbody>
                {rows.map((rowStr, rIdx) => {
                  const cols = rowStr.split('|').filter((_, cI) => cI > 0 && cI < rowStr.split('|').length - 1);
                  const isHeader = rIdx === 0;
                  return (
                    <tr key={rIdx} style={{
                      backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      {cols.map((col, cIdx) => (
                        <td key={cIdx} style={{
                          padding: '8px 12px',
                          fontWeight: isHeader ? 600 : 400,
                          color: isHeader ? '#ffffff' : 'rgba(255, 255, 255, 0.85)'
                        }}>
                          {parseInline(col.trim())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', margin: '14px 0 6px 0' }}>{parseInline(line.replace('### ', ''))}</h4>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={idx} style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', margin: '16px 0 6px 0' }}>{parseInline(line.replace('## ', ''))}</h3>);
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={idx} style={{ fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', margin: '18px 0 8px 0' }}>{parseInline(line.replace('# ', ''))}</h2>);
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} style={{
          borderLeft: '2px solid #66b8ff',
          backgroundColor: 'rgba(102, 184, 255, 0.03)',
          padding: '6px 12px',
          borderRadius: '0 6px 6px 0',
          margin: '10px 0',
          color: 'rgba(255, 255, 255, 0.8)',
          fontStyle: 'italic',
          fontSize: '0.85rem'
        }}>
          {parseInline(line.replace('> ', ''))}
        </blockquote>
      );
      return;
    }

    // Unordered List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <li key={idx} style={{ marginLeft: '16px', margin: '3px 0', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.875rem' }}>
          {parseInline(line.trim().substring(2))}
        </li>
      );
      return;
    }

    // Ordered List
    const matchOrdered = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (matchOrdered) {
      elements.push(
        <div key={idx} style={{ display: 'flex', gap: '6px', marginLeft: '8px', margin: '3px 0', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.875rem' }}>
          <span style={{ fontWeight: 600, color: '#66b8ff', minWidth: '16px' }}>{matchOrdered[1]}.</span>
          <span>{parseInline(matchOrdered[2])}</span>
        </div>
      );
      return;
    }

    // Regular Paragraph
    if (line.trim().length > 0) {
      elements.push(
        <p key={idx} style={{ margin: '6px 0', lineHeight: '1.6', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.85)' }}>
          {parseInline(line)}
        </p>
      );
    }
  });

  return <>{elements}</>;
};

export const MessageBubble = React.memo(({ message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
        <span style={{
          fontSize: '0.7rem',
          color: 'rgba(255, 255, 255, 0.4)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          padding: '3px 12px',
          borderRadius: '10px'
        }}>
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      margin: '12px 0',
      width: '100%',
      animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      
      <div style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '10px',
        maxWidth: '85%'
      }}>
        {/* Simple Premium Avatar Badge */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: isUser ? 'rgba(102, 184, 255, 0.08)' : 'rgba(167, 139, 250, 0.08)',
          border: isUser ? '1px solid rgba(102, 184, 255, 0.15)' : '1px solid rgba(167, 139, 250, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isUser ? '#66b8ff' : '#a78bfa',
          flexShrink: 0,
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          {isUser ? <User size={12} /> : <Sparkles size={12} />}
        </div>

        {/* Message Bubble Body */}
        <div style={{
          backgroundColor: isUser ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
          border: isUser ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
          borderRadius: '16px',
          padding: isUser ? '10px 14px' : '0 6px 10px 6px',
          color: '#ffffff',
          fontSize: '0.875rem',
          lineHeight: '1.6',
          boxShadow: isUser ? '0 4px 16px rgba(0, 0, 0, 0.25)' : 'none',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '14px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isUser ? '#66b8ff' : '#a78bfa' }}>
              {isUser ? 'You' : 'MindSync AI'}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.35)' }}>
              {new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Formatted Content */}
          <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {renderMarkdown(message.content)}
          </div>

          {/* Action Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.03)'
          }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : 'rgba(255,255,255,0.3)',
                fontSize: '0.675rem',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px'
              }}
              title="Copy Message"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
