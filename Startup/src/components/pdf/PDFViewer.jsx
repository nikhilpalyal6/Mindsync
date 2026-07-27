import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, AlertCircle, RefreshCw } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const PDFViewer = React.memo(({
  file,
  pageNumber,
  scale,
  fitMode,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onRetry
}) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

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

  const computedWidth = fitMode === 'width' ? containerWidth : undefined;

  return (
    <div className="pdf-viewport" ref={containerRef}>
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
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
        <div className="pdf-page-canvas-wrapper">
          <Page
            pageNumber={pageNumber}
            scale={fitMode === 'width' ? 1.0 : scale}
            width={computedWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div className="pdf-status-box" style={{ minHeight: '300px' }}>
                <div className="pdf-spinner" />
                <span style={{ fontSize: '0.8rem' }}>Rendering Page {pageNumber}...</span>
              </div>
            }
          />
        </div>
      </Document>
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';
export default PDFViewer;
