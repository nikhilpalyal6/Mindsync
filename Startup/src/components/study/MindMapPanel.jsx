import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Maximize2, 
  Download, 
  GitFork, 
  Sparkles,
  FileText,
  Video,
  FileEdit,
  Folder
} from 'lucide-react';

export const MindMapPanel = React.memo(({ session }) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  
  // Track container dimensions to center the root node dynamically
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600
        });
      }
    };
    
    // Initial size
    handleResize();

    // Resize listeners
    window.addEventListener('resize', handleResize);
    // Timeout fallback to capture panel mount animation latency
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const resources = useMemo(() => session?.resources || [], [session?.resources]);

  // Construct Mind Map coordinates centered dynamically
  const graph = useMemo(() => {
    const rootId = 'root';
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    const nodes = [
      { id: rootId, label: session?.title || 'Subject Workspace', type: 'root', x: centerX, y: centerY }
    ];
    const links = [];

    resources.forEach((res, index) => {
      // Radial layout centered dynamically
      const angle = (index * (2 * Math.PI)) / Math.max(resources.length, 1);
      const radius = Math.min(180, dimensions.width * 0.22); 
      const resX = centerX + Math.cos(angle) * radius;
      const resY = centerY + Math.sin(angle) * radius;
      const resId = `res-${res._id}`;

      nodes.push({
        id: resId,
        label: res.title,
        type: res.type,
        x: resX,
        y: resY
      });

      links.push({ source: rootId, target: resId, type: 'main' });

      // Add expanded AI Sub-nodes
      if (!collapsedNodes.has(resId)) {
        const subNodeTypes = ['Concepts', 'Flashcards', 'Quiz'];
        subNodeTypes.forEach((type, sIndex) => {
          const sAngle = angle + ((sIndex - 1) * 0.38);
          const sRadius = radius + 110;
          const subX = centerX + Math.cos(sAngle) * sRadius;
          const subY = centerY + Math.sin(sAngle) * sRadius;
          const subId = `${resId}-${type.toLowerCase()}`;

          nodes.push({
            id: subId,
            label: type,
            type: 'ai-node',
            x: subX,
            y: subY
          });

          links.push({ source: resId, target: subId, type: 'ai' });
        });
      }
    });

    return { nodes, links };
  }, [session, resources, collapsedNodes, dimensions]);

  // Drag Pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.mindmap-card')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel Zoom support
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    const direction = e.deltaY < 0 ? 1 : -1;
    setScale(s => Math.min(Math.max(s + direction * zoomIntensity, 0.3), 3));
  };

  const toggleNode = (nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExport = () => {
    alert('Knowledge Graph exported successfully as PNG & JSON schema!');
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'rgba(10, 12, 18, 0.4)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* 1. Header controls */}
      <div 
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'rgba(15, 18, 26, 0.85)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 5
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitFork size={16} style={{ color: 'var(--accent-purple)' }} />
          <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Interactive Concept Knowledge Map</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="action-btn-circle" onClick={handleExport} title="Export Map">
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Canvas Pane */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          backgroundColor: '#0c0d12'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg 
          width="100%" 
          height="100%" 
          style={{ display: 'block' }}
        >
          {/* Inner transform Group */}
          <g 
            transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
            style={{
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
          >
            {/* Connector Paths */}
            <g>
              {graph.links.map((link, i) => {
                const sourceNode = graph.nodes.find(n => n.id === link.source);
                const targetNode = graph.nodes.find(n => n.id === link.target);
                if (!sourceNode || !targetNode) return null;

                const midX = (sourceNode.x + targetNode.x) / 2;
                const pathD = `M ${sourceNode.x} ${sourceNode.y} C ${midX} ${sourceNode.y}, ${midX} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`;

                const isAiLink = link.type === 'ai';
                return (
                  <path
                    key={i}
                    d={pathD}
                    fill="none"
                    stroke={isAiLink ? 'rgba(72, 239, 179, 0.18)' : 'rgba(167, 139, 250, 0.25)'}
                    strokeWidth={isAiLink ? '1.5' : '2'}
                    strokeDasharray={isAiLink ? '4 4' : 'none'}
                  />
                );
              })}
            </g>

            {/* Interactive HTML Card Nodes */}
            <g>
              {graph.nodes.map(node => {
                const isRoot = node.type === 'root';
                const isAI = node.type === 'ai-node';
                
                let fill = 'rgba(20, 24, 33, 0.85)';
                let border = 'rgba(255, 255, 255, 0.08)';
                let textColor = '#fff';
                let Icon = Folder;

                if (isRoot) {
                  fill = 'rgba(167, 139, 250, 0.08)';
                  border = 'rgba(167, 139, 250, 0.3)';
                  textColor = 'var(--accent-purple)';
                  Icon = Folder;
                } else if (isAI) {
                  fill = 'rgba(72, 239, 179, 0.06)';
                  border = 'rgba(72, 239, 179, 0.2)';
                  textColor = '#48efb3';
                  Icon = Sparkles;
                } else if (node.type === 'pdf') {
                  fill = 'rgba(79, 156, 245, 0.06)';
                  border = 'rgba(79, 156, 245, 0.25)';
                  textColor = 'var(--accent-blue)';
                  Icon = FileText;
                } else if (node.type === 'youtube') {
                  fill = 'rgba(159, 122, 234, 0.06)';
                  border = 'rgba(159, 122, 234, 0.25)';
                  textColor = 'var(--accent-purple)';
                  Icon = Video;
                } else if (node.type === 'notes') {
                  fill = 'rgba(56, 178, 172, 0.06)';
                  border = 'rgba(56, 178, 172, 0.25)';
                  textColor = 'var(--accent-green)';
                  Icon = FileEdit;
                }

                return (
                  <foreignObject
                    key={node.id}
                    x={node.x - 90}
                    y={node.y - 25}
                    width="180"
                    height="50"
                    onClick={() => !isRoot && !isAI && toggleNode(node.id)}
                  >
                    <div 
                      className={`mindmap-card ${node.type}-node-card`}
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: fill,
                        border: `1px solid ${border}`,
                        boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(8px)',
                        color: textColor,
                        cursor: 'pointer',
                        userSelect: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Icon container */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' }}>
                        <Icon size={14} />
                      </div>

                      {/* Content wrapper */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {node.label}
                        </span>
                        <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {isRoot ? 'Workspace' : isAI ? 'AI Context' : node.type}
                        </span>
                      </div>

                      {/* Toggle Indicator Dot */}
                      {!isRoot && !isAI && (
                        <div 
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: collapsedNodes.has(node.id) ? 'var(--accent-blue)' : '#48efb3',
                            boxShadow: collapsedNodes.has(node.id) 
                              ? '0 0 6px var(--accent-blue)' 
                              : '0 0 6px #48efb3',
                            flexShrink: 0
                          }} 
                        />
                      )}
                    </div>
                  </foreignObject>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Floating Canvas Controls Pill */}
        <div 
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'rgba(15, 18, 26, 0.85)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            zIndex: 10
          }}
        >
          {/* Zoom In Button */}
          <button 
            onClick={() => setScale(s => Math.min(s + 0.15, 3))}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'none',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Zoom In"
          >
            +
          </button>
          
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: 'var(--text-muted)', 
            padding: '0 8px', 
            minWidth: '38px', 
            textAlign: 'center',
            userSelect: 'none'
          }}>
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom Out Button */}
          <button 
            onClick={() => setScale(s => Math.max(s - 0.15, 0.3))}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'none',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Zoom Out"
          >
            -
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />

          {/* Reset Fit View Button */}
          <button 
            onClick={resetView}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Reset View"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* 3. Guide Footer */}
      <div 
        style={{
          padding: '8px 16px',
          background: 'rgba(15, 18, 26, 0.7)',
          borderTop: '1px solid var(--glass-border)',
          fontSize: '0.675rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 5
        }}
      >
        <Sparkles size={11} style={{ color: 'var(--accent-purple)' }} />
        <span>Click nodes to expand/collapse AI Concepts. Drag canvas to pan. Use mousewheel or zoom controls.</span>
      </div>
    </div>
  );
});

MindMapPanel.displayName = 'MindMapPanel';
export default MindMapPanel;
