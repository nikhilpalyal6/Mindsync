import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  useReactFlow, 
  ReactFlowProvider,
  Handle,
  Position
} from '@xyflow/react';
import dagre from 'dagre';
import { 
  Sparkles,
  Search,
  Info,
  Loader2,
  AlertTriangle,
  Play,
  FileText
} from 'lucide-react';
import { getMindMapByWorkspace } from '../../services/api';
import '@xyflow/react/dist/style.css';

// COLOR ASSIGNMENTS PER NODE TYPE
const COLOR_THEMES = {
  ROOT: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.3)' },
  RESOURCE: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.3)' },
  TOPIC: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)' },
  SUBTOPIC: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.3)' },
  CONCEPT: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)' },
  FORMULA: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.3)' },
  PROCESS: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.3)' },
  DEFINITION: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)' },
  EXAMPLE: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.3)' },
  IMPORTANT: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)' }
};

// Custom React Flow Node Component
const CustomMindMapNode = React.memo(({ data, selected }) => {
  const theme = COLOR_THEMES[data.type] || COLOR_THEMES.CONCEPT;
  
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: '#0a0d14',
        border: `1.5px solid ${selected ? '#ffffff' : theme.color}`,
        boxShadow: selected 
          ? `0 0 20px 0 rgba(255, 255, 255, 0.15), inset 0 0 12px 0 ${theme.border}` 
          : `0 4px 12px 0 rgba(0, 0, 0, 0.45)`,
        color: '#ffffff',
        width: data.type === 'ROOT' ? '220px' : (['TOPIC', 'RESOURCE'].includes(data.type) ? '190px' : '170px'),
        boxSizing: 'border-box',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: theme.color, border: 'none', width: '6px', height: '6px' }} />
      
      {/* Node Header Indicator bar */}
      <div 
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: '4px',
          backgroundColor: theme.color,
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px'
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '8px', 
            fontWeight: 700, 
            color: theme.color, 
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            {data.type}
          </span>
          {data.importance === 'HIGH' && (
            <span style={{ 
              fontSize: '7px', 
              color: '#ef4444', 
              fontWeight: 800, 
              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
              padding: '1px 4px', 
              borderRadius: '3px' 
            }}>
              ★ HIGH
            </span>
          )}
        </div>
        <h4 style={{ margin: 0, fontSize: '11.5px', fontWeight: 650, color: '#fff', lineHeight: 1.3 }}>
          {data.label}
        </h4>
        
        {data.description && (
          <p style={{ 
            margin: '4px 0 0 0', 
            fontSize: '9px', 
            color: 'rgba(255, 255, 255, 0.5)', 
            lineHeight: 1.25, 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
          }}>
            {data.description}
          </p>
        )}

        {/* Expand/Collapse badge indicator */}
        {data.hasChildren && (
          <div style={{ 
            position: 'absolute', 
            bottom: '-7px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            fontSize: '7.5px', 
            backgroundColor: '#1f2937', 
            border: `1px solid ${theme.color}`, 
            color: '#fff', 
            padding: '1px 5px', 
            borderRadius: '10px',
            fontWeight: 700
          }}>
            {data.collapsed ? '＋ Expand' : '－ Collapse'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: theme.color, border: 'none', width: '6px', height: '6px' }} />
    </div>
  );
});

CustomMindMapNode.displayName = 'CustomMindMapNode';

// Dagre Layout Generator
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 70, ranksep: 100 });

  nodes.forEach((node) => {
    let width = 170;
    let height = 65;
    if (node.data?.type === 'ROOT') {
      width = 220;
      height = 80;
    } else if (['TOPIC', 'RESOURCE'].includes(node.data?.type)) {
      width = 190;
      height = 75;
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - (node.data?.type === 'ROOT' ? 110 : (['TOPIC', 'RESOURCE'].includes(node.data?.type) ? 95 : 85)),
        y: nodeWithPosition.y - (node.data?.type === 'ROOT' ? 40 : (['TOPIC', 'RESOURCE'].includes(node.data?.type) ? 37 : 32))
      }
    };
  });

  return { nodes: layedNodes, edges };
};

