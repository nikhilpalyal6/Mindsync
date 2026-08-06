import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Video, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  MoreVertical, 
  Trash2, 
  Sparkles,
  Map,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { updateStudySession } from '../../services/api';

export const ResourceExplorer = React.memo(({ 
  session, 
  activeResource, 
  onSelectResource,
  activeTab,
  onSwitchTab,
  isCollapsed
}) => {
  const [expanded, setExpanded] = useState({
    pdf: true,
    youtube: true,
    notes: true,
    flashcards: false,
    quiz: false,
    mindmap: false
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Extract all resources
  const resources = useMemo(() => session?.resources || [], [session?.resources]);

  // Filter resources based on explorer search query
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const regex = new RegExp(searchQuery, 'i');
    return resources.filter(r => regex.test(r.title));
  }, [resources, searchQuery]);

  const pdfs = useMemo(() => filteredResources.filter(r => r.type === 'pdf'), [filteredResources]);
  const videos = useMemo(() => filteredResources.filter(r => r.type === 'youtube'), [filteredResources]);
  const notes = useMemo(() => filteredResources.filter(r => r.type === 'notes'), [filteredResources]);

  // Handle resource deletion
  const handleDeleteResource = async (resource, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${resource.title}"?`)) return;

    try {
      const updatedResources = resources.filter(r => r._id !== resource._id);
      const updatedMeta = { ...session.metadata };
      
      if (resource.type === 'pdf') {
        updatedMeta.pdf = null;
      } else if (resource.type === 'youtube') {
        updatedMeta.youtube = null;
      } else if (resource.type === 'notes') {
        updatedMeta.notes = null;
      }

      await updateStudySession(session._id, { 
        resources: updatedResources,
        metadata: updatedMeta
      });

      // Reload page state
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  // Helper to open a viewer
  const handleItemClick = (resource) => {
    onSelectResource(resource);
    if (resource.type === 'pdf') {
      onSwitchTab('pdf_chat');
    } else if (resource.type === 'youtube') {
      onSwitchTab('video_viewer');
    } else if (resource.type === 'notes') {
      onSwitchTab('notes_viewer');
    }
  };

  // Helper to open an AI tab for a specific resource
  const handleAiItemClick = (resource, tab) => {
    onSelectResource(resource);
    onSwitchTab(tab);
  };

  if (isCollapsed) {
    const collapsedItems = [
      { id: 'pdf', label: 'PDF Documents', icon: FileText, tab: 'sources', color: 'var(--accent-blue)' },
      { id: 'youtube', label: 'Videos', icon: Video, tab: 'sources', color: 'var(--accent-purple)' },
      { id: 'notes', label: 'Notes', icon: BookOpen, tab: 'notes', color: 'var(--accent-green)' },
      { id: 'flashcards', label: 'Flashcards', icon: Layers, tab: 'flashcards', color: 'var(--accent-blue)' },
      { id: 'quiz', label: 'Quizzes', icon: HelpCircle, tab: 'quiz', color: 'var(--accent-purple)' },
      { id: 'mindmap', label: 'Mind Maps', icon: Map, tab: 'mindmap', color: 'var(--accent-green)' }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
        {collapsedItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.id}
              onClick={() => onSwitchTab(item.tab)}
              style={{
                background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'none',
                border: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title={item.label}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Icon size={18} style={{ color: isActive ? '' : item.color }} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="explorer-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Search Bar */}
      <div className="explorer-search-wrapper">
        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
        <input 
          type="text"
          className="explorer-search-input"
          placeholder="Filter resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* PDFs SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('pdf')}>
          <div className="trigger-left">
            {expanded.pdf ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>PDF Documents</span>
          </div>
          <span className="section-count">{pdfs.length}</span>
        </div>
        {expanded.pdf && (
          <div className="section-children">
            {pdfs.map(res => {
              const isSelected = activeTab === 'pdf_viewer' && activeResource?._id === res._id;
              return (
                <div 
                  key={res._id}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleItemClick(res)}
                >
                  <div className="item-left">
                    <FileText size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title" title={res.title}>{res.title}</span>
                    <span className="ai-badge-tiny">Ready</span>
                  </div>
                  
                  <div className="explorer-item-menu">
                    <button onClick={(e) => handleDeleteResource(res, e)} style={{ color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {pdfs.length === 0 && (
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', paddingLeft: '8px', fontStyle: 'italic' }}>No PDFs uploaded</span>
            )}
          </div>
        )}
      </div>

      {/* VIDEOS SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('youtube')}>
          <div className="trigger-left">
            {expanded.youtube ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Video size={14} style={{ color: 'var(--accent-purple)' }} />
            <span>Videos</span>
          </div>
          <span className="section-count">{videos.length}</span>
        </div>
        {expanded.youtube && (
          <div className="section-children">
            {videos.map(res => {
              const isSelected = activeTab === 'video_viewer' && activeResource?._id === res._id;
              return (
                <div 
                  key={res._id}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleItemClick(res)}
                >
                  <div className="item-left">
                    <Video size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title" title={res.title}>{res.title}</span>
                    <span className="ai-badge-tiny">Ready</span>
                  </div>
                  
                  <div className="explorer-item-menu">
                    <button onClick={(e) => handleDeleteResource(res, e)} style={{ color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {videos.length === 0 && (
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', paddingLeft: '8px', fontStyle: 'italic' }}>No videos added</span>
            )}
          </div>
        )}
      </div>

      {/* NOTES SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('notes')}>
          <div className="trigger-left">
            {expanded.notes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <BookOpen size={14} style={{ color: 'var(--accent-green)' }} />
            <span>Notes</span>
          </div>
          <span className="section-count">{notes.length}</span>
        </div>
        {expanded.notes && (
          <div className="section-children">
            {notes.map(res => {
              const isSelected = activeTab === 'notes_viewer' && activeResource?._id === res._id;
              return (
                <div 
                  key={res._id}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleItemClick(res)}
                >
                  <div className="item-left">
                    <BookOpen size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title" title={res.title}>{res.title}</span>
                  </div>
                  
                  <div className="explorer-item-menu">
                    <button onClick={(e) => handleDeleteResource(res, e)} style={{ color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {notes.length === 0 && (
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', paddingLeft: '8px', fontStyle: 'italic' }}>No notes created</span>
            )}
          </div>
        )}
      </div>

      {/* FLASHCARDS SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('flashcards')}>
          <div className="trigger-left">
            {expanded.flashcards ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>Flashcards</span>
          </div>
          <span className="section-count">{resources.length}</span>
        </div>
        {expanded.flashcards && (
          <div className="section-children">
            {resources.map(res => {
              const isSelected = activeTab === 'flashcards' && activeResource?._id === res._id;
              return (
                <div 
                  key={`fc-${res._id}`}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleAiItemClick(res, 'flashcards')}
                >
                  <div className="item-left">
                    <Layers size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title">Cards: {res.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUIZZES SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('quiz')}>
          <div className="trigger-left">
            {expanded.quiz ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <HelpCircle size={14} style={{ color: 'var(--accent-purple)' }} />
            <span>Quizzes</span>
          </div>
          <span className="section-count">{resources.length}</span>
        </div>
        {expanded.quiz && (
          <div className="section-children">
            {resources.map(res => {
              const isSelected = activeTab === 'quiz' && activeResource?._id === res._id;
              return (
                <div 
                  key={`qz-${res._id}`}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleAiItemClick(res, 'quiz')}
                >
                  <div className="item-left">
                    <HelpCircle size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title">Quiz: {res.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MIND MAPS SECTION */}
      <div className="explorer-section">
        <div className="section-trigger" onClick={() => toggleSection('mindmap')}>
          <div className="trigger-left">
            {expanded.mindmap ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Map size={14} style={{ color: 'var(--accent-green)' }} />
            <span>Mind Maps</span>
          </div>
          <span className="section-count">{resources.length}</span>
        </div>
        {expanded.mindmap && (
          <div className="section-children">
            {resources.map(res => {
              const isSelected = activeTab === 'mindmap' && activeResource?._id === res._id;
              return (
                <div 
                  key={`mm-${res._id}`}
                  className={`explorer-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleAiItemClick(res, 'mindmap')}
                >
                  <div className="item-left">
                    <Map size={13} style={{ opacity: 0.7 }} />
                    <span className="item-title">Map: {res.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';
export default ResourceExplorer;
