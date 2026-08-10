import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Sparkles, CheckCircle, BookOpen, Trash2 } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import PDFToolbar from './PDFToolbar';
import PDFViewer from './PDFViewer';
import { updateStudySession, addResource, getHighlights, createHighlight, deleteHighlight, getSmartHighlights, acceptSmartHighlights, rejectSmartHighlights, rejectSmartHighlightSingle, acceptAllSmartHighlights, analyzeSmartHighlightsForPage, regenerateSmartHighlightsForPage } from '../../services/api';
import './pdfWorkspace.css';

// Ensure workerSrc is set for text extraction
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Module-level in-memory cache to preserve valid PDF DataUrls across component unmounts
const inMemoryPDFCache = new Map();

const getHighlightColor = (type) => {
  switch (type) {
    case 'concept': return '#a855f7';
    case 'definition': return '#10b981';
    case 'formula': return '#3b82f6';
    case 'personal': return '#ec4899';
    case 'important':
    default: return '#fbbf24';
  }
};

const getTextRectsFromPDFJS = async (pdfDoc, pageNumber, searchText) => {
  if (!pdfDoc || !searchText) return [];
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    
    const items = textContent.items;
    if (!items || items.length === 0) return [];
    
    const clean = (str) => str.replace(/\s+/g, ' ').toLowerCase();
    const searchPhrase = clean(searchText);
    
    let concatenated = '';
    const itemMappings = [];
    
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const start = concatenated.length;
      concatenated += item.str + ' ';
      const end = concatenated.length;
      itemMappings.push({ idx, start, end });
    }
    
    const cleanConcatenated = clean(concatenated);
    const cleanToOrigMap = [];
    let cleanCursor = 0;
    
    for (let origCursor = 0; origCursor < concatenated.length; origCursor++) {
      const charOrig = concatenated[origCursor];
      const isSpaceOrig = /\s/.test(charOrig);
      
      cleanToOrigMap[cleanCursor] = origCursor;
      
      if (isSpaceOrig) {
        if (origCursor === 0 || !/\s/.test(concatenated[origCursor - 1])) {
          cleanCursor++;
        }
      } else {
        cleanCursor++;
      }
    }
    
    const matchIdx = cleanConcatenated.indexOf(searchPhrase);
    if (matchIdx === -1) {
      const stripStr = (str) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const strippedSearch = stripStr(searchText);
      
      let strippedConcat = '';
      const stripToOrigMap = [];
      
      for (let origCursor = 0; origCursor < concatenated.length; origCursor++) {
        const charOrig = concatenated[origCursor];
        const isAlphanumeric = /[a-zA-Z0-9]/.test(charOrig);
        if (isAlphanumeric) {
          stripToOrigMap[strippedConcat.length] = origCursor;
          strippedConcat += charOrig.toLowerCase();
        }
      }
      
      const looseMatchIdx = strippedConcat.indexOf(strippedSearch);
      if (looseMatchIdx === -1) return [];
      
      const origStart = stripToOrigMap[looseMatchIdx];
      const origEnd = stripToOrigMap[looseMatchIdx + strippedSearch.length] || concatenated.length;
      
      const matchedItems = [];
      for (const mapping of itemMappings) {
        if (mapping.start < origEnd && mapping.end > origStart) {
          matchedItems.push(items[mapping.idx]);
        }
      }
      
      if (matchedItems.length === 0) return [];
      
      return matchedItems.map(item => {
        const [a, b, c, d, tx, ty] = item.transform;
        const itemHeight = item.height || Math.abs(d) || 12;
        const itemWidth = item.width || Math.abs(a) || (item.str.length * 6);
        
        const xPercent = tx / pageWidth;
        const yPercent = (pageHeight - ty - itemHeight) / pageHeight;
        const wPercent = itemWidth / pageWidth;
        const hPercent = itemHeight / pageHeight;
        
        return {
          x: Math.max(0, Math.min(1, xPercent)),
          y: Math.max(0, Math.min(1, yPercent)),
          width: Math.max(0.01, Math.min(1 - xPercent, wPercent)),
          height: Math.max(0.01, Math.min(1 - yPercent, hPercent))
        };
      });
    }
    
    const origStartIdx = cleanToOrigMap[matchIdx];
    const origEndIdx = cleanToOrigMap[matchIdx + searchPhrase.length] || concatenated.length;
    
    const matchedItems = [];
    for (const mapping of itemMappings) {
      if (mapping.start < origEndIdx && mapping.end > origStartIdx) {
        matchedItems.push(items[mapping.idx]);
      }
    }
    
    if (matchedItems.length === 0) return [];
    
    return matchedItems.map(item => {
      const [a, b, c, d, tx, ty] = item.transform;
      const itemHeight = item.height || Math.abs(d) || 12;
      const itemWidth = item.width || Math.abs(a) || (item.str.length * 6);
      
      const xPercent = tx / pageWidth;
      const yPercent = (pageHeight - ty - itemHeight) / pageHeight;
      const wPercent = itemWidth / pageWidth;
      const hPercent = itemHeight / pageHeight;
      
      return {
        x: Math.max(0, Math.min(1, xPercent)),
        y: Math.max(0, Math.min(1, yPercent)),
        width: Math.max(0.01, Math.min(1 - xPercent, wPercent)),
        height: Math.max(0.01, Math.min(1 - yPercent, hPercent))
      };
    });
  } catch (err) {
    console.warn(`[PDFJS coordinate resolver] Failed on page ${pageNumber}`, err);
  }
  return [];
};

