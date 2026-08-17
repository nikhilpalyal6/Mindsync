import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStudySessions, 
  getStudySessionById, 
  createStudySession, 
  updateStudySession, 
  deleteStudySession, 
  getStudyActivities,
  deleteResource,
  getResources,
  addResource,
  renameResource,
  replaceResource
} from '../services/api';
import { showToast } from '../components/Toast';

// Hook for Workspace Sessions state
export function useWorkspaceState() {
  const [sessions, setSessions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchSessionsAndActivities = useCallback(async () => {
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const [resSessions, resActivities] = await Promise.allSettled([
        getStudySessions(),
        getStudyActivities()
      ]);

      if (!isMountedRef.current) return;

      const fetchedSessions = resSessions.status === 'fulfilled' ? (resSessions.value || []) : [];
      setSessions(fetchedSessions);

      if (resActivities.status === 'fulfilled') {
        setActivities(resActivities.value || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load study sessions.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch initially on mount
  useEffect(() => {
    fetchSessionsAndActivities();
  }, [fetchSessionsAndActivities]);

  const selectSession = useCallback(async (session, onRestored) => {
    setActiveSession(session);
    localStorage.setItem('mindsync_last_study_session_id', session._id);
    localStorage.setItem('mindsync_active_workspace_id', session._id);

    let fullSession = session;
    try {
      const res = await getStudySessionById(session._id);
      if (res) {
        fullSession = (res.success && res.data) ? res.data : res;

        // Fallback resources mapping if metadata contains values but resources array is empty
        if ((!fullSession.resources || fullSession.resources.length === 0) && fullSession.metadata) {
          const meta = fullSession.metadata;
          const resources = [];

          if (meta.youtube && (meta.youtube.videoUrl || meta.youtube.url)) {
            resources.push({
              _id: `youtube_${fullSession._id}`,
              type: 'youtube',
              url: meta.youtube.videoUrl || meta.youtube.url,
              title: meta.youtube.title || 'YouTube Video',
              data: meta.youtube,
              addedAt: fullSession.createdAt || new Date(),
              updatedAt: fullSession.updatedAt || new Date()
            });
          }
          if (meta.pdf && (meta.pdf.filename || meta.pdf.pdfFilename)) {
            resources.push({
              _id: `pdf_${fullSession._id}`,
              type: 'pdf',
              url: meta.pdf.pdfFilename || meta.pdf.filename,
              title: meta.pdf.filename || meta.pdf.pdfFilename || 'Document.pdf',
              data: meta.pdf,
              addedAt: fullSession.createdAt || new Date(),
              updatedAt: fullSession.updatedAt || new Date()
            });
          }
          if (meta.notes && (meta.notes.content || meta.notes.notesContent)) {
            resources.push({
              _id: `notes_${fullSession._id}`,
              type: 'notes',
              url: 'default_notes_id',
              title: meta.notes.title || 'Revision Notes',
              data: meta.notes,
              addedAt: fullSession.createdAt || new Date(),
              updatedAt: fullSession.updatedAt || new Date()
            });
          }
          fullSession.resources = resources;
        }
        setActiveSession(fullSession);
      }
    } catch (err) {
      console.error('Failed to load full study session:', err);
    }

    const meta = fullSession.metadata || {};
    // Default to 'overview' inside clicked workspace
    const restoredResource = 'overview';
    if (onRestored) {
      onRestored(restoredResource, meta.youtube?.videoUrl || '');
    }

    try {
      await updateStudySession(fullSession._id, { lastOpened: new Date() });
      const [resSessions, resActivities] = await Promise.all([
        getStudySessions(),
        getStudyActivities()
      ]);
      setSessions(resSessions || []);
      setActivities(resActivities || []);
    } catch (err) {
      console.error('Failed to update last opened timestamp:', err);
    }
  }, []);

  const createWorkspace = useCallback(async (title, description) => {
    const res = await createStudySession({ title, description });
    setSessions(prev => [res, ...prev]);
    await fetchSessionsAndActivities();
    return res;
  }, [fetchSessionsAndActivities]);

  const renameWorkspace = useCallback(async (id, newTitle) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setSessions(prev => prev.map(s => s._id === id ? { ...s, title: trimmed } : s));
    if (activeSession?._id === id) {
      setActiveSession(prev => ({ ...prev, title: trimmed }));
    }

    try {
      await updateStudySession(id, { title: trimmed });
      const resActs = await getStudyActivities();
      setActivities(resActs || []);
    } catch (err) {
      console.error('Failed to rename workspace:', err);
      fetchSessionsAndActivities();
    }
  }, [activeSession, fetchSessionsAndActivities]);

  const deleteWorkspace = useCallback(async (id) => {
    console.log(`[Navigation Logger] DELETE request triggered for workspace ${id}. Reason: Explicit user deletion action.`);
    setSessions(prev => prev.filter(s => s._id !== id));
    if (activeSession?._id === id) {
      setActiveSession(null);
      localStorage.removeItem('mindsync_last_study_session_id');
      localStorage.removeItem('mindsync_active_workspace_id');
    }

    try {
      await deleteStudySession(id);
      const resActs = await getStudyActivities();
      setActivities(resActs || []);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      fetchSessionsAndActivities();
    }
  }, [activeSession, fetchSessionsAndActivities]);

  const togglePinWorkspace = useCallback(async (session) => {
    const updatedPinned = !session.pinned;
    setSessions(prev => prev.map(s => s._id === session._id ? { ...s, pinned: updatedPinned } : s));
    if (activeSession?._id === session._id) {
      setActiveSession(prev => ({ ...prev, pinned: updatedPinned }));
    }

    try {
      await updateStudySession(session._id, { pinned: updatedPinned });
      const resActs = await getStudyActivities();
      setActivities(resActs || []);
    } catch (err) {
      console.error('Failed to toggle pin state:', err);
      fetchSessionsAndActivities();
    }
  }, [activeSession, fetchSessionsAndActivities]);

  return {
    sessions,
    activities,
    activeSession,
    loading,
    error,
    setActiveSession,
    setSessions,
    setActivities,
    fetchSessionsAndActivities,
    selectSession,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    togglePinWorkspace
  };
}

// Hook for Workspace Tab Selection
export function useTabState(initialTab = 'overview') {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [lastOpenedViewer, setLastOpenedViewer] = useState(null); // Keeps track of last open viewer (pdf_viewer / video_viewer / notes_viewer)

  const switchTab = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  return {
    activeTab,
    setActiveTab,
    switchTab,
    lastOpenedViewer,
    setLastOpenedViewer
  };
}

// Hook for Resource Selection & Counts
export function useResourceState(activeSession, setActiveSession, setSessions) {
  const [activeResource, setActiveResource] = useState(null);

  // Auto-initialize activeResource when activeSession loads/updates
  useEffect(() => {
    if (!activeSession) {
      setActiveResource(null);
      return;
    }
    
    // Only auto-initialize if there is no activeResource or it has no data
    if (!activeResource || !activeResource.data) {
      const activeType = activeSession.metadata?.activeResourceType || activeSession.metadata?.lastTab;
      if (activeType === 'pdf' && activeSession.metadata?.pdf) {
        const metaPdf = activeSession.metadata.pdf;
        const matchingRes = activeSession.resources?.find(r => 
          r.type === 'pdf' && 
          (r._id === metaPdf._id || r.title === metaPdf.filename || r.title === metaPdf.pdfFilename || r.url === metaPdf.filename || r.url === metaPdf.pdfFilename)
        );
        if (matchingRes && matchingRes.data) {
          setActiveResource(matchingRes);
        }
      } else if (activeType === 'youtube' && activeSession.metadata?.youtube) {
        const metaYt = activeSession.metadata.youtube;
        const matchingRes = activeSession.resources?.find(r => 
          r.type === 'youtube' && 
          (r._id === metaYt.videoId || r.url === metaYt.videoUrl || r.url === metaYt.url)
        );
        if (matchingRes && matchingRes.data) {
          setActiveResource(matchingRes);
        }
      } else if (activeType === 'notes' && activeSession.metadata?.notes) {
        const metaNotes = activeSession.metadata.notes;
        const matchingRes = activeSession.resources?.find(r => 
          r.type === 'notes' && 
          (r.url === metaNotes.noteId || r._id === metaNotes.noteId)
        );
        if (matchingRes && matchingRes.data) {
          setActiveResource(matchingRes);
        }
      }
    }
  }, [activeSession, activeResource]);

  // Derive resources categories
  const pdfs = useMemo(() => {
    return (activeSession?.resources || []).filter(r => r.type === 'pdf');
  }, [activeSession?.resources]);

  const videos = useMemo(() => {
    return (activeSession?.resources || []).filter(r => r.type === 'youtube');
  }, [activeSession?.resources]);

  const notes = useMemo(() => {
    return (activeSession?.resources || []).filter(r => r.type === 'notes');
  }, [activeSession?.resources]);

  const handleSelectResource = useCallback(async (resource, sessionOverride = null) => {
    setActiveResource(resource);
    const targetSession = sessionOverride || activeSession;
    if (!targetSession || !resource) return;

    try {
      const typeMap = {
        pdf: 'pdf',
        youtube: 'youtube',
        notes: 'notes'
      };
      const activeType = typeMap[resource.type] || 'pdf';
      
      const updatedMeta = {
        activeResourceType: activeType,
        lastTab: activeType
      };

      if (resource.type === 'pdf' && resource.data) {
        updatedMeta.pdf = resource.data;
      } else if (resource.type === 'youtube' && resource.data) {
        updatedMeta.youtube = resource.data;
      } else if (resource.type === 'notes' && resource.data) {
        updatedMeta.notes = resource.data;
      }

      const res = await updateStudySession(targetSession._id, {
        metadata: updatedMeta
      });
      
      if (res) {
        const fullSession = (res.success && res.data) ? res.data : res;
        setActiveSession(fullSession);
        setSessions(prev => prev.map(s => s._id === fullSession._id ? fullSession : s));
      }
    } catch (err) {
      console.error('Failed to update active resource type on server:', err);
    }
  }, [activeSession, setActiveSession, setSessions]);

  const handleSessionResourceUpdate = useCallback((updatedResource) => {
    if (!activeSession || !updatedResource?._id) return;

    const updatedResources = (activeSession.resources || []).map(r =>
      r._id === updatedResource._id ? updatedResource : r
    );

    const updatedSession = {
      ...activeSession,
      resources: updatedResources,
      metadata: {
        ...(activeSession.metadata || {}),
        youtube: updatedResource.type === 'youtube' ? updatedResource.data : activeSession.metadata?.youtube
      }
    };

    setActiveSession(updatedSession);
    setSessions(prev => prev.map(s => s._id === updatedSession._id ? updatedSession : s));
  }, [activeSession, setActiveSession, setSessions]);

  const handleDeleteResource = useCallback(async (resource, activeTab, switchTab) => {
    if (!activeSession || !resource) return;
    
    // Double confirmation dialog
    if (!window.confirm(`Delete "${resource.title}"?\nThis action cannot be undone.`)) return;

    try {
      const res = await deleteResource(activeSession._id, resource._id || resource.url);
      if (res) {
        const fullSession = (res.success && res.data) ? res.data : res;
        
        // Update states reactively immediately (No Page Refresh Required!)
        setActiveSession(fullSession);
        setSessions(prev => prev.map(s => s._id === fullSession._id ? fullSession : s));

        // Check if the deleted resource was currently open
        const isCurrentlyOpen = activeResource && (
          activeResource._id === resource._id || 
          activeResource.url === resource.url || 
          activeResource.title === resource.title
        );

        if (isCurrentlyOpen) {
          setActiveResource(null);
          // Redirect if currently open
          switchTab('sources');
        }

        // Show success toast
        showToast(`${resource.type === 'pdf' ? 'PDF' : resource.type === 'youtube' ? 'Video' : 'Resource'} deleted successfully.`, 'success');
      }
    } catch (err) {
      console.error('Failed to delete resource:', err);
      showToast('Unable to delete resource.', 'error');
    }
  }, [activeSession, activeResource, setActiveSession, setSessions]);

  const handleAddResource = useCallback(async (type, url, title, data) => {
    if (!activeSession) return;
    try {
      const res = await addResource(activeSession._id, { type, url, title, data });
      if (res) {
        const fullSession = (res.success && res.data) ? res.data : res;
        setActiveSession(fullSession);
        setSessions(prev => prev.map(s => s._id === fullSession._id ? fullSession : s));
        showToast(`${type === 'pdf' ? 'PDF' : type === 'youtube' ? 'Video' : 'Resource'} uploaded successfully.`, 'success');
        return fullSession;
      }
    } catch (err) {
      console.error('Failed to add resource:', err);
      showToast('Unable to add resource.', 'error');
    }
  }, [activeSession, setActiveSession, setSessions]);

  const handleRenameResource = useCallback(async (resourceId, newTitle) => {
    if (!activeSession) return;
    try {
      const res = await renameResource(activeSession._id, resourceId, newTitle);
      if (res) {
        const fullSession = (res.success && res.data) ? res.data : res;
        
        // Update states reactively immediately (No Page Refresh Required!)
        setActiveSession(fullSession);
        setSessions(prev => prev.map(s => s._id === fullSession._id ? fullSession : s));

        // If the renamed resource is currently active/selected, update its title reactively
        if (activeResource && (activeResource._id === resourceId || activeResource.url === resourceId || activeResource.title === resourceId)) {
          const updatedRes = fullSession.resources?.find(r => r._id === resourceId || r.title === newTitle);
          if (updatedRes) {
            setActiveResource(updatedRes);
          }
        }
        
        showToast('Resource renamed successfully.', 'success');
        return fullSession;
      }
    } catch (err) {
      console.error('Failed to rename resource:', err);
      showToast('Unable to rename resource.', 'error');
    }
  }, [activeSession, activeResource, setActiveSession, setSessions]);

  const handleReplaceResource = useCallback(async (resourceId, { url, title, data }) => {
    if (!activeSession) return;
    try {
      const res = await replaceResource(activeSession._id, resourceId, { url, title, data });
      if (res) {
        const fullSession = (res.success && res.data) ? res.data : res;
        
        // Update states reactively immediately (No Page Refresh Required!)
        setActiveSession(fullSession);
        setSessions(prev => prev.map(s => s._id === fullSession._id ? fullSession : s));

        // If the replaced resource is currently active/selected, update its content reactively
        if (activeResource && (activeResource._id === resourceId || activeResource.url === resourceId || activeResource.title === resourceId)) {
          const updatedRes = fullSession.resources?.find(r => r._id === resourceId || r.url === url);
          if (updatedRes) {
            setActiveResource(updatedRes);
          }
        }

        showToast('Resource replaced successfully.', 'success');
        return fullSession;
      }
    } catch (err) {
      console.error('Failed to replace resource:', err);
      showToast('Unable to replace resource.', 'error');
    }
  }, [activeSession, activeResource, setActiveSession, setSessions]);

  return {
    activeResource,
    setActiveResource,
    pdfs,
    videos,
    notes,
    handleSelectResource,
    handleSessionResourceUpdate,
    handleDeleteResource,
    handleAddResource,
    handleRenameResource,
    handleReplaceResource
  };
}

// Hook for Viewer configs (PDF / Video page, zoom, fit)
export function useViewerState() {
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [pdfFitMode, setPdfFitMode] = useState('page');
  const [videoUrl, setVideoUrl] = useState('');

  return {
    pdfPage,
    setPdfPage,
    pdfScale,
    setPdfScale,
    pdfFitMode,
    setPdfFitMode,
    videoUrl,
    setVideoUrl
  };
}

// Hook for Drag & Drop / Paste Modals
export function useUploadState() {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  return {
    showPasteModal,
    setShowPasteModal,
    showRecordModal,
    setShowRecordModal,
    showCreateModal,
    setShowCreateModal,
    pasteUrl,
    setPasteUrl,
    pasteText,
    setPasteText,
    uploadError,
    setUploadError,
    creatingWorkspace,
    setCreatingWorkspace
  };
}

// Hook for Workspace filtering and search queries
export function useSearchState(sessions) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const regex = new RegExp(searchQuery, 'i');
    return sessions.filter(s => regex.test(s.title) || regex.test(s.description || ''));
  }, [sessions, searchQuery]);

  const pinnedWorkspaces = useMemo(() => {
    return filteredSessions.filter(s => s.pinned);
  }, [filteredSessions]);

  const groupedHistoryWorkspaces = useMemo(() => {
    const unpinned = filteredSessions.filter(s => !s.pinned);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - (6 * 86400000);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    unpinned.forEach(s => {
      const openedTime = new Date(s.lastOpened || s.updatedAt || s.createdAt).getTime();
      if (openedTime >= todayStart) {
        groups.today.push(s);
      } else if (openedTime >= yesterdayStart) {
        groups.yesterday.push(s);
      } else if (openedTime >= weekStart) {
        groups.thisWeek.push(s);
      } else {
        groups.older.push(s);
      }
    });

    const sortByOpened = (a, b) => new Date(b.lastOpened || b.createdAt) - new Date(a.lastOpened || a.createdAt);
    groups.today.sort(sortByOpened);
    groups.yesterday.sort(sortByOpened);
    groups.thisWeek.sort(sortByOpened);
    groups.older.sort(sortByOpened);

    return groups;
  }, [filteredSessions]);

  return {
    searchQuery,
    setSearchQuery,
    filteredSessions,
    pinnedWorkspaces,
    groupedHistoryWorkspaces
  };
}

// Hook for Sources list tab filtering
export function useFilterState() {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'pdf' | 'youtube' | 'notes'
  const [sortField, setSortField] = useState('addedAt'); // 'title' | 'addedAt'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  return {
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
  };
}
