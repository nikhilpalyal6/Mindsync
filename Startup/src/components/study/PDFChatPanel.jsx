import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  MessageSquare, 
  Copy, 
  RefreshCw, 
  Check, 
  Sparkles,
  Bot
} from 'lucide-react';
import { getPDFChatHistory, sendPDFChatMessage } from '../../services/api';

export const PDFChatPanel = React.memo(({ session, resourceId, resourceType }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const workspaceId = session?._id;

  // Retrieve chat history when resource ID or workspace ID changes
  useEffect(() => {
    if (!workspaceId || !resourceId) return;

    const loadChatHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPDFChatHistory(workspaceId, resourceId);
        if (res?.success && res.data?.messages) {
          setMessages(res.data.messages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load PDF chat history:', err);
        setError('Failed to load chat history. Using fresh session.');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [workspaceId, resourceId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Handle auto-resizing of input box
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle Send Message
  const handleSend = async (customText = '') => {
    const textToSend = (customText || input).trim();
    if (!textToSend || !workspaceId || !resourceId || sending) return;

    if (!customText) {
      setInput('');
    }
    setSending(true);
    setError(null);

    // Optimistically add user message to list
    const tempUserMsg = {
      _id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await sendPDFChatMessage(workspaceId, resourceId, textToSend);
      if (res?.success && res.data?.assistantMessage) {
        // Sync full message history from server response
        setMessages(res.data.history || (prev => [...prev, res.data.assistantMessage]));
      }
    } catch (err) {
      console.error('Failed to send PDF chat message:', err);
      setError(err.message || 'Failed to send message. Please verify PDF has extracted text.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0) return;
    const lastUserMsg = userMsgs[userMsgs.length - 1].content;
    
    // Remove last assistant message if it exists
    if (messages[messages.length - 1]?.role === 'assistant') {
      setMessages(prev => prev.slice(0, prev.length - 1));
    }
    
    handleSend(lastUserMsg);
  };

  // Simple Markdown Parser (Lists, Bold, Italics, Code Blocks, Inline Code, Tables)
  const parseMarkdown = (text) => {
    if (!text) return '';
    let html = text;

    // Escape HTML characters to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_, lang, code) => {
      return `<pre class="code-block-wrapper"><div class="code-block-header"><span>${lang || 'code'}</span></div><code class="language-${lang}">${code}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="md-h1">$1</h1>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italics
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Markdown Tables
    html = html.replace(/((?:\|[^\n]*\|(?:\r?\n)?)+)/g, (tableText) => {
      const lines = tableText.trim().split('\n');
      if (lines.length < 2) return tableText;

      const rows = lines.map(line => {
        return line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      });

      const isSeparator = rows[1]?.every(cell => /^:?-+:?$/.test(cell));
      if (!isSeparator) return tableText;

      const headers = rows[0];
      const dataRows = rows.slice(2);

      const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      const bodyHtml = `<tbody>${dataRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;

      return `<div class="table-container"><table class="markdown-table">${headerHtml}${bodyHtml}</table></div>`;
    });

    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');

    // Paragraph Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  };

  return (
    <div className="pdf-chat-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'rgba(10, 12, 18, 0.95)',
      color: '#fff',
      overflow: 'hidden'
    }}>
      {/* 1. Header Area */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(15, 18, 26, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(102, 184, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#66b8ff',
            border: '1px solid rgba(102, 184, 255, 0.2)'
          }}>
            <Bot size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
              🤖 PDF AI Assistant
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Currently chatting with: <strong style={{ color: '#66b8ff' }}>{resourceId || 'Document.pdf'}</strong>
            </span>
          </div>
        </div>

        {messages.length > 0 && (
          <button 
            onClick={handleRegenerate}
            disabled={sending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.03)',
              color: '#fff',
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={12} className={sending ? 'spin-icon' : ''} />
            <span>Regenerate</span>
          </button>
        )}
      </div>

      {/* 2. Messages History */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {loading && messages.length === 0 ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <RefreshCw className="spin-icon" size={24} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading conversation history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', opacity: 0.6 }}>
            <MessageSquare size={36} style={{ color: 'var(--text-muted)' }} />
            <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>No messages yet</h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }}>
              Ask questions directly from this PDF. The assistant only answers using the document context.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg._id || msg.timestamp} 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                  gap: '4px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  padding: '0 4px'
                }}>
                  <span>{isUser ? 'You' : 'PDF Assistant'}</span>
                  <span>•</span>
                  <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>

                <div 
                  className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    backgroundColor: isUser ? 'var(--accent-blue)' : 'rgba(255,255,255,0.03)',
                    border: isUser ? 'none' : '1px solid var(--glass-border)',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    position: 'relative'
                  }}
                >
                  <div 
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} 
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  />

                  {/* Actions row inside message */}
                  {!isUser && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                      paddingTop: '6px',
                      gap: '8px'
                    }}>
                      <button 
                        onClick={() => handleCopy(msg._id, msg.content)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem'
                        }}
                      >
                        {copiedId === msg._id ? <Check size={10} style={{ color: 'var(--accent-green)' }} /> : <Copy size={10} />}
                        <span>{copiedId === msg._id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 4px' }}>PDF Assistant</span>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span className="dot-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block' }}></span>
              <span className="dot-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block', animationDelay: '0.2s' }}></span>
              <span className="dot-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block', animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(245, 101, 101, 0.1)',
            border: '1px solid rgba(245, 101, 101, 0.2)',
            borderRadius: '8px',
            color: '#f56565',
            fontSize: '0.75rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Bar Area */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--glass-border)',
        background: 'rgba(15, 18, 26, 0.85)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '8px 12px'
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI about this PDF... (Ctrl+Enter to send)"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '0.85rem',
              resize: 'none',
              outline: 'none',
              maxHeight: '200px',
              fontFamily: 'inherit',
              padding: '4px 0'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            style={{
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: input.trim() && !sending ? 'var(--accent-blue)' : 'rgba(255,255,255,0.04)',
              color: input.trim() && !sending ? '#fff' : 'var(--text-muted)',
              border: 'none',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 4px' }}>
          <span>Press Enter to wrap line</span>
          <span>Ctrl + Enter to send message</span>
        </div>
      </div>
    </div>
  );
});

PDFChatPanel.displayName = 'PDFChatPanel';
export default PDFChatPanel;
