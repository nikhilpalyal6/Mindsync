import React, { useMemo } from 'react';
import { 
  FileText, 
  Video, 
  BookOpen, 
  Search, 
  Grid, 
  List, 
  ArrowUpDown, 
  Trash2, 
  ExternalLink 
} from 'lucide-react';
import { updateStudySession } from '../../services/api';

export const SourcesPanel = React.memo(({ 
  session, 
  onOpenResource, 
  onSwitchTab,
  filterState,
  onDeleteResource,
  onRenameResource,
  onReplaceResource,
  onUploadPdfClick,
  onAddVideoClick,
  onAddNotesClick
}) => {
  const {
    filterType,
    setFilterType,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    sourceSearchQuery,
    setSourceSearchQuery,
    viewMode,
    setViewMode
  } = filterState;

  const resources = useMemo(() => session?.resources || [], [session?.resources]);

  // Filter and sort resources
  const processedResources = useMemo(() => {
    let list = [...resources];

    // Search query
    if (sourceSearchQuery.trim()) {
      const regex = new RegExp(sourceSearchQuery, 'i');
      list = list.filter(r => regex.test(r.title));
    }

    // Type filter
    if (filterType !== 'all') {
      list = list.filter(r => r.type === filterType);
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else {
        const dateA = new Date(a.addedAt || a.createdAt || Date.now());
        const dateB = new Date(b.addedAt || b.createdAt || Date.now());
        comparison = dateA - dateB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [resources, sourceSearchQuery, filterType, sortField, sortOrder]);

  const handleOpenResource = onOpenResource;

  const handleDeleteResource = async (res, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDeleteResource) {
      await onDeleteResource(res, 'sources', onSwitchTab);
    }
  };

  const getIcon = (type) => {
    if (type === 'pdf') return <FileText size={18} style={{ color: 'var(--accent-blue)' }} />;
    if (type === 'youtube') return <Video size={18} style={{ color: 'var(--accent-purple)' }} />;
    return <BookOpen size={18} style={{ color: 'var(--accent-green)' }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filters Toolbar */}
      <div className="sources-toolbar">
        <div className="sources-filters">
          <button 
            className={`filter-pill ${filterType === 'all' ? 'active' : ''}`} 
            onClick={() => setFilterType('all')}
          >
            All Resources
          </button>
          <button 
            className={`filter-pill ${filterType === 'pdf' ? 'active' : ''}`} 
            onClick={() => setFilterType('pdf')}
          >
            PDFs
          </button>
          <button 
            className={`filter-pill ${filterType === 'youtube' ? 'active' : ''}`} 
            onClick={() => setFilterType('youtube')}
          >
            Videos
          </button>
          <button 
            className={`filter-pill ${filterType === 'notes' ? 'active' : ''}`} 
            onClick={() => setFilterType('notes')}
          >
            Notes
          </button>
        </div>

        <div className="sources-controls">
          {(() => {
            if (filterType === 'all' || filterType === 'pdf') {
              return (
                <button
                  type="button"
                  onClick={onUploadPdfClick}
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: '6px',
                    whiteSpace: 'nowrap',
                    height: '28px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>Upload PDF/Docs</span>
                </button>
              );
            } else if (filterType === 'youtube') {
              return (
                <button
                  type="button"
                  onClick={onAddVideoClick}
                  style={{
                    background: 'var(--accent-purple)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: '6px',
                    whiteSpace: 'nowrap',
                    height: '28px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>Paste YouTube Link</span>
                </button>
              );
            } else if (filterType === 'notes') {
              return (
                <button
                  type="button"
                  onClick={onAddNotesClick}
                  style={{
                    background: 'var(--accent-green)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: '6px',
                    whiteSpace: 'nowrap',
                    height: '28px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>Create Notes</span>
                </button>
              );
            }
            return null;
          })()}

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search resources..."
              className="sources-search-input"
              value={sourceSearchQuery}
              onChange={(e) => setSourceSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="sources-select"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            <option value="addedAt">Date Added</option>
            <option value="title">Alphabetical</option>
          </select>

          <button 
            className="action-btn-circle"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            title="Toggle sort order"
          >
            <ArrowUpDown size={14} />
          </button>

          <div style={{ display: 'flex', border: '1px solid var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button 
              style={{ 
                padding: '6px', 
                background: viewMode === 'grid' ? 'rgba(255,255,255,0.08)' : 'none', 
                border: 'none', 
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={14} />
            </button>
            <button 
              style={{ 
                padding: '6px', 
                background: viewMode === 'list' ? 'rgba(255,255,255,0.08)' : 'none', 
                border: 'none', 
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List list representation */}
      {viewMode === 'grid' ? (
        <div className="sources-grid">
          {processedResources.map(res => (
            <div key={res._id} className="source-card-interactive" onClick={() => handleOpenResource(res)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  {getIcon(res.type)}
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {res.title}
                  </h4>
                </div>
                
                <button 
                  onClick={(e) => handleDeleteResource(res, e)}
                  style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.65)', cursor: 'pointer', padding: '2px' }}
                  title="Delete Resource"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                <span>Added: {new Date(res.addedAt || res.createdAt || Date.now()).toLocaleDateString()}</span>
                <span className="open-resource-btn">
                  <span>View</span>
                  <ExternalLink size={10} />
                </span>
              </div>
            </div>
          ))}
          {processedResources.length === 0 && (
            <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matching resources found.
            </div>
          )}
        </div>
      ) : (
        <div className="sources-list">
          {processedResources.map(res => (
            <div key={res._id} className="source-list-item-interactive" onClick={() => handleOpenResource(res)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                {getIcon(res.type)}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {res.title}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Added: {new Date(res.addedAt || res.createdAt || Date.now()).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={(e) => handleDeleteResource(res, e)}
                    style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.65)', cursor: 'pointer' }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {processedResources.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matching resources found.
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SourcesPanel.displayName = 'SourcesPanel';
export default SourcesPanel;
