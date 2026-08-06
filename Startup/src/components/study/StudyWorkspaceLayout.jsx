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
import AIChatSidebar from './AIChatSidebar';
import ResourceToolbar from './ResourceToolbar';
import PDFChatPanel from './PDFChatPanel';

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
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { activeTab, switchTab } = tabState;
  const { activeResource, handleSelectResource, handleSessionResourceUpdate } = resourceState;

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

  const renderCenterContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
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
        );
      case 'sources':
        return (
          <SourcesPanel 
            session={session}
            onSelectResource={handleSelectResource}
            onSwitchTab={switchTab}
            filterState={filterState}
          />
        );
      case 'pdf_chat':
        return (
          <PDFChatPanel 
            session={session} 
            resourceId={resourceId}
            resourceType={resourceType} 
          />
        );
      case 'pdf_viewer':
        return <PDFViewerPanel session={session} activeResource={activeResource} />;
      case 'video_viewer':
        return (
          <VideoViewerPanel 
            session={session}
            activeResource={activeResource}
            onBack={() => switchTab('sources')}
            onSwitchTab={switchTab}
            onSessionUpdate={handleSessionResourceUpdate}
          />
        );
      case 'notes_viewer':
        return (
          <NotesPanel 
            session={session}
            activeResource={activeResource}
            onSessionUpdate={handleSessionResourceUpdate}
          />
        );
      case 'summaries':
        return (
          <SummaryPanel 
            session={session} 
            resourceId={resourceId}
            resourceType={resourceType} 
          />
        );
      case 'flashcards':
        return (
          <FlashcardPanel 
            session={session} 
            resourceId={resourceId}
            resourceType={resourceType} 
          />
        );
      case 'quiz':
        return (
          <QuizPanel 
            session={session} 
            resourceId={resourceId}
            resourceType={resourceType} 
          />
        );
      case 'explain':
        return (
          <ExplainPanel 
            session={session} 
            resourceId={resourceId}
            resourceType={resourceType} 
          />
        );
      case 'notes':
        return (
          <NotesPanel 
            session={session}
            onSessionUpdate={handleSessionResourceUpdate}
          />
        );
      case 'mindmap':
        return <MindMapPanel session={session} />;
      default:
        return (
          <WorkspaceHome 
            session={session} 
            onTabChange={switchTab} 
            onSelectResource={handleSelectResource} 
            onFileChange={onFileChange} 
          />
        );
    }
  };

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
        {activeResource && !['overview', 'mindmap'].includes(activeTab) && (
          <ResourceToolbar 
            activeResource={activeResource}
            activeTab={activeTab}
            onTabChange={switchTab}
          />
        )}

        {/* Dynamic Center Contents */}
        <div className="sw-center-content">
          {renderCenterContent()}
        </div>
      </div>

      {/* 3. Permanent Right AI Panel (AISidebar wrapping ChatLayout) */}
      <AIChatSidebar 
        session={session}
        collapsed={!isAiOpen}
        activeResource={activeResource}
      />
    </div>
  );
});

StudyWorkspaceLayout.displayName = 'StudyWorkspaceLayout';
export default StudyWorkspaceLayout;
