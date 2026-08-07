import React from 'react';
import { 
  FileText, 
  Video, 
  Layers, 
  HelpCircle, 
  Sparkles, 
  BookOpen, 
  FileEdit,
  MessageSquare
} from 'lucide-react';

export const ResourceToolbar = React.memo(({ activeResource, activeTab, onTabChange }) => {
  const getSubTabs = () => {
    if (!activeResource) return [];
    if (activeResource.type === 'pdf') {
      return [
        { id: 'pdf_chat', name: 'AI Chat', icon: MessageSquare },
        { id: 'pdf_viewer', name: 'PDF', icon: FileText },
        { id: 'summaries', name: 'Summary', icon: Sparkles },
        { id: 'explain', name: 'Explain', icon: BookOpen },
        { id: 'flashcards', name: 'Flashcards', icon: Layers },
        { id: 'quiz', name: 'Quiz', icon: HelpCircle }
      ];
    }
    if (activeResource.type === 'youtube') {
      return [
        { id: 'video_chat', name: 'AI Chat', icon: MessageSquare },
        { id: 'video_viewer', name: 'YouTube', icon: Video },
        { id: 'summaries', name: 'Summary', icon: Sparkles },
        { id: 'explain', name: 'Explain', icon: BookOpen },
        { id: 'flashcards', name: 'Flashcards', icon: Layers },
        { id: 'quiz', name: 'Quiz', icon: HelpCircle }
      ];
    }
    if (activeResource.type === 'notes') {
      return [
        { id: 'notes_viewer', name: 'Markdown', icon: FileEdit },
        { id: 'explain', name: 'AI Improve', icon: BookOpen, tabOverride: 'explain' },
        { id: 'summaries', name: 'Summary', icon: Sparkles },
        { id: 'quiz', name: 'Quiz', icon: HelpCircle },
        { id: 'flashcards', name: 'Flashcards', icon: Layers }
      ];
    }
    return [];
  };

  const subTabs = getSubTabs();
  const shouldShowTabs = activeResource && !['overview', 'mindmap'].includes(activeTab);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 24px',
      background: 'rgba(20, 25, 35, 0.25)',
      borderBottom: '1px solid var(--glass-border)',
      height: '42px',
      boxSizing: 'border-box',
      flexShrink: 0,
      width: '100%'
    }}>
      {shouldShowTabs ? (
        <>
          <div style={{ fontSize: '10px', fontWeight: 650, color: 'var(--text-muted)', marginRight: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resource Tools
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {subTabs.map(tab => {
              const Icon = tab.icon;
              const targetTabId = tab.tabOverride || tab.id;
              const isActive = activeTab === targetTabId;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(targetTabId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: '4px',
                    border: '1px solid transparent',
                    background: isActive ? 'rgba(255, 255, 255, 0.04)' : 'none',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Icon size={11} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '10px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Workspace Overview
        </div>
      )}
    </div>
  );
});

ResourceToolbar.displayName = 'ResourceToolbar';
export default ResourceToolbar;