// Canvas Sub-component using React Flow Hooks
const MindMapCanvas = ({ 
  nodes: initialNodes, 
  edges: initialEdges, 
  setSelectedNode, 
  searchQuery
}) => {
  const { setCenter, fitView } = useReactFlow();
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
  
  // Custom nodes map registration
  const nodeTypes = useMemo(() => ({
    customNode: CustomMindMapNode
  }), []);

  // Compute collapsing visible nodes and edges
  const elements = useMemo(() => {
    const adj = {};
    initialEdges.forEach(e => {
      adj[e.sourceNode] = adj[e.sourceNode] || [];
      adj[e.sourceNode].push(e.targetNode);
    });

    const hiddenIds = new Set();
    const traverseAndHide = (parentId) => {
      const children = adj[parentId] || [];
      children.forEach(childId => {
        hiddenIds.add(childId);
        traverseAndHide(childId);
      });
    };

    collapsedNodeIds.forEach(id => {
      traverseAndHide(id);
    });

    // Map database nodes to React Flow Node objects
    const rfNodes = initialNodes.map(node => ({
      id: node.nodeId,
      type: 'customNode',
      data: {
        label: node.label,
        type: node.type,
        description: node.description,
        importance: node.importance,
        color: node.color,
        sources: node.sources || [],
        collapsed: collapsedNodeIds.has(node.nodeId),
        hasChildren: initialEdges.some(e => e.sourceNode === node.nodeId)
      },
      position: node.position || { x: 0, y: 0 }
    }));

    // Map database edges to React Flow Edge objects
    const rfEdges = initialEdges.map(edge => ({
      id: `${edge.sourceNode}-${edge.targetNode}`,
      source: edge.sourceNode,
      target: edge.targetNode,
      label: edge.relationship || '',
      type: 'smoothstep',
      animated: true,
      style: { stroke: COLOR_THEMES[initialNodes.find(n => n.nodeId === edge.sourceNode)?.type]?.color || '#475569', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: '9px', fontWeight: 500 }
    }));

    const visibleNodes = rfNodes.filter(n => !hiddenIds.has(n.id));
    const visibleEdges = rfEdges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target));

    // Perform Dagre Layout
    return getLayoutedElements(visibleNodes, visibleEdges);
  }, [initialNodes, initialEdges, collapsedNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(elements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(elements.edges);

  useEffect(() => {
    setNodes(elements.nodes);
    setEdges(elements.edges);
  }, [elements, setNodes, setEdges]);

  // Center on node if search query matches a node label
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const match = elements.nodes.find(n => n.data.label.toLowerCase().includes(searchQuery.toLowerCase()));
    if (match) {
      setCenter(match.position.x + 85, match.position.y + 30, { zoom: 1.4, duration: 800 });
    }
  }, [searchQuery, elements.nodes, setCenter]);

  // Node Selection Handler
  const onNodeClick = useCallback((event, node) => {
    const rawNode = initialNodes.find(n => n.nodeId === node.id);
    setSelectedNode(rawNode || null);
  }, [initialNodes, setSelectedNode]);

  // Double Click Toggle Collapse
  const onNodeDoubleClick = useCallback((event, node) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }, []);

  const handleFitView = () => {
    fitView({ padding: 0.15, duration: 800 });
  };

  const handleExpandAll = () => {
    setCollapsedNodeIds(new Set());
  };

  const handleCollapseAll = () => {
    const topicNodeIds = initialNodes
      .filter(n => ['TOPIC', 'RESOURCE'].includes(n.type))
      .map(n => n.nodeId);
    setCollapsedNodeIds(new Set(topicNodeIds));
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
        minZoom={0.2}
        maxZoom={2.5}
        style={{ background: '#09090b' }}
      >
        <Background color="#27272a" variant="dots" gap={12} size={1} />
        <MiniMap 
          nodeColor={(n) => COLOR_THEMES[n.data?.type]?.color || '#3b82f6'} 
          maskColor="rgba(0, 0, 0, 0.6)" 
          style={{ backgroundColor: '#0c0f17', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}
        />
        <Controls showInteractive={false} style={{ display: 'flex', flexDirection: 'row', gap: '4px', left: 'auto', right: '20px', top: '20px', bottom: 'auto' }} />
      </ReactFlow>

      {/* Floating Toolbar Controls */}
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          right: '150px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '6px 12px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          zIndex: 10
        }}
      >
        <button 
          onClick={handleFitView} 
          style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '9px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          title="Fit Viewport"
        >
          FIT VIEW
        </button>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.08)' }} />
        <button 
          onClick={handleExpandAll} 
          style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '9px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          title="Expand all concepts"
        >
          EXPAND ALL
        </button>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.08)' }} />
        <button 
          onClick={handleCollapseAll} 
          style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '9px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          title="Collapse down to Topics"
        >
          COLLAPSE ALL
        </button>
      </div>
    </div>
  );
};

