import React, { useState } from 'react';
import { Sparkles, User, Copy, Check, Edit2, RotateCw, ThumbsUp, Bookmark } from 'lucide-react';

// Helper to parse inline Markdown (bold, italic, inline code)
const parseInline = (text) => {
  if (!text) return '';
  // Split on **bold**, *italic*, or `code`
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: '#ffffff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '0.825rem',
          color: '#a78bfa',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }}>
          {part.slice(1, -1)}
        </code>
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
              backgroundColor: 'rgba(10, 14, 23, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: '#c084fc',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              lineHeight: '1.5',
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <tbody>
                {rows.map((rowStr, rIdx) => {
                  const cols = rowStr.split('|').filter((_, cI) => cI > 0 && cI < rowStr.split('|').length - 1);
                  const isHeader = rIdx === 0;
                  return (
                    <tr key={rIdx} style={{
                      backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      {cols.map((col, cIdx) => (
                        <td key={cIdx} style={{
                          padding: '8px 12px',
                          fontWeight: isHeader ? 700 : 400,
                          color: isHeader ? '#ffffff' : 'rgba(255, 255, 255, 0.9)'
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
      elements.push(<h4 key={idx} style={{ fontSize: '1.025rem', fontWeight: 700, color: '#ffffff', margin: '14px 0 6px 0' }}>{parseInline(line.replace('### ', ''))}</h4>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={idx} style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '16px 0 6px 0' }}>{parseInline(line.replace('## ', ''))}</h3>);
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={idx} style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: '18px 0 8px 0' }}>{parseInline(line.replace('# ', ''))}</h2>);
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} style={{
          borderLeft: '3px solid #66b8ff',
          backgroundColor: 'rgba(102, 184, 255, 0.06)',
          padding: '8px 14px',
          borderRadius: '0 6px 6px 0',
          margin: '10px 0',
          color: 'rgba(255, 255, 255, 0.85)',
          fontStyle: 'italic'
        }}>
          {parseInline(line.replace('> ', ''))}
        </blockquote>
      );
      return;
    }

    // Unordered List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <li key={idx} style={{ marginLeft: '20px', margin: '4px 0', lineHeight: '1.65', color: 'rgba(255, 255, 255, 0.95)' }}>
          {parseInline(line.trim().substring(2))}
        </li>
      );
      return;
    }

    // Ordered List (e.g., 1. Item)
    const matchOrdered = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (matchOrdered) {
      elements.push(
        <div key={idx} style={{ display: 'flex', gap: '8px', marginLeft: '12px', margin: '4px 0', lineHeight: '1.65', color: 'rgba(255, 255, 255, 0.95)' }}>
          <span style={{ fontWeight: 600, color: '#66b8ff', minWidth: '18px' }}>{matchOrdered[1]}.</span>
          <span>{parseInline(matchOrdered[2])}</span>
        </div>
      );
      return;
    }

    // Regular Paragraph
    if (line.trim().length > 0) {
      elements.push(
        <p key={idx} style={{ margin: '8px 0', lineHeight: '1.65', fontSize: '0.9375rem', color: 'rgba(255, 255, 255, 0.95)' }}>
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
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '4px 14px',
          borderRadius: '12px'
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
      margin: '16px 0',
      width: '100%'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '12px',
        maxWidth: '88%'
      }}>
        {/* Avatar */}
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          backgroundColor: isUser ? 'rgba(102, 184, 255, 0.15)' : 'rgba(167, 139, 250, 0.15)',
          border: isUser ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isUser ? '#66b8ff' : '#a78bfa',
          flexShrink: 0
        }}>
          {isUser ? <User size={18} /> : <Sparkles size={18} />}
        </div>

        {/* Message Bubble Body */}
        <div style={{
          backgroundColor: isUser ? 'rgba(102, 184, 255, 0.12)' : 'rgba(20, 25, 35, 0.85)',
          border: isUser ? '1px solid rgba(102, 184, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: '14px 18px',
          color: '#fff',
          fontSize: '0.9375rem',
          lineHeight: '1.65',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '14px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isUser ? '#66b8ff' : '#a78bfa' }}>
              {isUser ? 'You' : 'MindSync AI Co-Pilot'}
            </span>
            <span style={{ fontSize: '0.675rem', color: 'rgba(255, 255, 255, 0.45)' }}>
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
            gap: '8px',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : 'rgba(255,255,255,0.45)',
                fontSize: '0.725rem',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px'
              }}
              title="Copy Message"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>•</span>

            <button disabled style={{ opacity: 0.3, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed', padding: '2px' }} title="Edit">
              <Edit2 size={13} />
            </button>
            {!isUser && (
              <button disabled style={{ opacity: 0.3, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed', padding: '2px' }} title="Regenerate">
                <RotateCw size={13} />
              </button>
            )}
            <button disabled style={{ opacity: 0.3, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed', padding: '2px' }} title="React">
              <ThumbsUp size={13} />
            </button>
            <button disabled style={{ opacity: 0.3, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed', padding: '2px' }} title="Bookmark">
              <Bookmark size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
