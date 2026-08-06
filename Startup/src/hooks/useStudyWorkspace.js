import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStudySessions, 
  getStudySessionById, 
  createStudySession, 
  updateStudySession, 
  deleteStudySession, 
  getStudyActivities 
} from '../services/api';

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
              _id: meta.youtube.videoId || `yt_${Date.now()}`,
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
              _id: `pdf_${Date.now()}`,
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
              _id: 'default_notes_id',
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
    setSessions(prev => prev.filter(s => s._id !== id));
    if (activeSession?._id === id) {
      setActiveSession(null);
      localStorage.removeItem('mindsync_last_study_session_id');
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

  const handleSelectResource = useCallback((resource) => {
    setActiveResource(resource);
  }, []);

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

  return {
    activeResource,
    setActiveResource,
    pdfs,
    videos,
    notes,
    handleSelectResource,
    handleSessionResourceUpdate
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
