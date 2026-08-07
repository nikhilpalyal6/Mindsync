import React from 'react';
import PDFWorkspace from '../pdf/PDFWorkspace';

export const PDFViewerPanel = React.memo(({ session, activeResource }) => {
  return (
    <div className="pdf-panel-wrapper" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <PDFWorkspace session={session} activeResource={activeResource} />
    </div>
  );
});

PDFViewerPanel.displayName = 'PDFViewerPanel';
export default PDFViewerPanel;
