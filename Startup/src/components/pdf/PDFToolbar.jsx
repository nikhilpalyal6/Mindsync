import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Upload, 
  Trash2, 
  RefreshCw,
  BookOpen,
  Sparkles
} from 'lucide-react';

export const PDFToolbar = React.memo(({
  fileName,
  pageNumber,
  numPages,
  scale,
  fitMode,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitWidth,
  onFitPage,
  onOpenClick,
  onRemoveClick,
  showHighlights,
  onToggleHighlights,
  showSmartHighlights,
  onToggleSmartHighlights
}) => {
  const [inputPage, setInputPage] = useState(pageNumber);

  useEffect(() => {
    setInputPage(pageNumber);
  }, [pageNumber]);

  const handlePageInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputPage, 10);
      if (!isNaN(page) && page >= 1 && page <= (numPages || 1)) {
        onPageChange(page);
      } else {
        setInputPage(pageNumber);
      }
    }
  };

  return (
    <div className="pdf-toolbar">
      {/* File Action Controls */}
      <div className="pdf-toolbar-group">
        <button className="pdf-toolbar-btn accent" onClick={onOpenClick} title="Open / Upload PDF">
          <Upload size={14} />
          <span>{fileName ? 'Replace' : 'Open PDF'}</span>
        </button>

        {fileName && (
          <button className="pdf-toolbar-btn danger" onClick={onRemoveClick} title="Remove PDF">
            <Trash2 size={14} />
            <span>Remove</span>
          </button>
        )}

        {fileName && (
          <span style={{ fontSize: '0.775rem', color: 'rgba(255,255,255,0.6)', marginLeft: '6px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </span>
        )}
      </div>

      {fileName && (
        <>
          {/* Page Navigation Controls */}
          <div className="pdf-toolbar-group">
            <button 
              className="pdf-toolbar-btn" 
              onClick={() => onPageChange(pageNumber - 1)}
              disabled={pageNumber <= 1}
              title="Previous Page (Left Arrow / PageUp)"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="pdf-page-input-wrapper">
              <span>Page</span>
              <input
                type="text"
                className="pdf-page-input"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onKeyDown={handlePageInputSubmit}
                onBlur={() => setInputPage(pageNumber)}
                title="Type page number and press Enter"
              />
              <span>/ {numPages || 1}</span>
            </div>

            <button 
              className="pdf-toolbar-btn" 
              onClick={() => onPageChange(pageNumber + 1)}
              disabled={pageNumber >= (numPages || 1)}
              title="Next Page (Right Arrow / PageDown)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="pdf-toolbar-divider" />

          {/* Zoom & View Controls */}
          <div className="pdf-toolbar-group">
            <button className="pdf-toolbar-btn" onClick={onZoomOut} disabled={scale <= 0.5} title="Zoom Out (-)">
              <ZoomOut size={14} />
            </button>

            <span className="pdf-zoom-badge" title="Zoom Percentage">
              {Math.round(scale * 100)}%
            </span>

            <button className="pdf-toolbar-btn" onClick={onZoomIn} disabled={scale >= 3.0} title="Zoom In (+)">
              <ZoomIn size={14} />
            </button>

            <button 
              className={`pdf-toolbar-btn ${fitMode === 'width' ? 'accent' : ''}`} 
              onClick={onFitWidth} 
              title="Fit Width"
            >
              <Maximize2 size={14} />
              <span>Fit Width</span>
            </button>

            <button 
              className={`pdf-toolbar-btn ${fitMode === 'page' ? 'accent' : ''}`} 
              onChange={onFitPage} 
              onClick={onFitPage} 
              title="Fit Page"
            >
              <Minimize2 size={14} />
              <span>Fit Page</span>
            </button>

            <button className="pdf-toolbar-btn" onClick={onResetZoom} title="Reset Zoom to 100%">
              <RotateCcw size={14} />
              <span>100%</span>
            </button>

            <button 
              className={`pdf-toolbar-btn ${showSmartHighlights ? 'accent' : ''}`} 
              onClick={onToggleSmartHighlights} 
              title="Toggle Smart Highlights Suggestions"
            >
              <Sparkles size={14} style={{ color: showSmartHighlights ? '#fff' : '#a855f7' }} />
              <span>Smart Highlights</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

PDFToolbar.displayName = 'PDFToolbar';
export default PDFToolbar;
