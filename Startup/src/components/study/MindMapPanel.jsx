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
  FileText,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { 
  getWorkshopIntelligence,
  initializeWorkshopIntelligence,
  extractWorkshopKnowledge,
  extractWorkshopRelationships,
  getWorkshopGraph,
  getWorkshopInsights
} from '../../services/api';
import '@xyflow/react/dist/style.css';

// COLOR ASSIGNMENTS PER NODE IMPORTANCE
const IMPORTANCE_THEMES = {
  HIGH: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)' },
  MEDIUM: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)' },
  LOW: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)' }
};

const CustomConceptNode = React.memo(({ data, selected }) => {
  const isHigh = data.importance >= 0.8;
  const isMed = data.importance >= 0.5 && data.importance < 0.8;
  const theme = isHigh ? IMPORTANCE_THEMES.HIGH : (isMed ? IMPORTANCE_THEMES.MEDIUM : IMPORTANCE_THEMES.LOW);
  
  const isHighlighted = data.isHighlighted;
  const highlightColor = '#a855f7'; // Purple glow for active elements
  const activeColor = isHighlighted ? highlightColor : theme.color;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: '#0a0d14',
        border: `1.5px solid ${selected ? '#ffffff' : activeColor}`,
        boxShadow: selected 
          ? `0 0 20px 0 rgba(255, 255, 255, 0.15), inset 0 0 12px 0 ${theme.border}` 
          : (isHighlighted 
            ? `0 0 15px 0 ${highlightColor}, inset 0 0 10px 0 rgba(168, 85, 247, 0.2)` 
            : `0 4px 12px 0 rgba(0, 0, 0, 0.45)`),
        color: '#ffffff',
        width: '180px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: activeColor, border: 'none', width: '6px', height: '6px' }} />
      
      {/* Indicator bar */}
      <div 
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: '4px',
          backgroundColor: activeColor,
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px'
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '8px', 
            fontWeight: 700, 
            color: activeColor, 
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Concept
          </span>
          <span style={{ 
            fontSize: '7.5px', 
            color: 'rgba(255, 255, 255, 0.45)', 
            fontWeight: 600 
          }}>
            Imp: {data.importance.toFixed(1)}
          </span>
        </div>
        <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 650, color: '#fff', lineHeight: 1.3 }}>
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
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: activeColor, border: 'none', width: '6px', height: '6px' }} />
    </div>
  );
});

CustomConceptNode.displayName = 'CustomConceptNode';

// Dagre Layout Algorithm for layouting
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 70 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - 90,
        y: nodeWithPosition.y - 35
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Canvas wrapper
const MindMapCanvas = ({ 
  nodes: initialNodes, 
  edges: initialEdges, 
  selectedNodeId,
  setSelectedNodeId, 
  searchQuery,
  relationshipFilter,
  highlightedNodeIds
}) => {
  const { setCenter, fitView } = useReactFlow();
  
  const nodeTypes = useMemo(() => ({
    customNode: CustomConceptNode
  }), []);

  // Compute filtering visible nodes and edges
  const elements = useMemo(() => {
    // Map database nodes to React Flow Node objects
    const rfNodes = initialNodes.map(node => ({
      id: node.id,
      type: 'customNode',
      data: {
        label: node.data.name,
        description: node.data.description,
        importance: node.data.importance,
        sources: node.data.sources || [],
        isHighlighted: highlightedNodeIds.has(node.id) || selectedNodeId === node.id
      },
      position: { x: 0, y: 0 } // Positions calculated dynamically by dagre
    }));

    // Filter edges based on relationshipType
    const filteredEdges = relationshipFilter === 'ALL'
      ? initialEdges
      : initialEdges.filter(e => e.type === relationshipFilter);

    // Map edges to React Flow Edge objects
    const rfEdges = filteredEdges.map(edge => {
      const isPathEdge = highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.type.replace('_', ' '),
        type: 'smoothstep',
        animated: isPathEdge,
        style: { 
          stroke: isPathEdge ? '#a855f7' : '#475569', 
          strokeWidth: isPathEdge ? 3 : 1.5 
        },
        labelStyle: { fill: '#94a3b8', fontSize: '9px', fontWeight: 500 }
      };
    });

    // Layout using dagre
    return getLayoutedElements(rfNodes, rfEdges);
  }, [initialNodes, initialEdges, relationshipFilter, highlightedNodeIds, selectedNodeId]);

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
      setCenter(match.position.x + 90, match.position.y + 35, { zoom: 1.4, duration: 800 });
      setSelectedNodeId(match.id);
    }
  }, [searchQuery, elements.nodes, setCenter, setSelectedNodeId]);

  // Center on selectedNodeId if set externally
  useEffect(() => {
    if (!selectedNodeId) return;
    const match = elements.nodes.find(n => n.id === selectedNodeId);
    if (match) {
      setCenter(match.position.x + 90, match.position.y + 35, { zoom: 1.4, duration: 800 });
    }
  }, [selectedNodeId, elements.nodes, setCenter]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const handleFitView = () => {
    fitView({ padding: 0.15, duration: 800 });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
        minZoom={0.2}
        maxZoom={2.5}
        style={{ background: '#09090b' }}
      >
        <Background color="#27272a" variant="dots" gap={12} size={1} />
        <MiniMap 
          nodeColor={(n) => {
            const isHigh = n.data?.importance >= 0.8;
            const isMed = n.data?.importance >= 0.5 && n.data?.importance < 0.8;
            return isHigh ? '#ec4899' : (isMed ? '#3b82f6' : '#10b981');
          }} 
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
      </div>
    </div>
  );
};

