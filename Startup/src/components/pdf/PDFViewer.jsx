import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle, RefreshCw } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const PDFViewer = React.memo(({
  file,
  pageNumber,
  scale,
  fitMode,
  resourceId,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onPageChange,
  onRetry
}) => {
  const containerRef = useRef(null);
  const pageRefs = useRef({});
  const [containerWidth, setContainerWidth] = useState(800);
  const [numPages, setNumPages] = useState(0);
  const isScrollingToPageRef = useRef(false);

  // Selection Floating Toolbar State
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarCoords, setToolbarCoords] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');

  const handleSelection = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && containerRef.current) {
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const viewportRect = containerRef.current.getBoundingClientRect();
          
          setToolbarCoords({
            x: rect.left - viewportRect.left + (rect.width / 2) + containerRef.current.scrollLeft,
            y: rect.top - viewportRect.top - 45 + containerRef.current.scrollTop
          });
          setSelectedText(text);
          setShowToolbar(true);
        } catch (err) {
          console.warn('Error computing selection coords:', err);
        }
      } else {
        setShowToolbar(false);
      }
    }, 50);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (showToolbar && !e.target.closest('.pdf-context-toolbar')) {
        setShowToolbar(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [showToolbar]);

  // Responsive width calculation for Fit Width mode
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 48);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleDocumentLoad = (doc) => {
    setNumPages(doc.numPages);
    onDocumentLoadSuccess?.(doc);
  };

  // Scroll to selected page when pageNumber changes externally
  useEffect(() => {
    if (pageNumber && pageRefs.current[pageNumber] && containerRef.current) {
      isScrollingToPageRef.current = true;
      pageRefs.current[pageNumber].scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.log(`[PDF Scroll Position Saved] Restored viewport to Page ${pageNumber}`);

      const timer = setTimeout(() => {
        isScrollingToPageRef.current = false;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pageNumber]);

  // Handle scroll detection for automatic page number updating
  const handleScroll = useCallback(() => {
    if (isScrollingToPageRef.current || !containerRef.current || numPages === 0) return;

    const containerTop = containerRef.current.getBoundingClientRect().top;
    const containerHeight = containerRef.current.clientHeight;

    let currentVisiblePage = 1;
    let maxVisibleHeight = 0;

    for (let i = 1; i <= numPages; i++) {
      const el = pageRefs.current[i];
      if (el) {
        const rect = el.getBoundingClientRect();
        const top = Math.max(rect.top, containerTop);
        const bottom = Math.min(rect.bottom, containerTop + containerHeight);
        const visibleHeight = Math.max(0, bottom - top);

        if (visibleHeight > maxVisibleHeight) {
          maxVisibleHeight = visibleHeight;
          currentVisiblePage = i;
        }
      }
    }

    if (currentVisiblePage !== pageNumber && currentVisiblePage >= 1 && currentVisiblePage <= numPages) {
      onPageChange?.(currentVisiblePage);
      console.log(`[PDF Page Changed] Scroll detected Page ${currentVisiblePage}`);
    }
  }, [numPages, pageNumber, onPageChange]);

  const computedWidth = fitMode === 'width' ? containerWidth : undefined;

  return (
    <div 
      className="pdf-viewport" 
      ref={containerRef}
      onScroll={handleScroll}
      onMouseUp={handleSelection}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        scrollBehavior: 'smooth',
        position: 'relative'
      }}
    >
      {/* Floating selection contextual toolbar */}
      {showToolbar && (
        <div 
          className="pdf-context-toolbar" 
          style={{
            position: 'absolute',
            left: `${toolbarCoords.x}px`,
            top: `${toolbarCoords.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: 'rgba(15, 18, 26, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-explain', {
                detail: { concept: selectedText, resourceId, source: 'pdf' }
              }));
              setShowToolbar(false);
            }}
            style={{
              border: 'none', background: 'none', color: '#66b8ff', fontSize: '0.725rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Explain
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(selectedText);
              setShowToolbar(false);
            }}
            style={{
              border: 'none', background: 'none', color: '#fff', fontSize: '0.725rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Copy
          </button>
          <button 
            onClick={() => setShowToolbar(false)}
            style={{
              border: 'none', background: 'none', color: '#fff', fontSize: '0.725rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Highlight
          </button>
          <button 
            onClick={() => setShowToolbar(false)}
            style={{
              border: 'none', background: 'none', color: '#fff', fontSize: '0.725rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Notes
          </button>
        </div>
      )}

      <Document
        file={file}
        onLoadSuccess={handleDocumentLoad}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="pdf-status-box">
            <div className="pdf-spinner" />
            <span style={{ fontSize: '0.85rem' }}>Loading PDF Document...</span>
          </div>
        }
        error={
          <div className="pdf-status-box" style={{ maxWidth: '380px' }}>
            <AlertCircle size={36} style={{ color: '#ef4444' }} />
            <h4 style={{ color: '#fff', margin: '4px 0 0 0', fontSize: '1rem' }}>Failed to Load PDF</h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              The selected file may be corrupted, password protected, or unsupported.
            </p>
            <button 
              className="pdf-toolbar-btn accent" 
              onClick={onRetry} 
              style={{ marginTop: '8px' }}
            >
              <RefreshCw size={14} />
              <span>Choose Another File</span>
            </button>
          </div>
        }
      >
        {numPages > 0 ? (
          Array.from(new Array(numPages), (el, index) => {
            const pageNum = index + 1;
            return (
              <div
                key={`page_${pageNum}`}
                ref={el => pageRefs.current[pageNum] = el}
                className="pdf-page-canvas-wrapper"
                style={{ marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: '4px' }}
              >
                <Page
                  pageNumber={pageNum}
                  scale={fitMode === 'width' ? 1.0 : scale}
                  width={computedWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="pdf-status-box" style={{ minHeight: '400px' }}>
                      <div className="pdf-spinner" />
                      <span style={{ fontSize: '0.8rem' }}>Rendering Page {pageNum}...</span>
                    </div>
                  }
                />
              </div>
            );
          })
        ) : null}
      </Document>
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';
export default PDFViewer;
