import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Video, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Trash2, 
  Map,
  Edit2,
  Upload
} from 'lucide-react';
import { pdfjs } from 'react-pdf';
import { showToast } from '../../components/Toast';

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const ResourceExplorer = React.memo(({ 
  session, 
  activeResource, 
  onSelectResource,
  activeTab,
  onSwitchTab,
  isCollapsed,
  onDeleteResource,
  onRenameResource,
  onReplaceResource
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
  const [renamingId, setRenamingId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [replacingId, setReplacingId] = useState(null);
  const replaceInputRef = useRef(null);

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
    e.preventDefault();
    if (onDeleteResource) {
      await onDeleteResource(resource, activeTab, onSwitchTab);
    }
  };

  // Handle inline rename submit
  const handleRenameSubmit = async (resourceId) => {
    if (!tempTitle.trim()) {
      setRenamingId(null);
      return;
    }
    const titleToSave = tempTitle.trim();
    setRenamingId(null);
    if (onRenameResource) {
      await onRenameResource(resourceId, titleToSave);
    }
  };

  // Handle file replacement with client-side text extraction
  const handleReplaceFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && replacingId) {
      if (selectedFile.type !== 'application/pdf') {
        showToast('Please select a valid PDF document (.pdf)', 'error');
        return;
      }

      showToast('Processing replacement PDF...', 'info');

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        let extractedText = '';
        let pageCount = 0;

        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdfDoc = await loadingTask.promise;
          pageCount = pdfDoc.numPages;
          const pagesToRead = Math.min(pageCount, 50);

          for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            if (pageText.trim()) {
              extractedText += `[Page ${pageNum}]\n${pageText}\n\n`;
            }
          }
          extractedText = extractedText.trim();
        } catch (err) {
          console.error('[PDF Replacement] Text extraction error:', err);
        }

        if (onReplaceResource) {
          await onReplaceResource(replacingId, {
            url: selectedFile.name,
            title: selectedFile.name,
            data: {
              filename: selectedFile.name,
              extractedText,
              pageCount,
              fileSize: selectedFile.size,
              fileData: dataUrl,
              lastOpened: new Date().toISOString()
            }
          });
        }

        setReplacingId(null);
        if (replaceInputRef.current) {
          replaceInputRef.current.value = '';
        }
      };

      reader.readAsDataURL(selectedFile);
    }
  };

  // Helper to open a viewer
  const handleItemClick = (resource) => {
    if (renamingId) return; // Prevent navigation while renaming
    onSelectResource(resource);
    if (resource.type === 'pdf') {
      onSwitchTab('pdf_viewer');
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
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                padding: 0
              }}
              title={item.label}
            >
              <Icon size={18} style={{ color: isActive ? item.color : 'inherit' }} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
      
      {/* Hidden File Input for PDF Replacement */}
      <input 
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceFileChange}
        accept="application/pdf"
        style={{ display: 'none' }}
      />

      {/* Search Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--glass-border)',
        borderRadius: '6px',
        padding: '6px 10px',
        margin: '2px 0 6px 0'
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter resources..."
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '13px',
            width: '100%',
            fontFamily: 'inherit'
          }}
        />
      </div>

      {/* PDF DOCUMENTS SECTION */}
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
                  <div className="item-left" style={{ flex: 1, minWidth: 0 }}>
                    <FileText size={13} style={{ opacity: 0.7 }} />
                    {renamingId === res._id ? (
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(res._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(res._id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        autoFocus
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          border: '1px solid #66b8ff',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '2px 6px',
                          width: '100%',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    ) : (
                      <>
                        <span className="item-title" title={res.title}>{res.title}</span>
                        <span className="ai-badge-tiny">Ready</span>
                      </>
                    )}
                  </div>
                  
                  {renamingId !== res._id && (
                    <div className="explorer-item-menu" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setRenamingId(res._id);
                          setTempTitle(res.title);
                        }}
                        style={{ background: 'none', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        title="Rename"
                      >
                        <Edit2 size={11} />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setReplacingId(res._id);
                          replaceInputRef.current?.click();
                        }}
                        style={{ background: 'none', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        title="Replace File"
                      >
                        <Upload size={11} />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => handleDeleteResource(res, e)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          padding: '4px',
                          margin: 0,
                          color: 'rgba(239, 68, 68, 0.8)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }} 
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
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
                  <div className="item-left" style={{ flex: 1, minWidth: 0 }}>
                    <Video size={13} style={{ opacity: 0.7 }} />
                    {renamingId === res._id ? (
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(res._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(res._id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        autoFocus
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          border: '1px solid #66b8ff',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '2px 6px',
                          width: '100%',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    ) : (
                      <>
                        <span className="item-title" title={res.title}>{res.title}</span>
                        <span className="ai-badge-tiny">Ready</span>
                      </>
                    )}
                  </div>
                  
                  {renamingId !== res._id && (
                    <div className="explorer-item-menu" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setRenamingId(res._id);
                          setTempTitle(res.title);
                        }}
                        style={{ background: 'none', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        title="Rename"
                      >
                        <Edit2 size={11} />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => handleDeleteResource(res, e)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          padding: '4px',
                          margin: 0,
                          color: 'rgba(239, 68, 68, 0.8)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }} 
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
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
                  <div className="item-left" style={{ flex: 1, minWidth: 0 }}>
                    <BookOpen size={13} style={{ opacity: 0.7 }} />
                    {renamingId === res._id ? (
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(res._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(res._id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        autoFocus
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          border: '1px solid #66b8ff',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '2px 6px',
                          width: '100%',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    ) : (
                      <span className="item-title" title={res.title}>{res.title}</span>
                    )}
                  </div>
                  
                  {renamingId !== res._id && (
                    <div className="explorer-item-menu" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setRenamingId(res._id);
                          setTempTitle(res.title);
                        }}
                        style={{ background: 'none', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        title="Rename"
                      >
                        <Edit2 size={11} />
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => handleDeleteResource(res, e)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          padding: '4px',
                          margin: 0,
                          color: 'rgba(239, 68, 68, 0.8)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }} 
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
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


    </div>
  );
});

ResourceExplorer.displayName = 'ResourceExplorer';
export default ResourceExplorer;
