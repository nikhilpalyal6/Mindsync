import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, 
  Video, 
  BookOpen, 
  Plus, 
  ArrowRight,
  Clock,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
  Map,
  Sparkles,
  Upload
} from 'lucide-react';

export const WorkspaceHome = React.memo(({ 
  session, 
  onTabChange, 
  onOpenResource, 
  onUploadPdfClick,
  onAddVideoClick,
  onAddNotesClick,
  onFileChange
}) => {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close add dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resources = useMemo(() => session?.resources || [], [session?.resources]);
  const pdfsCount = useMemo(() => resources.filter(r => r.type === 'pdf').length, [resources]);
  const videosCount = useMemo(() => resources.filter(r => r.type === 'youtube').length, [resources]);
  const notesCount = useMemo(() => resources.filter(r => r.type === 'notes').length, [resources]);

  const lastOpenedStr = useMemo(() => {
    if (!session?.lastOpened && !session?.updatedAt) return 'Never';
    const date = new Date(session.lastOpened || session.updatedAt);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [session?.lastOpened, session?.updatedAt]);

  const handleOpenResource = onOpenResource;

  const getIcon = (type) => {
    if (type === 'pdf') return <FileText size={14} style={{ color: 'var(--accent-blue)' }} />;
    if (type === 'youtube') return <Video size={14} style={{ color: 'var(--accent-purple)' }} />;
    return <BookOpen size={14} style={{ color: 'var(--accent-green)' }} />;
  };

  // Derive most recent resource for "Continue Learning"
  const continueResource = useMemo(() => {
    if (resources.length === 0) return null;
    return [...resources].sort((a, b) => new Date(b.addedAt || b.createdAt || 0) - new Date(a.addedAt || a.createdAt || 0))[0];
  }, [resources]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px', margin: '0 auto', padding: '12px 0', boxSizing: 'border-box' }}>
      
      {/* 1. Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
            {session.title}
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Last opened: <strong>{lastOpenedStr}</strong>
          </span>
        </div>

        {/* Small Add Button Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            style={{
              backgroundColor: 'var(--accent-purple)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
          >
            <Plus size={14} />
            <span>Add Resource</span>
          </button>

          {showAddDropdown && (
            <div style={{
              position: 'absolute',
              top: '32px',
              right: 0,
              backgroundColor: '#141923',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              padding: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              width: '150px'
            }}>
              <button
                onClick={() => { onUploadPdfClick(); setShowAddDropdown(false); }}
                style={{ background: 'none', border: 'none', color: '#fff', padding: '6px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Upload size={12} style={{ color: 'var(--accent-blue)' }} />
                <span>Upload PDF</span>
              </button>
              <button
                onClick={() => { onAddVideoClick(); setShowAddDropdown(false); }}
                style={{ background: 'none', border: 'none', color: '#fff', padding: '6px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Video size={12} style={{ color: 'var(--accent-purple)' }} />
                <span>YouTube Link</span>
              </button>
              <button
                onClick={() => { onAddNotesClick(); setShowAddDropdown(false); }}
                style={{ background: 'none', border: 'none', color: '#fff', padding: '6px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <BookOpen size={12} style={{ color: 'var(--accent-green)' }} />
                <span>Write Notes</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Grid Dashboard Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section A: Continue Learning */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Continue Learning
            </h3>

            {continueResource ? (
              <div 
                onClick={() => handleOpenResource(continueResource)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--glass-border-focus)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {getIcon(continueResource.type)}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {continueResource.title}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 500 }}>
                  <span>Resume</span>
                  <ChevronRight size={14} />
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active resources. Click "Add Resource" to start studying.
              </span>
            )}
          </div>

          {/* Section B: Recent Resources */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Recent Resources
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {resources.slice(0, 4).map(res => (
                <div 
                  key={res._id}
                  onClick={() => handleOpenResource(res)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--glass-border-focus)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {getIcon(res.type)}
                    <span style={{ fontSize: '14px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {res.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(res.addedAt || res.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              ))}

              {resources.length === 0 && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No materials uploaded.
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section C: Learning Progress */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Learning Progress
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Documents</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{pdfsCount}</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Videos</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{videosCount}</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes Written</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{notesCount}</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total items</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{resources.length}</span>
              </div>
            </div>
          </div>

          {/* Section D: Quick Actions */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Quick Actions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                onClick={onUploadPdfClick}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.02)'}
              >
                <Plus size={12} />
                <span>Upload New PDF Document</span>
              </button>
              <button 
                onClick={onAddVideoClick}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.02)'}
              >
                <Plus size={12} />
                <span>Link YouTube Video URL</span>
              </button>
              <button 
                onClick={onAddNotesClick}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.02)'}
              >
                <Plus size={12} />
                <span>Create New Revision Note Sheet</span>
              </button>
            </div>
          </div>

          {/* Section E: Recent Activity */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Recent Activity
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {resources.length > 0 ? (
                resources.slice(0, 3).map((res, i) => (
                  <div key={res._id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)', flexShrink: 0 }} />
                    <span>Added <strong>{res.title}</strong></span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(res.addedAt || res.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No recent activities recorded.
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Hidden file selector trigger */}
      <input
        type="file"
        onChange={onFileChange}
        accept="application/pdf"
        style={{ display: 'none' }}
      />
    </div>
  );
});

WorkspaceHome.displayName = 'WorkspaceHome';
export default WorkspaceHome;
