import React from 'react';
import PDFWorkspace from '../pdf/PDFWorkspace';

export const PDFViewerPanel = React.memo(({ session }) => {
  return (
    <div className="pdf-panel-wrapper">
      <PDFWorkspace session={session} />
    </div>
  );
});

PDFViewerPanel.displayName = 'PDFViewerPanel';
export default PDFViewerPanel;
