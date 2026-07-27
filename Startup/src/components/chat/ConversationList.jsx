import React, { useState } from 'react';
import { MessageSquare, Plus, Edit3, Trash2, X, Check } from 'lucide-react';

export const ConversationList = React.memo(({ 
  conversations = [], 
  activeConversationId, 
  onSelect, 
  onCreate, 
  onRename, 
  onDelete, 
  onClose 
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleSaveRename = (id) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div className="admin-card" style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <MessageSquare size={18} style={{ color: '#66b8ff' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Conversation Threads</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Create Thread Trigger */}
        <button
          onClick={onCreate}
          className="admin-btn admin-btn-secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
        >
          <Plus size={16} />
          <span>New Conversation Thread</span>
        </button>

        {/* Conversations List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
          {conversations.map((conv) => {
            const isActive = conv._id === activeConversationId;
            const isEditingThis = editingId === conv._id;

            return (
              <div 
                key={conv._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'rgba(102, 184, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: isActive ? '1px solid rgba(102, 184, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  if (!isEditingThis) {
                    onSelect(conv);
                    onClose();
                  }
                }}
              >
                {isEditingThis ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(conv._id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="admin-select"
                      style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
                    />
                    <button onClick={() => handleSaveRename(conv._id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isActive ? '#66b8ff' : '#fff' }}>
                        {conv.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                        Last message: {new Date(conv.lastMessageAt || conv.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingId(conv._id);
                          setEditTitle(conv.title);
                        }}
                        style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        title="Rename Thread"
                      >
                        <Edit3 size={14} />
                      </button>
                      {conversations.length > 1 && (
                        <button
                          onClick={() => onDelete(conv._id)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          title="Delete Thread"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';
export default ConversationList;
