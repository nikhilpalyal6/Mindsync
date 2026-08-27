import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';

export default function StudyRoomChat({
  messages = [],
  onSendMessage,
  onDeleteMessage,
  currentUserId,
  isHost,
  isAdmin,
  participants = [],
  selectedChatUser = 'everyone',
  onSelectChatUser
}) {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  // Filter active student participants (exclude self, admins, inactive users)
  const activeStudents = participants.filter((p) => {
    if (p.status !== 'active' && p.status !== 'joined') return false;
    if (p.user?._id && String(p.user._id) === String(currentUserId)) return false;
    if (p.user?.role === 'ADMIN' || p.user?.role === 'SUPER_ADMIN') return false;
    return true;
  });

  const activeRecipient = activeStudents.find(
    (p) => String(p.user?._id || p.user) === String(selectedChatUser)
  );

  const activeRecipientName = activeRecipient
    ? activeRecipient.user?.name || activeRecipient.user?.username || 'User'
    : '';

  // Filter messages belonging to the selected chat conversation
  const filteredMessages = messages.filter((msg) => {
    const senderId = msg.sender?._id || msg.sender;
    const recipientId = msg.recipientId || null;

    if (selectedChatUser === 'everyone') {
      return !recipientId;
    }

    if (!recipientId) return false;

    const isSentByMeToRecipient =
      String(senderId) === String(currentUserId) &&
      String(recipientId) === String(selectedChatUser);
    const isReceivedByMeFromRecipient =
      String(senderId) === String(selectedChatUser) &&
      String(recipientId) === String(currentUserId);

    return isSentByMeToRecipient || isReceivedByMeFromRecipient;
  });

  // Auto-scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const showModeratorControls = isAdmin;

  return (
    <div className="workspace-chat-card" style={{
      background: '#0d1326',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: '350px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="chat-header" style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0a0f1d'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={14} style={{ color: selectedChatUser === 'everyone' ? 'var(--admin-accent)' : '#10b981' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>STUDY CHAT</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontStyle: 'italic' }}>
          {selectedChatUser === 'everyone' ? 'Study-only Discussion' : 'Direct Message'}
        </span>
      </div>

      {/* Participant Selector */}
      <div className="chat-selector-container" style={{
        padding: '8px 12px',
        background: '#090d1a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 500 }}>Chat with:</span>
        <select
          value={selectedChatUser}
          onChange={(e) => onSelectChatUser(e.target.value)}
          style={{
            background: '#0d1326',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            fontSize: '0.74rem',
            padding: '4px 8px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="everyone">Everyone</option>
          {activeStudents.map((p) => (
            <option key={p.user?._id || p._id} value={p.user?._id || p.user}>
              {p.user?.name || p.user?.username || 'User'}
            </option>
          ))}
        </select>
      </div>

      {/* Messages area */}
      <div className="chat-messages-container" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {filteredMessages.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '0.78rem',
            fontStyle: 'italic',
            opacity: 0.6
          }}>
            {selectedChatUser === 'everyone'
              ? 'No messages yet. Ask a study question!'
              : `Private conversation with ${activeRecipientName || 'User'}`}
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            const isSelf = String(senderId) === String(currentUserId);
            const senderName = msg.sender?.name || msg.sender?.username || 'User';
            const avatar = msg.sender?.profileImage || msg.sender?.avatar;
            const isDirect = !!msg.recipientId;

            return (
              <div
                key={msg._id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isSelf ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                {/* Sender Name */}
                <span style={{
                  fontSize: '0.68rem',
                  color: isDirect ? '#10b981' : '#9ca3af',
                  marginBottom: '2px',
                  marginLeft: '4px',
                  marginRight: '4px'
                }}>
                  {senderName} {isSelf && '(You)'} {isDirect && '→ Direct Message'}
                </span>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexDirection: isSelf ? 'row-reverse' : 'row',
                  maxWidth: '85%'
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    backgroundImage: avatar ? `url(${avatar})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0
                  }}>
                    {!avatar && senderName.charAt(0).toUpperCase()}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    background: isSelf
                      ? (isDirect ? '#065f46' : 'var(--admin-primary)')
                      : (isDirect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)'),
                    border: isDirect ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: '0.8rem',
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {msg.message}
                  </div>

                  {/* Time / Moderate Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                    {showModeratorControls && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg._id)}
                        title="Delete Message"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          opacity: 0.5,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input container */}
      <form onSubmit={handleSend} style={{
        padding: '10px 12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        gap: '8px',
        background: '#0a0f1d'
      }}>
        <input
          type="text"
          placeholder={selectedChatUser === 'everyone' ? "Ask a study question..." : `Message ${activeRecipientName || 'User'}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            color: '#fff',
            padding: '8px 12px',
            fontSize: '0.8rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            background: selectedChatUser === 'everyone' ? 'var(--admin-primary)' : '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
