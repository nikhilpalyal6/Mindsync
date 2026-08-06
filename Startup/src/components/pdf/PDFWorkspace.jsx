import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Sparkles, CheckCircle } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import PDFToolbar from './PDFToolbar';
import PDFViewer from './PDFViewer';
import { updateStudySession } from '../../services/api';
import './pdfWorkspace.css';

// Ensure workerSrc is set for text extraction
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Module-level in-memory cache to preserve valid PDF DataUrls across component unmounts
const inMemoryPDFCache = new Map();

export const PDFWorkspace = React.memo(({ session }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitMode, setFitMode] = useState('page');
  const fileInputRef = useRef(null);
  const resourceId = session?.metadata?.pdf?.pdfFilename || session?.metadata?.pdf?.filename || fileName || 'pdf_doc';

  useEffect(() => {
    window.currentActiveResource = { id: resourceId, type: 'pdf' };
  }, [resourceId]);

  // Restore PDF state from in-memory cache or MongoDB on session mount or session switch
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

    // 1. Check in-memory cache FIRST (0ms, 100% valid File/DataUrl object)
    const memCached = inMemoryPDFCache.get(session._id);
    if (memCached && memCached.file) {
      setFile(memCached.file);
      setFileName(memCached.fileName || savedFileName || 'Saved Document.pdf');
      console.log(`[PDF Processing] Restored PDF from in-memory cache: ${memCached.fileName}`);
      return;
    }

    // 2. Check LocalStorage cache
    try {
      const storedDataUrl = localStorage.getItem(`mindsync_pdf_${session._id}`);
      if (storedDataUrl && storedDataUrl.startsWith('data:application/pdf')) {
        setFile(storedDataUrl);
        setFileName(savedFileName || 'Saved Document.pdf');
        inMemoryPDFCache.set(session._id, { file: storedDataUrl, fileName: savedFileName });
        console.log(`[PDF Processing] Restored PDF from local cache: ${savedFileName}`);
        return;
      }
    } catch (err) {
      console.warn('[PDF Processing] LocalStorage check failed:', err);
    }

    // 3. Check MongoDB fileData
    if (pdfMeta.fileData && typeof pdfMeta.fileData === 'string' && pdfMeta.fileData.startsWith('data:application/pdf')) {
      setFile(pdfMeta.fileData);
      setFileName(savedFileName || 'Saved Document.pdf');
      inMemoryPDFCache.set(session._id, { file: pdfMeta.fileData, fileName: savedFileName });
      console.log(`[PDF Processing] Restored PDF from MongoDB fileData: ${savedFileName}`);
    } else if (savedFileName) {
      setFileName(savedFileName);
    }
  }, [session?._id, session?.metadata?.pdf?.lastOpened]);

  // Extract readable text from PDF using pdfjs-dist
  const extractPDFText = async (arrayBuffer) => {
    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      let fullText = '';
      const totalPages = pdfDoc.numPages;
      const pagesToRead = Math.min(totalPages, 50);

      for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        if (pageText.trim()) {
          fullText += `[Page ${pageNum}]\n${pageText}\n\n`;
        }
      }
      return { fullText: fullText.trim(), pageCount: totalPages };
    } catch (err) {
      console.error('[PDF Processing] Failed to extract text:', err);
      return { fullText: '', pageCount: 0 };
    }
  };

  // Persist updated PDF metadata to StudySession.metadata in MongoDB
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
        extractedText: updates.extractedText !== undefined ? updates.extractedText : currentPdfMeta.extractedText || '',
        pageCount: updates.pageCount !== undefined ? updates.pageCount : currentPdfMeta.pageCount || 0,
        fileData: updates.fileData !== undefined ? updates.fileData : currentPdfMeta.fileData || '',
        lastOpened: new Date().toISOString(),
      };

      const updatedMeta = {
        ...(session.metadata || {}),
        pdf: newPdfMeta,
        activeResourceType: 'pdf',
        lastTab: 'pdf'
      };

      await updateStudySession(session._id, { metadata: updatedMeta, pdfCount: Math.max((session.pdfCount || 0), 1) });
      if (session.metadata) {
        session.metadata = updatedMeta;
      }
    } catch (err) {
      console.error('[PDF Processing] Failed to save PDF metadata to MongoDB:', err);
    }
  }, [session, fileName, pageNumber, scale, fitMode]);

  // File Upload Handler with Text Extraction
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

        // Store in module-level in-memory cache
        if (session?._id) {
          inMemoryPDFCache.set(session._id, {
            file: dataUrl,
            fileName: selectedFile.name
          });
        }

        // Cache to LocalStorage for quick load across refreshes
        try {
          localStorage.setItem(`mindsync_pdf_${session?._id}`, dataUrl);
        } catch (err) {
          console.warn('[PDF Processing] LocalStorage quota exceeded, storing in MongoDB:', err);
        }

        // Extract readable text from ArrayBuffer
        let extractedText = '';
        let pageCount = 0;
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const extracted = await extractPDFText(arrayBuffer);
          extractedText = extracted.fullText;
          pageCount = extracted.pageCount;
          console.log(`[PDF Processing] Extracted ${extractedText.length} chars of text from ${pageCount} pages`);
        } catch (extractErr) {
          console.error('[PDF Processing] Text extraction error:', extractErr);
        }

        // Persist file metadata & extracted text to MongoDB as single source of truth
        await persistPDFState({
          pageNumber: 1,
          scale: 1.0,
          fitMode: 'page',
          extractedText,
          pageCount,
          fileData: dataUrl
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
      inMemoryPDFCache.delete(session._id);
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
          resourceId={resourceId}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          onDocumentLoadError={onDocumentLoadError}
          onPageChange={handlePageChange}
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
              Upload lecture slides, textbooks, or research papers. Document text will be extracted automatically for AI Chat and Summary Engine.
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