export const MindMapPanel = React.memo(({ session, onNavigateToSource }) => {
  const workspaceId = session?._id;
  const workspaceTitle = session?.title || 'Study Workspace';
  const resources = useMemo(() => session?.resources || [], [session?.resources]);
  
  // State Machine variables (pure read-only workspace scopes)
  const [statusState, setStatusState] = useState('loading'); // loading | generating | completed | failed | empty
  const [mindMapData, setMindMapData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  const pollingIntervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const currentWorkspaceIdRef = useRef('');

  // Clears active timers
  const clearTimers = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Start polling status (checking status updates, never triggering writes)
  const startPolling = useCallback((wId) => {
    clearTimers();
    setStatusState('generating');
    setError(null);

    // Timeout guard: 45 seconds total maximum generation time (Step 18)
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setStatusState('failed');
      setError('Your workspace learning map is temporarily unavailable. It will be prepared automatically.');
    }, 45000);

    pollingIntervalRef.current = setInterval(async () => {
      if (currentWorkspaceIdRef.current !== wId) return;

      try {
        const res = await getMindMapByWorkspace(wId);
        const mapDoc = res?.data?.mindMap;
        const status = res?.data?.status;

        if (status === 'COMPLETED' && mapDoc) {
          clearTimers();
          if (mapDoc.nodes && mapDoc.nodes.length > 0) {
            setMindMapData(mapDoc);
            setStatusState('completed');
          } else {
            setStatusState('empty');
          }
        } else if (status === 'FAILED') {
          clearTimers();
          setStatusState('failed');
          setError(mapDoc?.error || 'AI generation failed.');
        }
      } catch (err) {
        console.error('[MindMap Polling] Error checking status:', err);
      }
    }, 2500);
  }, []);

  // Check database first (cache-first Step 14 & 15)
  const checkExistingMindMap = useCallback(async (wId) => {
    if (!wId) return;
    clearTimers();
    currentWorkspaceIdRef.current = wId;

    setStatusState('loading');
    setError(null);
    setMindMapData(null);
    setSelectedNode(null);

    // If workspace contains no content, mark empty instantly (Step 27)
    const hasValidContent = resources.some(r => {
      const text = r.data?.extractedText || r.data?.transcript || r.data?.content || '';
      return text && text.trim().length > 0;
    });

    if (!hasValidContent) {
      setStatusState('empty');
      return;
    }

    try {
      const res = await getMindMapByWorkspace(wId);
      const mapDoc = res?.data?.mindMap;
      const status = res?.data?.status;

      if (status === 'COMPLETED' && mapDoc) {
        if (mapDoc.nodes && mapDoc.nodes.length > 0) {
          setMindMapData(mapDoc);
          setStatusState('completed');
        } else {
          setStatusState('empty');
        }
      } else if (status === 'GENERATING') {
        startPolling(wId);
      } else if (status === 'FAILED') {
        setStatusState('failed');
        setError(mapDoc?.error || 'Your workspace learning map is temporarily unavailable. It will be prepared automatically.');
      } else {
        // NOT_FOUND -> Poll background status
        startPolling(wId);
      }
    } catch (err) {
      console.error('[MindMap Check] Failed lookup:', err);
      setStatusState('failed');
      setError('Your workspace learning map is temporarily unavailable. It will be prepared automatically.');
    }
  }, [resources, startPolling]);

  // Load when workspace changes
  useEffect(() => {
    if (workspaceId) {
      checkExistingMindMap(workspaceId);
    }
    return () => clearTimers();
  }, [workspaceId, checkExistingMindMap]);

  const activeTheme = useMemo(() => {
    if (!selectedNode) return null;
    return COLOR_THEMES[selectedNode.type] || COLOR_THEMES.CONCEPT;
  }, [selectedNode]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', overflow: 'hidden', position: 'relative' }}>
      
      {/* 1. Header Toolbar */}
      <div 
        style={{ 
          height: '56px', 
          backgroundColor: '#0c0f17', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 5
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎓 AI Workspace Learning Map
          </span>
          <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            ({workspaceTitle})
          </span>
        </div>

        {/* Node search input */}
        {statusState === 'completed' && mindMapData && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '6px 12px',
              width: '220px'
            }}
          >
            <Search size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Search concepts & files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        )}
      </div>

      {/* 2. Viewport Canvas */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* Loading Shell Overlay */}
        {statusState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', zIndex: 10 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#a855f7' }} />
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>Checking stored maps cache...</span>
          </div>
        )}

        {/* Preparing Mind Map State Shell (Step 15) */}
        {statusState === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', zIndex: 10 }}>
            <Loader2 size={36} className="animate-spin" style={{ color: '#c084fc', marginBottom: '14px' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>Your workspace learning map is being prepared.</div>
            <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textAlign: 'center', maxWidth: '340px', lineHeight: 1.45 }}>
              MindSync is analyzing and connecting all resource documents in this workspace automatically.
            </div>
          </div>
        )}

        {/* Failed Generation State Shell */}
        {statusState === 'failed' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', padding: '24px', boxSizing: 'border-box', zIndex: 10 }}>
            <AlertTriangle size={36} style={{ color: '#ef4444', marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>Map Temporarily Unavailable</h3>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
              {error || 'Your workspace learning map is temporarily unavailable. It will be prepared automatically.'}
            </p>
          </div>
        )}

        {/* Empty State Shell (Step 27) */}
        {statusState === 'empty' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', padding: '24px', boxSizing: 'border-box' }}>
            <Sparkles size={36} style={{ color: '#a855f7', marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>No learning resources yet.</h3>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
              Add lecture PDFs, videos, or study notes. A consolidated workspace learning map will compile automatically in the background.
            </p>
          </div>
        )}

        {/* React Flow Graph rendering container */}
        {statusState === 'completed' && mindMapData && (
          <div style={{ flex: 1, height: '100%', position: 'relative' }}>
            <ReactFlowProvider>
              <MindMapCanvas 
                nodes={mindMapData.nodes} 
                edges={mindMapData.edges}
                setSelectedNode={setSelectedNode}
                searchQuery={searchQuery}
              />
            </ReactFlowProvider>
          </div>
        )}

        {/* 3. Node Detail Context Drawer (Step 7 & 24) */}
        {statusState === 'completed' && selectedNode && activeTheme && (
          <div 
            style={{
              width: '340px',
              backgroundColor: '#0c0f17',
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 8,
              boxShadow: '-8px 0 24px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={13} style={{ color: activeTheme.color }} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Concept Details
                </span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)} 
                style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
              
              <div>
                <span style={{ 
                  fontSize: '8.5px', 
                  fontWeight: 800, 
                  color: activeTheme.color, 
                  backgroundColor: activeTheme.bg,
                  border: `1px solid ${activeTheme.border}`,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  textTransform: 'uppercase'
                }}>
                  {selectedNode.type}
                </span>
                <h3 style={{ margin: '8px 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                  {selectedNode.label}
                </h3>
              </div>

              {selectedNode.description && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Description</span>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                    {selectedNode.description}
                  </p>
                </div>
              )}

              {/* Source References citations list */}
              {selectedNode.sources && selectedNode.sources.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Source References</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedNode.sources.map((src, index) => {
                      // Lookup matching resource in the workspace list
                      const matchedRes = resources.find(r => 
                        r._id?.toString() === src.resourceId?.toString() || 
                        r.url === src.resourceId || 
                        r.title?.toLowerCase() === src.resourceName?.toLowerCase()
                      );

                      return (
                        <div 
                          key={index} 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '5px', 
                            background: 'rgba(255,255,255,0.02)', 
                            padding: '8px 12px', 
                            borderRadius: '6px', 
                            border: '1px solid rgba(255,255,255,0.04)' 
                          }}
                        >
                          <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.75)', fontWeight: 550, wordBreak: 'break-all' }}>
                            {src.resourceName || 'Resource Document'}
                          </span>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '9.5px', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {matchedRes?.type === 'youtube' ? <Play size={10} /> : <FileText size={10} />}
                              {src.pageNumber ? `Page ${src.pageNumber}` : src.timestamp ? `Timestamp ${src.timestamp}` : src.sectionTitle || 'Content Section'}
                            </span>

                            {matchedRes && onNavigateToSource && (
                              <button
                                onClick={() => onNavigateToSource(matchedRes, src.pageNumber, src.timestamp)}
                                style={{
                                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  borderRadius: '4px',
                                  color: '#c084fc',
                                  fontSize: '8.5px',
                                  fontWeight: 700,
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                Jump to Source
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 3. Bottom Graph Footer */}
      <div 
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 4,
          pointerEvents: 'none'
        }}
      >
        <Sparkles size={10} style={{ color: '#c084fc' }} />
        <span>Double-click nodes to expand/collapse branches. Left-click selects a concept showing its cross-resource citations.</span>
      </div>
    </div>
  );
});

MindMapPanel.displayName = 'MindMapPanel';
export default MindMapPanel;
