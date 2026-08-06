import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, History, FileText, CheckCircle } from 'lucide-react';
import { updateStudySession } from '../../services/api';

export const NotesPanel = React.memo(({ session, onSessionUpdate }) => {
  const noteMeta = session?.metadata?.notes || {};
  const [content, setContent] = useState(noteMeta.content || '');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const saveTimeoutRef = useRef(null);

  // Derive counts
  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  }, [content]);

  const charCount = useMemo(() => {
    return content.length;
  }, [content]);

  useEffect(() => {
    if (noteMeta.content !== undefined) {
      setContent(noteMeta.content);
    }
  }, [noteMeta.noteId, noteMeta.content]);

  // Debounced save function
  const saveNotesContent = useCallback(async (newContent) => {
    if (!session?._id) return;
    setSaveStatus('saving');
    try {
      const updatedNotes = {
        ...noteMeta,
        content: newContent,
        lastOpened: new Date().toISOString()
      };
      
      const updatedMeta = {
        ...(session.metadata || {}),
        notes: updatedNotes
      };

      await updateStudySession(session._id, {
        metadata: updatedMeta
      });

      setSaveStatus('saved');
      
      if (onSessionUpdate) {
        // Find existing notes resource to update
        const notesResource = (session.resources || []).find(r => r.type === 'notes');
        if (notesResource) {
          onSessionUpdate({
            ...notesResource,
            data: updatedNotes,
            updatedAt: new Date()
          });
        }
      }
    } catch (err) {
      console.error('Notes autosave failed:', err);
      setSaveStatus('error');
    }
  }, [session, noteMeta, onSessionUpdate]);

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    setSaveStatus('saving');

    // Reset timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNotesContent(val);
    }, 1000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="notes-panel-wrapper">
      <div className="markdown-editor-container">
        {/* Editor Title Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent-green)' }} />
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>
              Editing: {noteMeta.title || 'Revision Notes'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Autosave Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.725rem' }}>
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle size={12} style={{ color: 'var(--accent-green)' }} />
                  <span style={{ color: 'var(--accent-green)' }}>All changes saved</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <span className="loader-skeleton" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Saving changes...</span>
                </>
              )}
              {saveStatus === 'error' && (
                <span style={{ color: '#ef4444' }}>Save failed. Retrying...</span>
              )}
            </div>

            <button 
              className="action-btn-circle" 
              title="Version History (Phase 3.3+)" 
              disabled 
              style={{ cursor: 'not-allowed', opacity: 0.5 }}
            >
              <History size={13} />
            </button>
          </div>
        </div>

        {/* Markdown Help Header */}
        <div className="editor-toolbar">
          <span>Markdown supported: # H1, ## H2, **bold**, *italic*, - bullet, [link](url)</span>
          <span>Autosaves immediately while typing</span>
        </div>

        {/* Text Area Editor */}
        <textarea
          className="editor-textarea"
          placeholder="Start writing notes or paste text to summarize here..."
          value={content}
          onChange={handleContentChange}
        />

        {/* Editor Footer Word Count */}
        <div className="editor-footer">
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Words: <strong>{wordCount}</strong></span>
            <span>Characters: <strong>{charCount}</strong></span>
          </div>
          <span>Draft format</span>
        </div>
      </div>
    </div>
  );
});

// Import useMemo inline since it is in React
import { useMemo } from 'react';

NotesPanel.displayName = 'NotesPanel';
export default NotesPanel;
