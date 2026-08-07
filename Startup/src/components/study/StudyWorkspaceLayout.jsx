import React, { useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceHome from './WorkspaceHome';
import SourcesPanel from './SourcesPanel';
import PDFViewerPanel from './PDFViewerPanel';
import VideoViewerPanel from './VideoViewerPanel';
import NotesPanel from './NotesPanel';
import MindMapPanel from './MindMapPanel';

import ResourceToolbar from './ResourceToolbar';
import ChatLayout from '../chat/ChatLayout';

import SummaryPanel from '../summary/SummaryPanel';
import FlashcardPanel from '../summary/FlashcardPanel';
import QuizPanel from '../summary/QuizPanel';
import ExplainPanel from '../summary/ExplainPanel';

export const StudyWorkspaceLayout = React.memo(({ 
  session, 
  onBack,
  onSessionUpdate,
  onUploadPdfClick,
  onAddVideoClick,
  onAddNotesClick,
  onFileChange,
  tabState,
  resourceState,
  viewerState,
  filterState
}) => {
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { activeTab, switchTab } = tabState;
  const { activeResource, handleSelectResource, handleSessionResourceUpdate, handleDeleteResource, handleRenameResource, handleReplaceResource } = resourceState;

  const handleTabChange = (tabId) => {
    if (['overview', 'sources', 'notes_viewer', 'mindmap'].includes(tabId)) {
      handleSelectResource(null);
    }
    switchTab(tabId);
  };

  // Derive active resource context
  const resourceType = activeResource?.type || (session?.metadata?.activeResourceType || session?.metadata?.lastTab || 'pdf').toLowerCase();
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
    if (resourceType === 'pdf' && session?.metadata?.pdf) {
      resourceId = session.metadata.pdf.pdfFilename || session.metadata.pdf.filename || '';
    } else if (resourceType === 'youtube' && session?.metadata?.youtube) {
      resourceId = session.metadata.youtube.videoUrl || '';
    } else if (resourceType === 'notes') {
      resourceId = session?.metadata?.notes?.noteId || 'default_notes_id';
    }
  }

  return (
    <div className="sw-layout">
      {/* 1. Permanent Left Sidebar (Resource Explorer) */}
      <WorkspaceSidebar 
        session={session}
        onBack={onBack}
        activeResource={activeResource}
        onSelectResource={handleSelectResource}
        activeTab={activeTab}
        onSwitchTab={switchTab}
        isCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onDeleteResource={handleDeleteResource}
        onRenameResource={handleRenameResource}
        onReplaceResource={handleReplaceResource}
      />

      {/* 2. Permanent Center Panel */}
      <div className="sw-center">
        {/* Workspace Title Info Header */}
        <WorkspaceHeader 
          session={session}
          onRename={onBack ? (id, title) => session.title !== title && onSessionUpdate({ ...session, title }) : null}
          onTogglePin={onBack ? (session) => onSessionUpdate({ ...session, pinned: !session.pinned }) : null}
          isAiOpen={isAiOpen}
          onToggleAi={() => setIsAiOpen(!isAiOpen)}
        />
        
        {/* Workspace Sub-tabs Navigation */}
        <WorkspaceTabs 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeResource={activeResource}
        />

        {/* Secondary Resource Toolbar */}
        <ResourceToolbar 
          activeResource={activeResource}
          activeTab={activeTab}
          onTabChange={switchTab}
        />

        {/* Dynamic Center Contents (Permanently Mounted for state preservation) */}
        <div className="sw-center-content">
          {/* 1. Overview */}
          <div style={{ display: (activeTab === 'overview' || !['sources', 'pdf_chat', 'video_chat', 'pdf_viewer', 'video_viewer', 'summaries', 'flashcards', 'quiz', 'explain', 'notes', 'notes_viewer', 'mindmap'].includes(activeTab)) ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <WorkspaceHome 
              session={session}
              onTabChange={switchTab}
              activeResource={activeResource}
              onSelectResource={handleSelectResource}
              onUploadPdfClick={onUploadPdfClick}
              onAddVideoClick={onAddVideoClick}
              onAddNotesClick={onAddNotesClick}
              onFileChange={onFileChange}
            />
          </div>

          {/* 2. Sources */}
          <div style={{ display: activeTab === 'sources' ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <SourcesPanel 
              session={session}
              onSelectResource={handleSelectResource}
              onSwitchTab={switchTab}
              filterState={filterState}
              onDeleteResource={handleDeleteResource}
              onRenameResource={handleRenameResource}
              onReplaceResource={handleReplaceResource}
              onUploadPdfClick={onUploadPdfClick}
              onAddVideoClick={onAddVideoClick}
              onAddNotesClick={onAddNotesClick}
            />
          </div>

          {/* 3. AI Chat */}
          <div style={{ display: (activeTab === 'pdf_chat' || activeTab === 'video_chat') ? 'block' : 'none', height: '100%', width: '100%', overflow: 'hidden', padding: '24px', boxSizing: 'border-box' }}>
            <ChatLayout session={session} activeResource={activeResource} />
          </div>

          {/* 4. PDF Viewer */}
          <div style={{ display: activeTab === 'pdf_viewer' ? 'block' : 'none', height: '100%', width: '100%', overflow: 'hidden' }}>
            <PDFViewerPanel session={session} activeResource={activeResource} />
          </div>

          {/* 5. Video Viewer */}
          <div style={{ display: activeTab === 'video_viewer' ? 'block' : 'none', height: '100%', width: '100%', overflow: 'hidden' }}>
            <VideoViewerPanel session={session} activeResource={activeResource} />
          </div>

          {/* 6. Summary */}
          <div style={{ display: activeTab === 'summaries' ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <SummaryPanel session={session} resourceId={resourceId} resourceType={resourceType} />
          </div>

          {/* 7. Flashcards */}
          <div style={{ display: activeTab === 'flashcards' ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <FlashcardPanel session={session} resourceId={resourceId} resourceType={resourceType} />
          </div>

          {/* 8. Quiz */}
          <div style={{ display: activeTab === 'quiz' ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <QuizPanel session={session} resourceId={resourceId} resourceType={resourceType} />
          </div>

          {/* 9. Explain */}
          <div style={{ display: activeTab === 'explain' ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <ExplainPanel session={session} resourceId={resourceId} resourceType={resourceType} />
          </div>

          {/* 10. Notes Editor */}
          <div style={{ display: (activeTab === 'notes' || activeTab === 'notes_viewer') ? 'block' : 'none', height: '100%', width: '100%', overflowY: 'auto' }}>
            <NotesPanel 
              session={session}
              activeResource={activeResource}
              onSessionUpdate={handleSessionResourceUpdate}
            />
          </div>

          {/* 11. Mind Map */}
          <div style={{ display: activeTab === 'mindmap' ? 'block' : 'none', height: '100%', width: '100%', overflow: 'hidden' }}>
            <MindMapPanel session={session} />
          </div>
        </div>
      </div>
    </div>
  );
});

StudyWorkspaceLayout.displayName = 'StudyWorkspaceLayout';
export default StudyWorkspaceLayout;
