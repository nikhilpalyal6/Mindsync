import React, { useMemo } from 'react';
import VideoLearning from '../VideoLearning';

export const VideoViewerPanel = React.memo(({ 
  session, 
  activeResource, 
  onBack, 
  onSwitchTab, 
  onSessionUpdate 
}) => {
  const videoUrl = useMemo(() => {
    return activeResource?.url || session?.metadata?.youtube?.videoUrl || '';
  }, [activeResource, session?.metadata?.youtube?.videoUrl]);

  const resourceId = useMemo(() => {
    return activeResource?._id || '';
  }, [activeResource]);

  const handleBack = () => {
    onBack();
  };

  const handleSwitchTab = (tab) => {
    onSwitchTab(tab);
  };

  if (!videoUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--text-muted)' }}>
        <h3>No video resource loaded</h3>
        <p>Please select a video from the sidebar explorer or upload a video link from Overview.</p>
      </div>
    );
  }

  return (
    <div className="video-panel-wrapper">
      <VideoLearning 
        videoUrl={videoUrl}
        resourceId={resourceId}
        session={session}
        onBack={handleBack}
        onSwitchTab={handleSwitchTab}
        onSessionUpdate={onSessionUpdate}
      />
    </div>
  );
});

VideoViewerPanel.displayName = 'VideoViewerPanel';
export default VideoViewerPanel;
