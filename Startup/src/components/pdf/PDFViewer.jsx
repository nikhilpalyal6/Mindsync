import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle, RefreshCw } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const getHighlightColor = (type) => {
  switch (type) {
    case 'concept':
      return 'rgba(168, 85, 247, 0.45)'; // Purple
    case 'definition':
      return 'rgba(16, 185, 129, 0.45)'; // Green
    case 'formula':
      return 'rgba(59, 130, 246, 0.45)'; // Blue
    case 'personal':
      return 'rgba(236, 72, 153, 0.45)'; // Pink
    case 'important':
    default:
      return 'rgba(251, 191, 36, 0.45)'; // Yellow
  }
};

export const PDFViewer = React.memo(forwardRef(({
  file,
  pageNumber,
  scale,
  fitMode,
  resourceId,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onRetry,
  highlights = [],
  setHighlights,
  createHighlight,
  deleteHighlight,
  aiSuggestions = [],
  onAcceptSuggestion
}, ref) => {
  const containerRef = useRef(null);
  const pageRefs = useRef({});
  const [containerWidth, setContainerWidth] = useState(800);
  const [numPages, setNumPages] = useState(0);
  const isScrollingToPageRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Selection Floating Toolbar State
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarCoords, setToolbarCoords] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [selectedHighlightType, setSelectedHighlightType] = useState('important');
  const [tempHighlightData, setTempHighlightData] = useState(null);
  
  const [activeDeleteHighlight, setActiveDeleteHighlight] = useState(null);
  const [copied, setCopied] = useState(false);

  const findTextRectsOnPage = useCallback((pageNumber, searchText) => {
    const pageEl = pageRefs.current[pageNumber];
    if (!pageEl || !searchText) return [];
    
    const textLayer = pageEl.querySelector('.textLayer');
    if (!textLayer) return [];

    const pageRect = pageEl.getBoundingClientRect();
    const cleanSearchText = searchText.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!cleanSearchText) return [];

    const textNodes = [];
    let concatenatedText = '';
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      textNodes.push({
        node,
        startIdx: concatenatedText.length,
        endIdx: concatenatedText.length + node.nodeValue.length
      });
      concatenatedText += node.nodeValue;
    }

    const cleanConcatenated = concatenatedText.replace(/\s+/g, ' ').toLowerCase();
    const cleanMatchIdx = cleanConcatenated.indexOf(cleanSearchText);
    if (cleanMatchIdx === -1) return [];

    let origStartIdx = -1;
    let origEndIdx = -1;
    
    let cleanCursor = 0;
    let origCursor = 0;
    
    while (origCursor < concatenatedText.length) {
      const charOrig = concatenatedText[origCursor];
      const isWhitespaceOrig = /\s/.test(charOrig);
      
      if (cleanCursor === cleanMatchIdx && origStartIdx === -1) {
        origStartIdx = origCursor;
      }
      
      if (origStartIdx !== -1 && cleanCursor === cleanMatchIdx + cleanSearchText.length) {
        origEndIdx = origCursor;
        break;
      }
      
      if (isWhitespaceOrig) {
        if (origCursor === 0 || !/\s/.test(concatenatedText[origCursor - 1])) {
          if (origStartIdx !== -1) {
            cleanCursor++;
          }
        }
      } else {
        if (origStartIdx !== -1) {
          cleanCursor++;
        }
        if (origStartIdx === -1) {
          cleanCursor++;
        }
      }
      origCursor++;
    }
    
    if (origStartIdx === -1 || origEndIdx === -1) return [];

    let startNodeInfo = null;
    let endNodeInfo = null;
    
    for (const info of textNodes) {
      if (origStartIdx >= info.startIdx && origStartIdx <= info.endIdx) {
        startNodeInfo = { node: info.node, offset: origStartIdx - info.startIdx };
      }
      if (origEndIdx >= info.startIdx && origEndIdx <= info.endIdx) {
        endNodeInfo = { node: info.node, offset: origEndIdx - info.startIdx };
        break;
      }
    }

    if (!startNodeInfo || !endNodeInfo) return [];

    try {
      const range = document.createRange();
      range.setStart(startNodeInfo.node, startNodeInfo.offset);
      range.setEnd(endNodeInfo.node, endNodeInfo.offset);
      
      const clientRects = range.getClientRects();
      const rects = [];
      for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i];
        rects.push({
          x: Math.max(0, (r.left - pageRect.left) / pageRect.width),
          y: Math.max(0, (r.top - pageRect.top) / pageRect.height),
          width: Math.min(1, r.width / pageRect.width),
          height: Math.min(1, r.height / pageRect.height)
        });
      }
      return rects;
    } catch (err) {
      console.warn('[PDF Suggestions] Range mapping failed', err);
      return [];
    }
  }, []);

  useImperativeHandle(ref, () => ({
    getRectsForText(pageNumber, text) {
      return findTextRectsOnPage(pageNumber, text);
    }
  }));

  const handleCopy = useCallback(async () => {
    if (!selectedText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(selectedText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = selectedText;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowToolbar(false);
        window.getSelection()?.removeAllRanges();
      }, 1000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      alert('Failed to copy text.');
    }
  }, [selectedText]);

  const handleSelection = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && containerRef.current) {
        try {
          const range = selection.getRangeAt(0);
          const startContainer = range.startContainer;
          const pageElement = startContainer.nodeType === Node.ELEMENT_NODE 
            ? startContainer.closest('.react-pdf__Page')
            : startContainer.parentElement?.closest('.react-pdf__Page');
            
          if (!pageElement) return;
          
          const pageNumAttr = pageElement.getAttribute('data-page-number');
          const pageNumberVal = parseInt(pageNumAttr, 10);
          
          const pageRect = pageElement.getBoundingClientRect();
          const clientRects = range.getClientRects();
          if (clientRects.length === 0) return;
          
          const rects = [];
          for (let i = 0; i < clientRects.length; i++) {
            const r = clientRects[i];
            
            // Check if the rectangle is inside the page boundary
            if (r.bottom < pageRect.top || r.top > pageRect.bottom) {
              continue;
            }
            
            // Convert to page relative coordinates
            const x = Math.max(0, r.left - pageRect.left);
            const y = Math.max(0, r.top - pageRect.top);
            const w = Math.min(r.width, pageRect.width - x);
            const h = Math.min(r.height, pageRect.height - y);
            
            // Normalize by page width and height
            rects.push({
              x: x / pageRect.width,
              y: y / pageRect.height,
              width: w / pageRect.width,
              height: h / pageRect.height
            });
          }
          
          if (rects.length === 0) return;
          
          const rect = range.getBoundingClientRect();
          const viewportRect = containerRef.current.getBoundingClientRect();
          
          setToolbarCoords({
            x: rect.left - viewportRect.left + (rect.width / 2) + containerRef.current.scrollLeft,
            y: rect.top - viewportRect.top - 45 + containerRef.current.scrollTop
          });
          
          setSelectedText(text);
          setTempHighlightData({
            resourceId,
            pageNumber: pageNumberVal,
            text,
            rects
          });
          setShowToolbar(true);
          setIsHighlightMode(false);
        } catch (err) {
          console.warn('Error computing selection coords:', err);
        }
      } else {
        const selection = window.getSelection();
        if (!selection.toString().trim() && !isHighlightMode) {
          setShowToolbar(false);
        }
      }
    }, 50);
  }, [resourceId, isHighlightMode]);

  const handleHighlightClick = (e, h) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportRect = containerRef.current.getBoundingClientRect();
    
    setActiveDeleteHighlight({
      id: h._id || h.id,
      text: h.text,
      coords: {
        x: rect.left - viewportRect.left + (rect.width / 2) + containerRef.current.scrollLeft,
        y: rect.top - viewportRect.top - 40 + containerRef.current.scrollTop
      }
    });
  };

  const handlePageRenderSuccess = useCallback((pageNum) => {
    // No-op - using scale-independent CSS percentages
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (showToolbar && !e.target.closest('.pdf-context-toolbar')) {
        setShowToolbar(false);
        setIsHighlightMode(false);
      }
      if (activeDeleteHighlight && !e.target.closest('.pdf-delete-tooltip')) {
        setActiveDeleteHighlight(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [showToolbar, activeDeleteHighlight]);

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

  // Scroll to selected page when pageNumber, scale, fitMode, or numPages changes
  useEffect(() => {
    if (pageNumber && pageRefs.current[pageNumber] && containerRef.current) {
      isScrollingToPageRef.current = true;
      
      // Use instant scroll for zoom/resize changes and page navigation to prevent race conditions
      pageRefs.current[pageNumber].scrollIntoView({ behavior: 'auto', block: 'start' });
      console.log(`[PDF Scroll Position Saved] Restored viewport to Page ${pageNumber}`);

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingToPageRef.current = false;
      }, 150);
    }
  }, [pageNumber, scale, fitMode, numPages]);

  // Handle scroll detection for automatic page number updating
  const handleScroll = useCallback(() => {
    if (isScrollingToPageRef.current) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingToPageRef.current = false;
      }, 150);
      return;
    }

    if (!containerRef.current || numPages === 0) return;

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          onZoomIn?.();
        } else {
          onZoomOut?.();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [onZoomIn, onZoomOut]);

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
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            left: `${toolbarCoords.x}px`,
            top: `${toolbarCoords.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: isHighlightMode ? 'column' : 'row',
            alignItems: isHighlightMode ? 'stretch' : 'center',
            gap: '6px',
            backgroundColor: 'rgba(15, 18, 26, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            width: isHighlightMode ? '220px' : 'auto',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {!isHighlightMode ? (
            <>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('trigger-explain', {
                    detail: { concept: selectedText, resourceId, source: 'pdf' }
                  }));
                  setShowToolbar(false);
                  window.getSelection()?.removeAllRanges();
                }}
                style={{
                  border: 'none', background: 'none', color: '#66b8ff', fontSize: '0.725rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Explain
              </button>
              <button 
                onClick={handleCopy}
                style={{
                  border: 'none', background: 'none', color: copied ? '#10b981' : '#fff', fontSize: '0.725rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: copied ? 700 : 'normal'
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button 
                onClick={() => {
                  setIsHighlightMode(true);
                }}
                style={{
                  border: 'none', background: 'none', color: '#fff', fontSize: '0.725rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Highlight
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                Save Highlight
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {['important', 'concept', 'definition', 'formula', 'personal'].map((t) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="highlightType" 
                      checked={selectedHighlightType === t} 
                      onChange={() => setSelectedHighlightType(t)} 
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ textTransform: 'capitalize' }}>
                      {t}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button 
                  onClick={() => {
                    setIsHighlightMode(false);
                  }}
                  style={{
                    border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.65rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!tempHighlightData) return;
                    try {
                      const res = await createHighlight({
                        ...tempHighlightData,
                        type: selectedHighlightType
                      });
                      if (res && res._id) {
                        window.getSelection()?.removeAllRanges();
                      }
                    } catch (err) {
                      console.error('Failed to save highlight:', err);
                      alert(err.message || 'Failed to save highlight.');
                    } finally {
                      setShowToolbar(false);
                      setIsHighlightMode(false);
                    }
                  }}
                  style={{
                    border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  Save
                </button>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Floating delete context menu */}
      {activeDeleteHighlight && (
        <div 
          className="pdf-delete-tooltip"
          style={{
            position: 'absolute',
            left: `${activeDeleteHighlight.coords.x}px`,
            top: `${activeDeleteHighlight.coords.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '4px 8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 700,
            animation: 'fadeIn 0.1s ease-out'
          }}
        >
          <span>Delete Highlight?</span>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await deleteHighlight(activeDeleteHighlight.id);
              } catch (err) {
                console.error('Failed to delete highlight:', err);
                alert('Failed to delete highlight.');
              } finally {
                setActiveDeleteHighlight(null);
              }
            }}
            style={{
              border: 'none',
              background: '#fff',
              color: '#ef4444',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDeleteHighlight(null);
            }}
            style={{
              border: 'none',
              background: 'none',
              color: '#fff',
              fontSize: '0.65rem',
              padding: '2px 4px',
              cursor: 'pointer'
            }}
          >
            Cancel
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
                style={{ marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', borderRadius: '4px', position: 'relative' }}
              >
                <Page
                  pageNumber={pageNum}
                  scale={fitMode === 'width' ? 1.0 : scale}
                  width={computedWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  onRenderSuccess={() => handlePageRenderSuccess(pageNum)}
                  loading={
                    <div className="pdf-status-box" style={{ minHeight: '400px' }}>
                      <div className="pdf-spinner" />
                      <span style={{ fontSize: '0.8rem' }}>Rendering Page {pageNum}...</span>
                    </div>
                  }
                />
                
                {/* Custom Highlight overlays for this page using normalized scale-independent percentage ratios */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                  {highlights.filter(h => h.pageNumber === pageNum).map(h => (
                    h.rects && h.rects.map((rect, idx) => (
                      <div
                        key={`${h._id || h.id}_${idx}`}
                        onClick={(e) => handleHighlightClick(e, h)}
                        style={{
                          position: 'absolute',
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.width * 100}%`,
                          height: `${rect.height * 100}%`,
                          backgroundColor: getHighlightColor(h.type),
                          opacity: 0.35,
                          cursor: 'pointer',
                          pointerEvents: 'auto'
                        }}
                        title={`Click to delete ${h.type} highlight`}
                      />
                    ))
                  ))}

                  {/* AI Suggestion Overlays */}
                  {aiSuggestions.filter(s => s.pageNumber === pageNum).map(s => (
                    <AISuggestionOverlay
                      key={`ai_sug_${s._id || s.id}`}
                      pageNumber={pageNum}
                      text={s.text}
                      category={s.category}
                      pageRefs={pageRefs}
                      scale={scale}
                      fitMode={fitMode}
                      findTextRectsOnPage={findTextRectsOnPage}
                      onClick={() => {
                        onAcceptSuggestion?.(s, true);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : null}
      </Document>
    </div>
  );
}));

const AISuggestionOverlay = React.memo(({ pageNumber, text, category, pageRefs, scale, fitMode, onClick, findTextRectsOnPage }) => {
  const [rects, setRects] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const computed = findTextRectsOnPage(pageNumber, text);
      setRects(computed);
    }, 150);
    return () => clearTimeout(timer);
  }, [pageNumber, text, scale, fitMode, pageRefs, findTextRectsOnPage]);

  return (
    <>
      {rects.map((rect, idx) => (
        <div
          key={`${pageNumber}_suggest_${idx}`}
          onClick={onClick}
          style={{
            position: 'absolute',
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            borderBottom: '2px dashed #a855f7',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 1
          }}
          title={`AI Suggested Highlight: ${category}. Click to review.`}
        />
      ))}
    </>
  );
});
AISuggestionOverlay.displayName = 'AISuggestionOverlay';

PDFViewer.displayName = 'PDFViewer';
export default PDFViewer;
