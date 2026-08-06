import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import ChatHeader from './ChatHeader';
import ConversationList from './ConversationList';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import EmptyConversation from './EmptyConversation';
import TypingIndicator from './TypingIndicator';
import { 
  getAIConversations, 
  createAIConversation, 
  updateAIConversation, 
  deleteAIConversation, 
  getAIMessages, 
  sendAIMessage 
} from '../../services/api';

export const ChatLayout = React.memo(({ session, activeResource }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const messagesEndRef = useRef(null);

  // Derive active resource type and ID dynamically
  const activeResourceType = (activeResource?.type || session?.metadata?.activeResourceType || session?.metadata?.lastTab || 'pdf').toLowerCase();
  let resourceId = '';

  if (activeResource) {
    if (activeResource.type === 'pdf') {
      resourceId = activeResource.title || '';
    } else if (activeResource.type === 'youtube') {
      resourceId = activeResource.url || activeResource.title || '';
    } else if (activeResource.type === 'notes') {
      resourceId = activeResource._id || 'default_notes_id';
    }
  } else {
    if (activeResourceType === 'pdf' && session?.metadata?.pdf) {
      resourceId = session.metadata.pdf.pdfFilename || session.metadata.pdf.filename || '';
    } else if (activeResourceType === 'youtube' && session?.metadata?.youtube) {
      resourceId = session.metadata.youtube.videoUrl || '';
    } else if (activeResourceType === 'notes') {
      resourceId = session?.metadata?.notes?.noteId || 'default_notes_id';
    }
  }

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Fetch conversations for current study session
  const fetchConversations = useCallback(async () => {
    if (!session?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAIConversations(session._id, resourceId);
      const convList = res || [];
      setConversations(convList);

      if (convList.length > 0) {
        // Select first thread for this resource
        const current = convList[0];
        setActiveConversation(current);
        console.log(`[Existing Conversation Loaded] Restored conversation ${current._id} for resource ${resourceId}`);
      } else {
        // Create initial primary conversation automatically if none exists for this resource
        const newConv = await createAIConversation({
          studySessionId: session._id,
          resourceId,
          title: resourceId ? `${activeResourceType.toUpperCase()} Chat` : 'General Discussion'
        });
        setConversations([newConv]);
        setActiveConversation(newConv);
        console.log(`[Resource Conversation Created] Created conversation ${newConv._id} for resource ${resourceId}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [session?._id, resourceId, activeResourceType]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async () => {
    if (!activeConversation?._id) return;
    try {
      const res = await getAIMessages(activeConversation._id);
      setMessages(res || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [activeConversation?._id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Create new thread
  const handleCreateThread = async () => {
    if (!session?._id) return;
    try {
      const title = `Chat - ${conversations.length + 1}`;
      const res = await createAIConversation({ studySessionId: session._id, resourceId, title });
      const newConv = res;
      setConversations(prev => [newConv, ...prev]);
      setActiveConversation(newConv);
      setMessages([]);
      setShowManager(false);
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  };

  // Rename thread
  const handleRenameThread = async (id, newTitle) => {
    try {
      await updateAIConversation(id, { title: newTitle });
      setConversations(prev => prev.map(c => c._id === id ? { ...c, title: newTitle } : c));
      if (activeConversation?._id === id) {
        setActiveConversation(prev => ({ ...prev, title: newTitle }));
      }
    } catch (err) {
      console.error('Failed to rename thread:', err);
    }
  };

  // Delete thread
  const handleDeleteThread = async (id) => {
    try {
      await deleteAIConversation(id);
      const remaining = conversations.filter(c => c._id !== id);
      setConversations(remaining);
      if (activeConversation?._id === id) {
        setActiveConversation(remaining[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  };

  // Send message
  const handleSendMessage = async (text) => {
    if (!activeConversation?._id || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendAIMessage({
        conversationId: activeConversation._id,
        content: text.trim()
      });

      if (res?.userMessage && res?.assistantMessage) {
        setMessages(prev => [...prev, res.userMessage, res.assistantMessage]);
      } else {
        await fetchMessages();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSelectPrompt = (promptText) => {
    // Populate input via custom event or direct ref trigger
    const inputElement = document.querySelector('textarea[placeholder*="Ask MindSync AI"]');
    if (inputElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(inputElement, promptText);
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.focus();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: 'rgba(20, 25, 35, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <ChatHeader
        sessionTitle={session?.title}
        activeConversation={activeConversation}
        conversations={conversations}
        onSelectConversation={setActiveConversation}
        onCreateConversation={handleCreateThread}
        onOpenConversationManager={() => setShowManager(true)}
      />

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
            Loading conversation...
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto', gap: '10px' }}>
            <AlertTriangle size={24} style={{ color: '#ef4444' }} />
            <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>
            <button onClick={fetchConversations} className="admin-btn admin-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyConversation onSelectPrompt={handleSelectPrompt} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {messages.map((msg, i) => (
              <MessageBubble key={msg._id || i} message={msg} />
            ))}
            {sending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input Composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        loading={sending}
        disabled={loading || !activeConversation}
      />

      {/* Threads Manager Modal */}
      {showManager && (
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversation?._id}
          onSelect={setActiveConversation}
          onCreate={handleCreateThread}
          onRename={handleRenameThread}
          onDelete={handleDeleteThread}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
});

ChatLayout.displayName = 'ChatLayout';
export default ChatLayout;