export const MindMapPanel = React.memo(({ session, onNavigateToSource }) => {
  const workshopId = session?._id;
  const workspaceTitle = session?.title || 'Study Workspace';
  const resources = useMemo(() => session?.resources || [], [session?.resources]);

  // UI state variables
  const [statusState, setStatusState] = useState('loading'); // loading | onboarding | generating | completed | failed | empty
  const [rawStatus, setRawStatus] = useState(null);
  const [activeStepText, setActiveStepText] = useState('');
  const [graphData, setGraphData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('ALL');
  const [highlightedNodeIds, setHighlightedNodeIds] = useState(new Set());
  const [activeSidebarTab, setActiveSidebarTab] = useState('insights'); // insights | details
  const [error, setError] = useState(null);

  const pollingTimeoutRef = useRef(null);
  const isPollingInFlightRef = useRef(false);
  const pollIdRef = useRef(0);
  const currentWorkshopIdRef = useRef('');
  const isGeneratingRef = useRef(false);

  const mapErrorText = (errorText, apiErrorCode) => {
    const code = apiErrorCode || '';
    const text = (errorText || '').trim();
    const lowerText = text.toLowerCase();

    if (code === 'OLLAMA_UNAVAILABLE' || lowerText.includes('ollama_unavailable')) {
      return 'Local AI service is unavailable. Start Ollama and try again.';
    }
    if (code === 'OLLAMA_MODEL_NOT_FOUND' || lowerText.includes('ollama_model_not_found')) {
      return 'Required local AI model qwen3:4b is not installed.';
    }
    if (code === 'RATE_LIMIT' || code === 'AI_RATE_LIMITED' || lowerText.includes('rate_limit') || lowerText.includes('rate limit') || lowerText.includes('429')) {
      return 'AI providers are currently unavailable. Please retry shortly.';
    }
    if (code === 'QUOTA_EXCEEDED' || code === 'AI_QUOTA_EXCEEDED' || lowerText.includes('quota') || lowerText.includes('credit') || lowerText.includes('quota_exceeded')) {
      return 'AI provider quota has been exceeded. Please retry later.';
    }
    if (code === 'AUTH_ERROR' || code === 'AI_AUTH_ERROR' || lowerText.includes('auth') || lowerText.includes('api key') || lowerText.includes('unauthorized')) {
      return 'AI providers are currently unavailable. Please retry shortly.';
    }
    if (code === 'MODEL_NOT_FOUND' || lowerText.includes('model_not_found') || lowerText.includes('model not found')) {
      return 'Required AI model is unavailable or misconfigured.';
    }
    if (code === 'PARTIAL_EXTRACTION' || lowerText.includes('partial_extraction') || lowerText.includes('partial success')) {
      return 'Extraction partially succeeded. Some concepts were generated successfully.';
    }

    // Check for ALL_PROVIDERS_FAILED (Fallback chain failed)
    if (code === 'ALL_PROVIDERS_FAILED' || lowerText.includes('fallback chain failed') || lowerText.includes('all providers failed')) {
      const lines = text.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('fallback chain failed'));
      const formattedDetails = lines.map(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const provider = parts[0].trim();
          const detail = parts.slice(1).join(':').trim();
          return `${provider}:\n${detail}`;
        }
        return line.trim();
      });
      return `AI provider error. Fallback chain failed:\n\n${formattedDetails.join('\n\n')}`;
    }

    // Default legacy mappings
    if (lowerText.includes('unexpected non-whitespace character') || lowerText.includes('json') || lowerText.includes('syntaxerror') || lowerText.includes('invalid structured response') || lowerText.includes('structure')) {
      return 'The AI returned an invalid structured response. Please retry extraction.';
    }
    if (lowerText.includes('database') || lowerText.includes('mongodb') || lowerText.includes('connection timed out') || lowerText.includes('503')) {
      return 'Database temporarily unavailable.';
    }

    return text || 'An error occurred during extraction. Please try again.';
  };

  const isTerminalStatus = useCallback((status) => {
    return status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED';
  }, []);

  const clearTimers = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    isPollingInFlightRef.current = false;
  }, []);

  const fetchGraphAndInsights = async (wId) => {
    setStatusState('loading');
    setError(null);
    try {
      const [graph, insights] = await Promise.all([
        getWorkshopGraph(wId),
        getWorkshopInsights(wId)
      ]);

      if (graph && graph.nodes && graph.nodes.length > 0) {
        setGraphData(graph);
        setInsightsData(insights);
        setStatusState('completed');
      } else {
        setStatusState('empty');
      }
    } catch (err) {
      console.error('[Workshop Fetch Graph/Insights] Failed:', err);
      setStatusState('failed');
      setError('Failed to load workshop intelligence graph.');
    }
  };

  // Poll status during background generation
  const startPollingStatus = useCallback((wId) => {
    clearTimers();
    setStatusState('generating');
    
    pollIdRef.current += 1;
    const currentPollId = pollIdRef.current;
    console.log(`[Intelligence UI] generation started pollId=${currentPollId}`);

    const poll = async () => {
      if (currentWorkshopIdRef.current !== wId || currentPollId !== pollIdRef.current) {
        return;
      }
      if (isPollingInFlightRef.current) {
        // Retry later if a status call is already pending
        console.log(`[Intelligence UI] scheduling next poll pollId=${currentPollId}`);
        pollingTimeoutRef.current = setTimeout(poll, 2500);
        return;
      }

      let isTerminal = false;

      try {
        isPollingInFlightRef.current = true;
        const res = await getWorkshopIntelligence(wId);
        const intel = res;
        
        if (intel) {
          setRawStatus(intel.status);
          console.log(`[Intelligence UI] status received=${intel.status} pollId=${currentPollId}`);
        }

        // Calculate processed resource count dynamically (succeeded and failed)
        const processed = intel?.resources?.filter(r => r.status && r.status !== 'PENDING').length || 0;
        const total = intel?.resourceCount || 0;

        if (intel) {
          if (isTerminalStatus(intel.status)) {
            isTerminal = true;
            console.log(`[Intelligence UI] terminal state=${intel.status} stopping pollId=${currentPollId}`);
            
            clearTimers();
            pollIdRef.current += 1; // Authoritative cancellation token
            isPollingInFlightRef.current = false;

            if (intel.status === 'COMPLETED' || intel.status === 'PARTIAL') {
              await fetchGraphAndInsights(wId);
            } else {
              setStatusState('failed');
              setError(mapErrorText(intel.error, null));
            }
            console.log(`[Intelligence UI] polling stopped pollId=${currentPollId}`);
            return;
          } else {
            // Update active step text based on backend extraction stage
            if (intel.status === 'READY') {
              setActiveStepText('Initializing workshop context...');
            } else if (intel.status === 'PROCESSING') {
              setActiveStepText(`Extracting core concepts... (Processed ${processed}/${total} resources)`);
            } else if (intel.status === 'EXTRACTING_RELATIONSHIPS') {
              setActiveStepText('Extracting concept relationships...');
            } else {
              setActiveStepText('Analyzing workspace concepts...');
            }
          }
        }
      } catch (err) {
        console.error('[Workshop Status Polling] Error:', err);
      } finally {
        isPollingInFlightRef.current = false;
        // Schedule next poll check ONLY if we did not transition to terminal/reset state
        if (!isTerminal && currentWorkshopIdRef.current === wId && currentPollId === pollIdRef.current) {
          console.log(`[Intelligence UI] scheduling next poll pollId=${currentPollId}`);
          pollingTimeoutRef.current = setTimeout(poll, 2500);
        }
      }
    };

    pollingTimeoutRef.current = setTimeout(poll, 2500);
  }, [clearTimers, isTerminalStatus]);

  const checkWorkspaceStatus = useCallback(async (wId) => {
    if (!wId) return;
    clearTimers();
    currentWorkshopIdRef.current = wId;
    setStatusState('loading');
    setError(null);

    // If workspace contains no indexable resources, mark empty instantly
    const hasValidContent = resources.some(r => r.type === 'pdf' || r.type === 'youtube' || r.type === 'notes');
    if (!hasValidContent) {
      setStatusState('empty');
      return;
    }

    try {
      const intel = await getWorkshopIntelligence(wId);
      if (intel) {
        setRawStatus(intel.status);
      }
      if (!intel || intel.status === 'NOT_STARTED') {
        setStatusState('onboarding');
      } else if (intel.status === 'COMPLETED' || intel.status === 'PARTIAL') {
        await fetchGraphAndInsights(wId);
      } else if (intel.status === 'FAILED') {
        setStatusState('failed');
        setError(mapErrorText(intel.error, null));
      } else {
        startPollingStatus(wId);
      }
    } catch (err) {
      // If 404 is returned, backend indicates it hasn't started yet
      if (err.statusCode === 404) {
        setStatusState('onboarding');
      } else {
        console.error('[Workshop Initial Check] Failed:', err);
        setStatusState('failed');
        setError(mapErrorText(err.message, err.code));
      }
    }
  }, [resources, startPollingStatus, clearTimers]);

  const handleGenerateIntelligence = useCallback(async () => {
    if (!workshopId || isGeneratingRef.current || statusState === 'generating') {
      console.log('[Intelligence UI] retry click ignored');
      return;
    }
    
    isGeneratingRef.current = true;
    console.log('[Intelligence UI] retry click accepted');
    console.log('[Intelligence UI] generation request started');

    setStatusState('generating');
    setActiveStepText('Initializing workshop context...');
    setError(null);

    try {
      console.log('[Intelligence UI] POST generation triggered');
      // Step 1: Initialize
      const initIntel = await initializeWorkshopIntelligence(workshopId);
      if (initIntel) {
        setRawStatus(initIntel.status);
      }
      
      // Step 2: Extract Concepts
      setActiveStepText('Analyzing files & extracting concepts...');
      const extractIntel = await extractWorkshopKnowledge(workshopId);
      if (extractIntel) {
        setRawStatus(extractIntel.status);
      }

      // Step 3: Extract Relationships
      setActiveStepText('Connecting concepts and relationships...');
      const relIntel = await extractWorkshopRelationships(workshopId);
      if (relIntel) {
        setRawStatus(relIntel.status);
      }

      console.log(`[Intelligence UI] generation request completed status=${relIntel?.status || 'unknown'}`);
      // Step 4: Status check & Polling
      startPollingStatus(workshopId);
    } catch (err) {
      console.log('[Intelligence UI] generation request completed status=failed');
      console.error('[Workshop Generate Sequence] Failed:', err);
      setStatusState('failed');
      setError(mapErrorText(err.message, err.code));
    } finally {
      isGeneratingRef.current = false;
    }
  }, [workshopId, startPollingStatus, statusState]);

  // Load when workshop changes
  useEffect(() => {
    if (workshopId) {
      checkWorkspaceStatus(workshopId);
    }
    return () => clearTimers();
  }, [workshopId]);

  // Auto-switch to details tab when selectedNodeId changes
  useEffect(() => {
    if (selectedNodeId) {
      setActiveSidebarTab('details');
    }
  }, [selectedNodeId]);

  // Retrieve active selected node details
  const selectedConcept = useMemo(() => {
    if (!selectedNodeId || !graphData?.nodes) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId);
  }, [selectedNodeId, graphData?.nodes]);

  // Highlighting prerequisite path helper
  const handleSelectPath = useCallback((path) => {
    const ids = new Set(path.concepts.map(c => c.id));
    setHighlightedNodeIds(ids);
  }, []);

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
            🎓 Workshop Intelligence Map
          </span>
          <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            ({workspaceTitle})
          </span>
        </div>

        {/* Node search input */}
        {statusState === 'completed' && graphData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* If the state is PARTIAL, display a warning indicator and a retry button */}
            {rawStatus === 'PARTIAL' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    color: '#fb923c', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    backgroundColor: 'rgba(251, 146, 60, 0.1)',
                    border: '1px solid rgba(251, 146, 60, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}
                  title="Some files failed to extract concepts."
                >
                  <AlertTriangle size={12} />
                  Partial Map
                </span>
                <button
                  onClick={handleGenerateIntelligence}
                  disabled={statusState === 'generating'}
                  style={{
                    backgroundColor: 'rgba(251, 146, 60, 0.15)',
                    border: '1px solid rgba(251, 146, 60, 0.4)',
                    color: '#fdba74',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={11} />
                  <span>Retry Failed Files</span>
                </button>
              </div>
            )}

            {/* Relationship Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '16px' }}>
              <SlidersHorizontal size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <select
                value={relationshipFilter}
                onChange={(e) => setRelationshipFilter(e.target.value)}
                style={{
                  background: '#0c0f17',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '10.5px',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Relationships</option>
                <option value="PREREQUISITE_OF">Prerequisites</option>
                <option value="RELATED_TO">Related To</option>
                <option value="PART_OF">Part Of</option>
                <option value="EXPLAINS">Explains</option>
                <option value="LEADS_TO">Leads To</option>
                <option value="CONTRASTS_WITH">Contrasts With</option>
              </select>
            </div>

            {/* Search */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '6px 12px',
                width: '200px'
              }}
            >
              <Search size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="text"
                placeholder="Search concepts..."
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
          </div>
        )}
      </div>

      {/* 2. Main Viewport Panel */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* Loading Shell Overlay */}
        {statusState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', zIndex: 10 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#a855f7' }} />
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>Loading workshop graph data...</span>
          </div>
        )}

        {/* Generating state Loader */}
        {statusState === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', zIndex: 10 }}>
            <Loader2 size={36} className="animate-spin" style={{ color: '#c084fc', marginBottom: '14px' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>Generating Workshop Intelligence Map...</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '6px', textAlign: 'center' }}>
              {activeStepText}
            </div>
          </div>
        )}

        {/* Failed state Shell */}
        {statusState === 'failed' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', padding: '24px', boxSizing: 'border-box', zIndex: 10 }}>
            <AlertTriangle size={36} style={{ color: '#ef4444', marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>Extraction Failed</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', maxWidth: '480px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {error || 'An error occurred while building workshop intelligence.'}
            </p>
            <button
              onClick={handleGenerateIntelligence}
              disabled={statusState === 'generating'}
              style={{
                backgroundColor: statusState === 'generating' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: statusState === 'generating' ? 'rgba(255,255,255,0.3)' : '#f87171',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: statusState === 'generating' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} />
              <span>Retry Map Generation</span>
            </button>
          </div>
        )}

        {/* Onboarding page (Not Generated) */}
        {statusState === 'onboarding' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', padding: '24px', boxSizing: 'border-box', zIndex: 10 }}>
            <Sparkles size={36} style={{ color: '#a855f7', marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>Workshop Intelligence Not Generated</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', maxWidth: '340px', lineHeight: 1.5 }}>
              Analyze all files in this workshop to extract concepts, prerequisites, and build an interactive learning path map automatically.
            </p>
            <button
              onClick={handleGenerateIntelligence}
              disabled={statusState === 'generating'}
              style={{
                backgroundColor: statusState === 'generating' ? 'rgba(255,255,255,0.05)' : '#a855f7',
                color: statusState === 'generating' ? 'rgba(255,255,255,0.3)' : '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: statusState === 'generating' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={13} />
              <span>Generate Learning Map</span>
            </button>
          </div>
        )}

        {/* Empty state (No indexable resources) */}
        {statusState === 'empty' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#09090b', padding: '24px', boxSizing: 'border-box' }}>
            <Sparkles size={36} style={{ color: '#a855f7', marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>No learning resources yet</h3>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
              Add lecture PDFs, video links, or study notes. Once you add files, you can build a workshop intelligence map here.
            </p>
          </div>
        )}

        {/* Completed graph view */}
        {statusState === 'completed' && graphData && (
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
            
            {/* ReactFlow graph viewport */}
            <div style={{ flex: 1, height: '100%', position: 'relative' }}>
              <ReactFlowProvider>
                <MindMapCanvas 
                  nodes={graphData.nodes} 
                  edges={graphData.edges}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  searchQuery={searchQuery}
                  relationshipFilter={relationshipFilter}
                  highlightedNodeIds={highlightedNodeIds}
                />
              </ReactFlowProvider>
            </div>

            {/* Collapsible tabbed sidebar */}
            <div 
              style={{
                width: '380px',
                backgroundColor: '#0c0f17',
                borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 8,
                boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
                overflow: 'hidden'
              }}
            >
              {/* Tab selectors */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(14, 17, 24, 0.95)' }}>
                <button
                  onClick={() => {
                    setActiveSidebarTab('insights');
                    setHighlightedNodeIds(new Set());
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeSidebarTab === 'insights' ? '2px solid #a855f7' : 'none',
                    color: activeSidebarTab === 'insights' ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Insights Summary
                </button>
                <button
                  onClick={() => setActiveSidebarTab('details')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeSidebarTab === 'details' ? '2px solid #a855f7' : 'none',
                    color: activeSidebarTab === 'details' ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Concept Details
                </button>
              </div>

              {/* Tab Contents */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
                {activeSidebarTab === 'insights' && insightsData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Summary statistics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Summary</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#a855f7' }}>{insightsData.summary.conceptCount}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Concepts</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>{insightsData.summary.relationshipCount}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Relationships</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>{insightsData.summary.connectedConceptCount}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Connected</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{insightsData.summary.isolatedConceptCount}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Isolated</div>
                        </div>
                      </div>
                    </div>

                    {/* Cycle warnings */}
                    {insightsData.cycles && insightsData.cycles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>⚠️ Cycle Warning Detected</span>
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '10.5px', color: '#fca5a5', lineHeight: 1.4 }}>
                            A cyclic dependency exists in your prerequisites graph structure. Review loops:
                          </span>
                          {insightsData.cycles.map((cyc, cIdx) => (
                            <div key={cIdx} style={{ fontSize: '9.5px', color: '#f87171', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              {cyc.conceptIds.map(cid => graphData.nodes.find(n => n.id === cid)?.data?.name || cid).join(' → ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Important concepts list */}
                    {insightsData.importantConcepts && insightsData.importantConcepts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Important Concepts</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {insightsData.importantConcepts.slice(0, 5).map((c) => (
                            <div 
                              key={c.id} 
                              onClick={() => setSelectedNodeId(c.id)}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: selectedNodeId === c.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', 
                                border: selectedNodeId === c.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.04)',
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 550 }}>{c.name}</span>
                              <span style={{ fontSize: '9.5px', color: '#ec4899', fontWeight: 700 }}>Imp: {c.importance.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Foundational concepts list */}
                    {insightsData.foundationalConcepts && insightsData.foundationalConcepts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Foundational Concepts (Prerequisites)</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {insightsData.foundationalConcepts.slice(0, 5).map((c) => (
                            <div 
                              key={c.id} 
                              onClick={() => setSelectedNodeId(c.id)}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: selectedNodeId === c.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', 
                                border: selectedNodeId === c.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.04)',
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 550 }}>{c.name}</span>
                              <span style={{ fontSize: '9.5px', color: '#3b82f6', fontWeight: 600 }}>
                                Dependents: {c.dependentConceptCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hub concepts list */}
                    {insightsData.hubConcepts && insightsData.hubConcepts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Hub Concepts (Highly Connected)</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {insightsData.hubConcepts.slice(0, 5).map((c) => (
                            <div 
                              key={c.id} 
                              onClick={() => setSelectedNodeId(c.id)}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: selectedNodeId === c.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', 
                                border: selectedNodeId === c.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.04)',
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 550 }}>{c.name}</span>
                              <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: 600 }}>Degree: {c.degree}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Isolated concepts */}
                    {insightsData.isolatedConcepts && insightsData.isolatedConcepts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Isolated Concepts</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {insightsData.isolatedConcepts.slice(0, 5).map((c) => (
                            <div 
                              key={c.id} 
                              onClick={() => setSelectedNodeId(c.id)}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: selectedNodeId === c.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', 
                                border: selectedNodeId === c.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.04)',
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 550 }}>{c.name}</span>
                              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)' }}>Disconnected</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prerequisite paths */}
                    {insightsData.prerequisitePaths && insightsData.prerequisitePaths.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Prerequisite Paths (Learning Sequence)</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {insightsData.prerequisitePaths.map((path, pIdx) => (
                            <div 
                              key={pIdx} 
                              onClick={() => handleSelectPath(path)}
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '5px', 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid rgba(255,255,255,0.04)', 
                                padding: '10px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer'
                              }}
                              title="Click to highlight learning path on graph"
                            >
                              <span style={{ fontSize: '9.5px', color: '#a855f7', fontStyle: 'normal', fontWeight: 700 }}>Path {pIdx + 1}</span>
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
                                {path.concepts.map(c => c.name).join(' → ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Relationship confidence stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Relationship Confidence</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>High Confidence (≥ 0.80):</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>{insightsData.relationshipQuality.highConfidence}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Medium Confidence (0.50 - 0.79):</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>{insightsData.relationshipQuality.mediumConfidence}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Low Confidence (&lt; 0.50):</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>{insightsData.relationshipQuality.lowConfidence}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {activeSidebarTab === 'details' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedConcept ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <span style={{ 
                            fontSize: '8.5px', 
                            fontWeight: 800, 
                            color: selectedConcept.data.importance >= 0.8 ? '#ec4899' : (selectedConcept.data.importance >= 0.5 ? '#3b82f6' : '#10b981'), 
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            textTransform: 'uppercase'
                          }}>
                            Concept ID: {selectedConcept.id.slice(-6)}
                          </span>
                          <h3 style={{ margin: '8px 0 4px 0', fontSize: '14.5px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                            {selectedConcept.data.name}
                          </h3>
                        </div>

                        {selectedConcept.data.description && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Description</span>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                              {selectedConcept.data.description}
                            </p>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Concept Importance:</span>
                          <span style={{ fontWeight: 700, color: '#ec4899' }}>{selectedConcept.data.importance.toFixed(2)}</span>
                        </div>

                        {/* Citations List */}
                        {selectedConcept.data.sources && selectedConcept.data.sources.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Citations & Sources</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {selectedConcept.data.sources.map((src, index) => {
                                // Find matched resource
                                const matchedRes = resources.find(r => 
                                  r._id?.toString() === src.resourceId?.toString() || 
                                  r.url === src.resourceId || 
                                  r.title?.toLowerCase() === src.resourceId?.toLowerCase() ||
                                  (src.resourceName && r.title?.toLowerCase() === src.resourceName?.toLowerCase())
                                );

                                return (
                                  <div 
                                    key={index} 
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '6px', 
                                      background: 'rgba(255,255,255,0.02)', 
                                      padding: '8px 12px', 
                                      borderRadius: '6px', 
                                      border: '1px solid rgba(255,255,255,0.04)' 
                                    }}
                                  >
                                    <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 550, wordBreak: 'break-all' }}>
                                      {matchedRes?.title || src.resourceName || 'Resource document'}
                                    </span>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '9.5px', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {matchedRes?.type === 'youtube' ? <Play size={10} /> : <FileText size={10} />}
                                        {src.pageStart ? `Page ${src.pageStart}` : src.timestampStart ? `Time: ${src.timestampStart}s` : 'Reference'}
                                      </span>

                                      {matchedRes && onNavigateToSource && (
                                        <button
                                          onClick={() => onNavigateToSource(matchedRes, src.pageStart, src.timestampStart)}
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
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: 'rgba(255,255,255,0.4)', gap: '8px' }}>
                        <Info size={24} />
                        <span style={{ fontSize: '11px' }}>Select a concept node to view details.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
      
      {/* Footer Info */}
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
        <span>Double-click nodes or list nodes to focus, select filters to isolate relationships.</span>
      </div>
    </div>
  );
});

MindMapPanel.displayName = 'MindMapPanel';
export default MindMapPanel;
