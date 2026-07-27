import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Sparkles, CheckCircle } from 'lucide-react';
import PDFToolbar from './PDFToolbar';
import PDFViewer from './PDFViewer';
import { updateStudySession } from '../../services/api';
import './pdfWorkspace.css';

export const PDFWorkspace = React.memo(({ session }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitMode, setFitMode] = useState('page');
  const fileInputRef = useRef(null);

  // Restore PDF state on session mount or session switch
  useEffect(() => {
    if (!session?._id) return;

    const pdfMeta = session.metadata?.pdf || {};
    const savedFileName = pdfMeta.filename || pdfMeta.pdfFilename || '';
    const savedPage = pdfMeta.pageNumber || 1;
    const savedScale = pdfMeta.scale || 1.0;
    const savedFitMode = pdfMeta.fitMode || 'page';

    setPageNumber(savedPage);
    setScale(savedScale);
    setFitMode(savedFitMode);

    // Restore PDF Binary/Data URL from LocalStorage / IndexedDB key
    try {
      const storedDataUrl = localStorage.getItem(`mindsync_pdf_${session._id}`);
      if (storedDataUrl) {
        setFile(storedDataUrl);
        setFileName(savedFileName || 'Saved Document.pdf');
        console.log(`[Persistent Workspace] PDF Restored: ${savedFileName || 'Document.pdf'} (Page ${savedPage}, Zoom ${Math.round(savedScale * 100)}%)`);
      } else if (pdfMeta.fileData) {
        setFile(pdfMeta.fileData);
        setFileName(savedFileName || 'Saved Document.pdf');
        console.log(`[Persistent Workspace] PDF Restored: ${savedFileName || 'Document.pdf'} (Page ${savedPage}, Zoom ${Math.round(savedScale * 100)}%)`);
      }
    } catch (err) {
      console.warn('[Persistent Workspace] Could not load PDF from storage:', err);
    }
  }, [session?._id]);

  // Persist updated PDF metadata to StudySession.metadata
  const persistPDFState = useCallback(async (updates) => {
    if (!session?._id) return;

    try {
      const currentPdfMeta = session.metadata?.pdf || {};
      const newPdfMeta = {
        ...currentPdfMeta,
        filename: fileName || currentPdfMeta.filename || 'Document.pdf',
        pageNumber: updates.pageNumber !== undefined ? updates.pageNumber : pageNumber,
        scale: updates.scale !== undefined ? updates.scale : scale,
        fitMode: updates.fitMode !== undefined ? updates.fitMode : fitMode,
        lastOpened: new Date().toISOString(),
      };

      const updatedMeta = {
        ...(session.metadata || {}),
        pdf: newPdfMeta,
        activeResourceType: 'pdf',
        lastTab: 'pdf'
      };

      await updateStudySession(session._id, { metadata: updatedMeta });
      if (session.metadata) {
        session.metadata = updatedMeta;
      }
    } catch (err) {
      console.error('[Persistent Workspace] Failed to save PDF metadata:', err);
    }
  }, [session, fileName, pageNumber, scale, fitMode]);

  // File Upload Handler
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        alert('Please select a valid PDF document (.pdf)');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        setFile(dataUrl);
        setFileName(selectedFile.name);
        setPageNumber(1);
        setScale(1.0);
        setFitMode('page');

        // Persist to local browser storage & StudySession metadata
        try {
          localStorage.setItem(`mindsync_pdf_${session?._id}`, dataUrl);
        } catch (err) {
          console.warn('[Persistent Workspace] LocalStorage quota exceeded, relying on metadata:', err);
        }

        await persistPDFState({
          pageNumber: 1,
          scale: 1.0,
          fitMode: 'page',
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveClick = async () => {
    setFile(null);
    setFileName('');
    setNumPages(0);
    setPageNumber(1);
    setScale(1.0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (session?._id) {
      try {
        localStorage.removeItem(`mindsync_pdf_${session._id}`);
        const updatedMeta = { ...(session.metadata || {}), pdf: null };
        await updateStudySession(session._id, { metadata: updatedMeta });
      } catch (err) {
        console.error('Failed to remove PDF metadata:', err);
      }
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF Load Error:', error);
  };

  // Page Change Handler
  const handlePageChange = useCallback(async (newPage) => {
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      await persistPDFState({ pageNumber: newPage });
    }
  }, [numPages, persistPDFState]);

  // Zoom Handlers
  const handleZoomIn = useCallback(async () => {
    setFitMode('custom');
    const newScale = Math.min(scale + 0.15, 3.0);
    setScale(newScale);
    await persistPDFState({ scale: newScale, fitMode: 'custom' });
  }, [scale, persistPDFState]);

  const handleZoomOut = useCallback(async () => {
    setFitMode('custom');
    const newScale = Math.max(scale - 0.15, 0.5);
    setScale(newScale);
    await persistPDFState({ scale: newScale, fitMode: 'custom' });
  }, [scale, persistPDFState]);

  const handleResetZoom = useCallback(async () => {
    setFitMode('custom');
    setScale(1.0);
    await persistPDFState({ scale: 1.0, fitMode: 'custom' });
  }, [persistPDFState]);

  const handleFitWidth = useCallback(async () => {
    setFitMode('width');
    setScale(1.0);
    await persistPDFState({ scale: 1.0, fitMode: 'width' });
  }, [persistPDFState]);

  const handleFitPage = useCallback(async () => {
    setFitMode('page');
    setScale(1.0);
    await persistPDFState({ scale: 1.0, fitMode: 'page' });
  }, [persistPDFState]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (!file) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePageChange(pageNumber - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handlePageChange(pageNumber + 1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, pageNumber, handlePageChange, handleZoomIn, handleZoomOut]);

  return (
    <div className="pdf-workspace-container">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        style={{ display: 'none' }}
      />

      {/* Header Toolbar */}
      <PDFToolbar
        fileName={fileName}
        pageNumber={pageNumber}
        numPages={numPages}
        scale={scale}
        fitMode={fitMode}
        onPageChange={handlePageChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        onOpenClick={handleOpenClick}
        onRemoveClick={handleRemoveClick}
      />

      {/* Main Content / Viewport */}
      {file ? (
        <PDFViewer
          file={file}
          pageNumber={pageNumber}
          scale={scale}
          fitMode={fitMode}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          onDocumentLoadError={onDocumentLoadError}
          onRetry={handleOpenClick}
        />
      ) : (
        <div className="pdf-viewport">
          <div className="pdf-upload-box">
            <div className="pdf-upload-icon">
              <FileText size={28} />
            </div>
            <h3 className="pdf-upload-title">PDF Study Workspace</h3>
            <p className="pdf-upload-desc">
              Upload lecture slides, textbooks, or research papers. Your document, exact page, and zoom scale will be saved automatically.
            </p>

            <button 
              className="pdf-toolbar-btn accent" 
              onClick={handleOpenClick} 
              style={{ padding: '10px 20px', fontSize: '0.9rem', marginTop: '6px' }}
            >
              <Upload size={16} />
              <span>Select PDF Document</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

PDFWorkspace.displayName = 'PDFWorkspace';
export default PDFWorkspace;