export const PDFWorkspace = React.memo(({ session, activeResource }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitMode, setFitMode] = useState('page');
  const fileInputRef = useRef(null);
  const lastLoadedResourceRef = useRef(null);
  
  const resourceId = activeResource?.type === 'pdf' 
    ? (activeResource._id || activeResource.title) 
    : (session?.metadata?.pdf?.pdfFilename || session?.metadata?.pdf?.filename || fileName || 'pdf_doc');

  const [highlights, setHighlights] = useState([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [highlightError, setHighlightError] = useState(null);
  const [showHighlightsSidebar, setShowHighlightsSidebar] = useState(true);

  const [pdfDocument, setPdfDocument] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState('saved');
  const [processingSuggestions, setProcessingSuggestions] = useState(new Set());
  const [showLowSuggestions, setShowLowSuggestions] = useState(false);
  const pdfViewerRef = useRef(null);

  const fetchHighlightsList = useCallback(async () => {
    if (!resourceId) return;
    setLoadingHighlights(true);
    setHighlightError(null);
    try {
      const res = await getHighlights(resourceId);
      if (Array.isArray(res)) {
        setHighlights(res);
      }
    } catch (err) {
      console.error('Failed to load highlights:', err);
      setHighlightError('Failed to load highlights.');
    } finally {
      setLoadingHighlights(false);
    }
  }, [resourceId]);

  useEffect(() => {
    fetchHighlightsList();
  }, [fetchHighlightsList]);

  const handleSaveHighlight = useCallback(async (data) => {
    try {
      const res = await createHighlight(data);
      if (res && res._id) {
        setHighlights(prev => [...prev, res]);
        return res;
      }
    } catch (err) {
      console.error('Failed to save highlight:', err);
      throw err;
    }
  }, []);

  const handleDeleteHighlight = useCallback(async (highlightId) => {
    try {
      await deleteHighlight(highlightId);
      setHighlights(prev => prev.filter(h => h._id !== highlightId));
    } catch (err) {
      console.error('Failed to delete highlight:', err);
      alert('Failed to delete highlight.');
    }
  }, []);

  useEffect(() => {
    window.currentActiveResource = { id: resourceId, type: 'pdf' };
  }, [resourceId]);

  // Restore PDF state from activeResource or StudySession on load/session update
  useEffect(() => {
    if (!session?._id) return;

    // Use activeResource if it's a PDF, otherwise fallback to session metadata
    const isActivePdf = activeResource?.type === 'pdf';

    // Use session metadata if it belongs to the active PDF, otherwise fallback to activeResource.data
    const isSessionPdfActive = session.metadata?.pdf && (
      session.metadata.pdf.filename === activeResource?.title ||
      session.metadata.pdf.pdfFilename === activeResource?.title ||
      session.metadata.pdf._id === activeResource?._id
    );

    const currentResourceId = isActivePdf ? (activeResource._id || activeResource.title) : (session.metadata?.pdf?.pdfFilename || session.metadata?.pdf?.filename || 'default');

    // Only restore state if we actually loaded a NEW PDF resource!
    if (lastLoadedResourceRef.current !== currentResourceId) {
      lastLoadedResourceRef.current = currentResourceId;

      const pdfMeta = isActivePdf ? (activeResource.data || {}) : (session.metadata?.pdf || {});
      const savedFileName = isActivePdf ? (activeResource.title || pdfMeta.filename || pdfMeta.pdfFilename) : (pdfMeta.filename || pdfMeta.pdfFilename || '');
      const savedPage = window.__targetPdfPage || pdfMeta.pageNumber || 1;
      window.__targetPdfPage = null;
      const savedScale = pdfMeta.scale || 1.0;
      const savedFitMode = pdfMeta.fitMode || 'page';

      setPageNumber(savedPage);
      setScale(savedScale);
      setFitMode(savedFitMode);

      // If activeResource or metadata has fileData, set it directly!
      if (pdfMeta?.fileData && typeof pdfMeta.fileData === 'string' && pdfMeta.fileData.startsWith('data:application/pdf')) {
        setFile(pdfMeta.fileData);
        setFileName(savedFileName || 'Saved Document.pdf');
        inMemoryPDFCache.set(session._id, { file: pdfMeta.fileData, fileName: savedFileName });
        console.log(`[PDF Processing] Restored PDF from data source: ${savedFileName}`);
        return;
      }

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

      if (savedFileName) {
        setFileName(savedFileName);
      }
    }
  }, [session?._id, activeResource?._id, session?.metadata?.pdf?.lastOpened]);

  // Extract readable text from PDF using pdfjs-dist
  const extractPDFText = async (arrayBuffer) => {
    const pages = [];
    let successfulPages = 0;
    let failedPages = 0;
    let totalPages = 0;
    let fullText = '';

    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          
          pages.push({
            pageNumber: pageNum,
            text: pageText,
            extractionStatus: 'completed',
            wordCount: pageText.split(/\s+/).filter(Boolean).length
          });
          
          if (pageText.trim()) {
            fullText += `[Page ${pageNum}]\n${pageText}\n\n`;
          }
          successfulPages++;
        } catch (pageErr) {
          console.error(`[PDF Processing] Failed to extract page ${pageNum}:`, pageErr);
          pages.push({
            pageNumber: pageNum,
            text: '',
            extractionStatus: 'failed',
            wordCount: 0
          });
          failedPages++;
        }
      }
    } catch (err) {
      console.error('[PDF Processing] Failed to open/read PDF document:', err);
      return {
        fullText: '',
        pageCount: 0,
        totalPages: 0,
        processedPages: 0,
        successfulPages: 0,
        failedPages: 0,
        extractionStatus: 'failed',
        pages: []
      };
    }

    const processedPages = successfulPages + failedPages;
    let extractionStatus = 'completed';
    if (processedPages === 0) {
      extractionStatus = 'failed';
    } else if (failedPages > 0) {
      extractionStatus = 'partial';
    }

    return {
      fullText: fullText.trim(),
      pageCount: totalPages,
      totalPages,
      processedPages,
      successfulPages,
      failedPages,
      extractionStatus,
      pages
    };
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
        totalPages: updates.totalPages !== undefined ? updates.totalPages : currentPdfMeta.totalPages || 0,
        processedPages: updates.processedPages !== undefined ? updates.processedPages : currentPdfMeta.processedPages || 0,
        successfulPages: updates.successfulPages !== undefined ? updates.successfulPages : currentPdfMeta.successfulPages || 0,
        failedPages: updates.failedPages !== undefined ? updates.failedPages : currentPdfMeta.failedPages || 0,
        extractionStatus: updates.extractionStatus !== undefined ? updates.extractionStatus : currentPdfMeta.extractionStatus || 'completed',
        pages: updates.pages !== undefined ? updates.pages : currentPdfMeta.pages || [],
        fileData: updates.fileData !== undefined ? updates.fileData : currentPdfMeta.fileData || '',
        lastOpened: new Date().toISOString(),
      };

      const updatedMeta = {
        ...(session.metadata || {}),
        pdf: newPdfMeta,
        activeResourceType: 'pdf',
        lastTab: 'pdf'
      };

      if (updates.fileData) {
        await addResource(session._id, {
          type: 'pdf',
          url: fileName || 'Document.pdf',
          title: fileName || 'Document.pdf',
          data: newPdfMeta
        });
      } else {
        await updateStudySession(session._id, { metadata: updatedMeta, pdfCount: Math.max((session.pdfCount || 0), 1) });
      }
      
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
        let totalPages = 0;
        let processedPages = 0;
        let successfulPages = 0;
        let failedPages = 0;
        let extractionStatus = 'completed';
        let pages = [];

        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const extracted = await extractPDFText(arrayBuffer);
          extractedText = extracted.fullText;
          pageCount = extracted.pageCount;
          totalPages = extracted.totalPages;
          processedPages = extracted.processedPages;
          successfulPages = extracted.successfulPages;
          failedPages = extracted.failedPages;
          extractionStatus = extracted.extractionStatus;
          pages = extracted.pages;
          console.log(`[PDF Processing] Extracted ${extractedText.length} chars of text from ${pageCount} pages. Status: ${extractionStatus}`);
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
          totalPages,
          processedPages,
          successfulPages,
          failedPages,
          extractionStatus,
          pages,
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
    lastLoadedResourceRef.current = null;
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

  const onDocumentLoadSuccess = useCallback((doc) => {
    if (doc) {
      setNumPages(doc.numPages);
      setPdfDocument(doc);
    }
  }, []);

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

  useEffect(() => {
    const handleJumpPage = (e) => {
      const targetPage = parseInt(e.detail?.page, 10);
      if (!isNaN(targetPage) && targetPage > 0) {
        handlePageChange(targetPage);
      }
    };
    window.addEventListener('jump-to-pdf-page', handleJumpPage);
    return () => {
      window.removeEventListener('jump-to-pdf-page', handleJumpPage);
    };
  }, [handlePageChange]);

  const loadPageSuggestions = useCallback(async (pageNum, isRegen = false) => {
    if (!resourceId || !session?._id) return;

    console.log(`[SmartHighlights] REQUEST START\nresourceId: ${resourceId}\npageNumber: ${pageNum}\npageNumberType: ${typeof pageNum}`);

    setLoadingSuggestions(true);
    setSuggestionsError(null);
    
    try {
      const apiCall = isRegen 
        ? regenerateSmartHighlightsForPage(resourceId, pageNum, session._id)
        : analyzeSmartHighlightsForPage(resourceId, pageNum, session._id);
      
      const res = await apiCall;

      console.log(`[SmartHighlights] RESPONSE\nhttpStatus: 200\nresponse:`, res);
      
      if (pageNum !== pageNumber) {
        console.log(`[SmartHighlights] Stale page response ignored. page=${pageNum}, current=${pageNumber}`);
        return;
      }

      if (res && Array.isArray(res.suggestions)) {
        if (res.status === 'no_text') {
          setAiSuggestions([]);
          setSuggestionsError(`No extractable text found on page ${pageNum}.`);
        } else {
          setAiSuggestions(res.suggestions);
          setSuggestionsError(null);
        }
      } else {
        console.error('[SmartHighlights] Response structure invalid:', res);
        setSuggestionsError('AI returned an invalid response. Please retry.');
      }
    } catch (err) {
      console.error(`[SmartHighlights] REQUEST ERROR\nstatus: ${err.statusCode || 0}\nmessage: ${err.message}\ncode: ${err.statusCode || 'UNKNOWN'}`);

      if (pageNum === pageNumber) {
        const status = err.statusCode;
        if (status === 401) {
          setSuggestionsError('Your session has expired. Please log in again.');
        } else if (status === 403) {
          setSuggestionsError('You do not have access to this PDF.');
        } else if (status === 404) {
          setSuggestionsError('PDF resource not found.');
        } else if (status === 400) {
          setSuggestionsError(err.message || 'Invalid PDF page.');
        } else if (status === 429) {
          setSuggestionsError('AI service is temporarily rate limited. Please retry.');
        } else if (status === 408) {
          setSuggestionsError('AI analysis timed out. Please retry.');
        } else {
          setSuggestionsError(err.message || `Unable to analyze page ${pageNum}.`);
        }
      }
    } finally {
      if (pageNum === pageNumber) {
        setLoadingSuggestions(false);
      }
    }
  }, [resourceId, session, pageNumber]);

  useEffect(() => {
    setAiSuggestions([]);
    setSuggestionsError(null);
    setShowLowSuggestions(false);

    if (showHighlightsSidebar && activeSidebarTab === 'ai' && resourceId && pageNumber) {
      loadPageSuggestions(pageNumber);
    }
  }, [resourceId, pageNumber, showHighlightsSidebar, activeSidebarTab, loadPageSuggestions]);

  const handleGenerateSmartHighlights = useCallback(async () => {
    if (!resourceId || !pageNumber || !session?._id) return;
    await loadPageSuggestions(pageNumber);
  }, [resourceId, pageNumber, session, loadPageSuggestions]);

  const handleRegeneratePageSuggestions = useCallback(async () => {
    if (!resourceId || !pageNumber || !session?._id) return;
    await loadPageSuggestions(pageNumber, true);
  }, [resourceId, pageNumber, session, loadPageSuggestions]);

  const handleAcceptSuggestion = useCallback(async (sug, focusInSidebar = false) => {
    if (!resourceId) return;
    const sugId = sug._id || sug.id;
    
    if (focusInSidebar) {
      setShowHighlightsSidebar(true);
      setActiveSidebarTab('ai');
      handlePageChange(sug.pageNumber);
      return;
    }

    if (processingSuggestions.has(sugId)) return;
    setProcessingSuggestions(prev => new Set([...prev, sugId]));

    try {
      let rects = [];
      if (pdfDocument) {
        rects = await getTextRectsFromPDFJS(pdfDocument, sug.pageNumber, sug.text);
      }
      
      if (rects.length === 0) {
        rects = pdfViewerRef.current?.getRectsForText(sug.pageNumber, sug.text) || [];
      }

      if (rects.length === 0) {
        alert(`Unable to automatically resolve coordinates for this text on Page ${sug.pageNumber}. Please make sure the page is loaded and try again.`);
        return;
      }

      const res = await acceptSmartHighlights(resourceId, [
        { suggestionId: sugId, rects }
      ]);
      const highlightsList = Array.isArray(res) ? res : (res && Array.isArray(res.highlights) ? res.highlights : []);
      if (highlightsList.length > 0) {
        setHighlights(prev => [...prev, ...highlightsList]);
        setAiSuggestions(prev => prev.filter(item => (item._id || item.id) !== sugId));
      } else {
        alert('Unable to save this highlight. Please try again.');
      }
    } catch (err) {
      console.error('Failed to accept smart highlight:', err);
      alert(err.message || 'Unable to save this highlight. Please try again.');
    } finally {
      setProcessingSuggestions(prev => {
        const next = new Set(prev);
        next.delete(sugId);
        return next;
      });
    }
  }, [resourceId, pdfDocument, processingSuggestions, handlePageChange]);

  const handleRejectSuggestion = useCallback(async (sug) => {
    if (!resourceId) return;
    const sugId = sug._id || sug.id;
    if (processingSuggestions.has(sugId)) return;
    setProcessingSuggestions(prev => new Set([...prev, sugId]));
    
    try {
      await rejectSmartHighlightSingle(resourceId, sugId);
      setAiSuggestions(prev => prev.filter(item => (item._id || item.id) !== sugId));
    } catch (err) {
      console.error('Failed to reject smart highlight:', err);
      alert(err.message || 'Failed to reject smart highlight.');
    } finally {
      setProcessingSuggestions(prev => {
        const next = new Set(prev);
        next.delete(sugId);
        return next;
      });
    }
  }, [resourceId, processingSuggestions]);

  const handleAcceptAllSuggestions = useCallback(async () => {
    if (!resourceId || aiSuggestions.length === 0) return;
    
    const sugIds = aiSuggestions.map(s => s._id || s.id);
    setProcessingSuggestions(prev => new Set([...prev, ...sugIds]));

    const accepts = [];
    const failedSuggestions = [];

    for (const sug of aiSuggestions) {
      try {
        let rects = [];
        if (pdfDocument) {
          rects = await getTextRectsFromPDFJS(pdfDocument, sug.pageNumber, sug.text);
        }
        if (rects.length === 0) {
          rects = pdfViewerRef.current?.getRectsForText(sug.pageNumber, sug.text) || [];
        }
        
        if (rects.length > 0) {
          accepts.push({ suggestionId: sug._id || sug.id, rects });
        } else {
          failedSuggestions.push(sug);
        }
      } catch (err) {
        console.error(`Failed to map rects for suggestion: ${sug._id || sug.id}`, err);
        failedSuggestions.push(sug);
      }
    }

    if (accepts.length === 0) {
      alert("Unable to resolve coordinates for any of the suggestions. Please make sure the document is loaded.");
      setProcessingSuggestions(prev => {
        const next = new Set(prev);
        sugIds.forEach(id => next.delete(id));
        return next;
      });
      return;
    }

    try {
      const res = await acceptAllSmartHighlights(resourceId, accepts);
      const highlightsList = Array.isArray(res) ? res : (res && Array.isArray(res.highlights) ? res.highlights : []);
      if (highlightsList.length > 0) {
        setHighlights(prev => [...prev, ...highlightsList]);
        const acceptedIds = accepts.map(a => a.suggestionId);
        setAiSuggestions(prev => prev.filter(s => !acceptedIds.includes(s._id || s.id)));

        if (failedSuggestions.length > 0) {
          alert(`Accepted ${highlightsList.length} suggestions. ${failedSuggestions.length} suggestions could not be saved because their text layout could not be resolved.`);
        }
      } else {
        alert('Failed to save highlights. Please try again.');
      }
    } catch (err) {
      console.error('Failed to accept all smart highlights:', err);
      alert(err.message || 'Failed to accept all smart highlights. Please try again.');
    } finally {
      setProcessingSuggestions(prev => {
        const next = new Set(prev);
        sugIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [resourceId, pdfDocument, aiSuggestions]);

  const handleRejectAllSuggestions = useCallback(async () => {
    if (!resourceId || aiSuggestions.length === 0) return;
    const sugIds = aiSuggestions.map(s => s._id || s.id);
    setProcessingSuggestions(prev => new Set([...prev, ...sugIds]));

    try {
      await rejectSmartHighlights(resourceId, sugIds);
      setAiSuggestions([]);
    } catch (err) {
      console.error('Failed to reject all smart highlights:', err);
      alert(err.message || 'Failed to reject all smart highlights.');
    } finally {
      setProcessingSuggestions(prev => {
        const next = new Set(prev);
        sugIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [resourceId, aiSuggestions]);

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
        showHighlights={showHighlightsSidebar}
        onToggleHighlights={() => setShowHighlightsSidebar(prev => !prev)}
        showSmartHighlights={showHighlightsSidebar}
        onToggleSmartHighlights={() => setShowHighlightsSidebar(prev => !prev)}
      />

      {/* Main Content / Viewport */}
      {file ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', width: '100%' }}>
          <PDFViewer
            ref={pdfViewerRef}
            file={file}
            pageNumber={pageNumber}
            scale={scale}
            fitMode={fitMode}
            resourceId={resourceId}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            onDocumentLoadError={onDocumentLoadError}
            onPageChange={handlePageChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRetry={handleOpenClick}
            highlights={highlights}
            setHighlights={setHighlights}
            createHighlight={handleSaveHighlight}
            deleteHighlight={handleDeleteHighlight}
            aiSuggestions={aiSuggestions}
            onAcceptSuggestion={handleAcceptSuggestion}
          />
          
          {showHighlightsSidebar && (
            <div style={{
              width: '280px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(15, 18, 26, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
              flexShrink: 0
            }}>
              {/* Sidebar Header */}
              <div style={{
                padding: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(20, 25, 35, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
                  SMART HIGHLIGHTS
                </span>
                <span style={{
                  fontSize: '0.6rem',
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  color: '#c084fc',
                  padding: '2px 6px',
                  borderRadius: '100px',
                  fontWeight: 700
                }}>
                  Active
                </span>
              </div>

              {/* Tab Selector Header */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(20, 25, 35, 0.8)',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setActiveSidebarTab('saved')}
                  style={{
                    flex: 1,
                    padding: '12px 6px',
                    border: 'none',
                    background: 'none',
                    color: activeSidebarTab === 'saved' ? '#66b8ff' : 'rgba(255,255,255,0.4)',
                    borderBottom: activeSidebarTab === 'saved' ? '2px solid #66b8ff' : '2px solid transparent',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <BookOpen size={13} />
                  <span>Saved ({highlights.length})</span>
                </button>
                <button
                  onClick={() => setActiveSidebarTab('ai')}
                  style={{
                    flex: 1,
                    padding: '12px 6px',
                    border: 'none',
                    background: 'none',
                    color: activeSidebarTab === 'ai' ? '#a855f7' : 'rgba(255,255,255,0.4)',
                    borderBottom: activeSidebarTab === 'ai' ? '2px solid #a855f7' : '2px solid transparent',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={13} />
                  <span>AI Suggestions ({aiSuggestions.length})</span>
                </button>
              </div>

              {/* Tab Content Panel */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px'
              }}>
                {activeSidebarTab === 'saved' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      padding: '2px 2px 8px 2px',
                      fontSize: '0.675rem',
                      color: 'rgba(255,255,255,0.4)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      Select text in the PDF to create manual highlights.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {loadingHighlights ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', padding: '10px' }}>
                          Loading highlights...
                        </div>
                      ) : highlights.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', padding: '10px' }}>
                          No highlights saved yet.
                        </div>
                      ) : (
                        highlights.map((h) => (
                          <div 
                            key={h._id} 
                            onClick={() => handlePageChange(h.pageNumber)}
                            style={{
                              padding: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              borderLeft: `3px solid ${getHighlightColor(h.type)}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              transition: 'all 0.2s ease',
                              position: 'relative'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: '#66b8ff', fontWeight: 700 }}>
                                Page {h.pageNumber}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{
                                  fontSize: '0.5rem',
                                  color: getHighlightColor(h.type),
                                  textTransform: 'uppercase',
                                  fontWeight: 800,
                                  letterSpacing: '0.5px'
                                }}>
                                  {h.type}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('trigger-explain', {
                                      detail: { concept: h.text, resourceId, source: 'pdf' }
                                    }));
                                  }}
                                  style={{
                                    border: 'none', background: 'none', color: 'rgba(102, 184, 255, 0.7)',
                                    cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center',
                                    marginRight: '2px'
                                  }}
                                  title="Explain Highlight"
                                >
                                  <BookOpen size={11} />
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    handleDeleteHighlight(h._id);
                                  }}
                                  style={{
                                    border: 'none', background: 'none', color: 'rgba(248, 113, 113, 0.6)',
                                    cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center'
                                  }}
                                  title="Delete Highlight"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                            <p style={{
                              fontSize: '0.675rem',
                              color: 'rgba(255,255,255,0.85)',
                              margin: 0,
                              lineHeight: '1.25',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              "{h.text}"
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loadingSuggestions ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', gap: '8px' }}>
                        <div className="pdf-spinner" />
                        <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 700, textAlign: 'center' }}>
                          Analyzing page {pageNumber}...
                        </span>
                      </div>
                    ) : suggestionsError ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#f87171', textAlign: 'center', fontWeight: 700 }}>
                          Unable to analyze page {pageNumber}.
                        </span>
                        <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                          {suggestionsError}
                        </span>
                        <button
                          onClick={() => loadPageSuggestions(pageNumber)}
                          style={{
                            padding: '6px 12px', border: 'none', borderRadius: '4px',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#c084fc',
                            fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : aiSuggestions.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', gap: '8px' }}>
                        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0, padding: '0 8px', lineHeight: '1.3' }}>
                          AI Smart Highlights analyzes the text of the PDF to suggest key terms, definitions, and important formulas.
                        </p>
                        <button
                          onClick={handleGenerateSmartHighlights}
                          style={{
                            marginTop: '4px',
                            padding: '8px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 4px 10px rgba(124, 58, 237, 0.2)'
                          }}
                        >
                          <Sparkles size={11} />
                          <span>AI smart highlights</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Bulk Controls */}
                        <div style={{ display: 'flex', gap: '6px', paddingBottom: '4px' }}>
                          <button
                            onClick={handleAcceptAllSuggestions}
                            disabled={processingSuggestions.size > 0}
                            style={{
                              flex: 1, padding: '5px', border: 'none', borderRadius: '4px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                              fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                              opacity: processingSuggestions.size > 0 ? 0.5 : 1
                            }}
                          >
                            Accept All
                          </button>
                          <button
                            onClick={handleRejectAllSuggestions}
                            disabled={processingSuggestions.size > 0}
                            style={{
                              flex: 1, padding: '5px', border: 'none', borderRadius: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171',
                              fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                              opacity: processingSuggestions.size > 0 ? 0.5 : 1
                            }}
                          >
                            Reject All
                          </button>
                          <button
                            onClick={handleRegeneratePageSuggestions}
                            style={{
                              flex: 1, padding: '5px', border: 'none', borderRadius: '4px',
                              backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#c084fc',
                              fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            Regenerate
                          </button>
                        </div>

                        {/* Suggestions list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(showLowSuggestions ? aiSuggestions : aiSuggestions.filter(s => s.importanceLevel !== 'LOW')).map((sug) => {
                            const sugId = sug._id || sug.id;
                            const isProcessing = processingSuggestions.has(sugId);
                            
                            return (
                              <div
                                key={sugId}
                                onClick={() => handlePageChange(sug.pageNumber)}
                                style={{
                                  padding: '8px',
                                  backgroundColor: 'rgba(168, 85, 247, 0.02)',
                                  border: '1px solid rgba(168, 85, 247, 0.06)',
                                  borderLeft: '3px solid #a855f7',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  transition: 'all 0.2s ease',
                                  opacity: isProcessing ? 0.6 : 1
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{
                                      fontSize: '0.525rem',
                                      fontWeight: 850,
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      backgroundColor: sug.importanceLevel === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : sug.importanceLevel === 'LOW' ? 'rgba(156, 163, 175, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                      color: sug.importanceLevel === 'HIGH' ? '#f87171' : sug.importanceLevel === 'LOW' ? '#9ca3af' : '#fbbf24',
                                      textTransform: 'uppercase'
                                    }}>
                                      {sug.importanceLevel || 'MEDIUM'}
                                    </span>
                                    <span style={{ fontSize: '0.6rem', color: '#c084fc', fontWeight: 700 }}>
                                      Page {sug.pageNumber}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '0.5rem',
                                    backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                    color: '#e9d5ff',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    {sug.category.replace('_', ' ')}
                                  </span>
                                </div>

                                <p style={{
                                  fontSize: '0.675rem',
                                  color: 'rgba(255,255,255,0.85)',
                                  margin: 0,
                                  lineHeight: '1.25',
                                  fontStyle: 'italic',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  "{sug.text}"
                                </p>

                                {sug.reason && (
                                  <p style={{
                                    fontSize: '0.6rem',
                                    color: 'rgba(255,255,255,0.45)',
                                    margin: 0,
                                    lineHeight: '1.2'
                                  }}>
                                    <strong>Why:</strong> {sug.reason}
                                  </p>
                                )}

                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRejectSuggestion(sug);
                                    }}
                                    disabled={isProcessing}
                                    style={{
                                      border: 'none', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                                      fontSize: '0.575rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                                      opacity: isProcessing ? 0.5 : 1
                                    }}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptSuggestion(sug);
                                    }}
                                    disabled={isProcessing}
                                    style={{
                                      border: 'none', background: '#a855f7', color: '#fff',
                                      fontSize: '0.575rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                                      opacity: isProcessing ? 0.5 : 1
                                    }}
                                  >
                                    {isProcessing ? 'Saving...' : 'Accept'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {!showLowSuggestions && aiSuggestions.filter(s => s.importanceLevel === 'LOW').length > 0 && (
                            <button
                              onClick={() => setShowLowSuggestions(true)}
                              style={{
                                marginTop: '8px',
                                padding: '6px 12px',
                                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                                border: '1px dashed rgba(168, 85, 247, 0.25)',
                                borderRadius: '6px',
                                color: '#c084fc',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Show more suggestions (+{aiSuggestions.filter(s => s.importanceLevel === 'LOW').length})
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
