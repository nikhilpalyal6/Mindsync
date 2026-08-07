import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { 
  Maximize2, 
  Minimize2, 
  Download, 
  GitFork, 
  Sparkles,
  FileText,
  Video,
  FileEdit,
  Folder,
  Search,
  RotateCcw,
  LayoutGrid,
  Info,
  ChevronRight,
  Map as MapIcon
} from 'lucide-react';

export const MindMapPanel = React.memo(({ session }) => {
  const containerRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const cssCanvasRef = useRef(null);
  const minimapCanvasRef = useRef(null);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  
  // Three.js References
  const sceneRef = useRef(null);
  const cssSceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cssRendererRef = useRef(null);
  const controlsRef = useRef(null);
  
  // Simulation & Graph References
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const linkLinesRef = useRef([]);
  const linkParticlesRef = useRef([]);
  const cssObjectsRef = useRef({});
  const animationFrameId = useRef(null);
  
  // Camera smooth-flight targeting
  const cameraTarget = useRef(null); // { x, y, z } position to fly to
  const controlsTarget = useRef(null); // { x, y, z } target to look at

  const resources = useMemo(() => session?.resources || [], [session?.resources]);

  // Define Category-based Theme colors
  const getCategoryTheme = (type) => {
    const themes = {
      root: {
        color: '#a78bfa',
        bg: 'rgba(26, 21, 44, 0.85)',
        border: 'rgba(167, 139, 250, 0.4)',
        shadow: 'rgba(167, 139, 250, 0.25)',
        icon: Folder
      },
      pdf: {
        color: '#60a5fa',
        bg: 'rgba(17, 24, 39, 0.85)',
        border: 'rgba(96, 165, 250, 0.35)',
        shadow: 'rgba(96, 165, 250, 0.2)',
        icon: FileText
      },
      youtube: {
        color: '#c084fc',
        bg: 'rgba(24, 18, 36, 0.85)',
        border: 'rgba(192, 132, 252, 0.35)',
        shadow: 'rgba(192, 132, 252, 0.2)',
        icon: Video
      },
      notes: {
        color: '#2dd4bf',
        bg: 'rgba(13, 27, 24, 0.85)',
        border: 'rgba(45, 212, 191, 0.35)',
        shadow: 'rgba(45, 212, 191, 0.2)',
        icon: FileEdit
      },
      'ai-node': {
        color: '#34d399',
        bg: 'rgba(12, 28, 22, 0.85)',
        border: 'rgba(52, 211, 153, 0.3)',
        shadow: 'rgba(52, 211, 153, 0.15)',
        icon: Sparkles
      }
    };
    return themes[type] || themes.pdf;
  };

  // Construct active dataset
  const graphData = useMemo(() => {
    const rootId = 'root';
    const nodes = [
      { 
        id: rootId, 
        label: session?.title || 'Subject Workspace', 
        type: 'root', 
        resourcesCount: resources.length,
        notesCount: resources.filter(r => r.type === 'notes').length,
        isExpanded: true
      }
    ];
    const links = [];

    resources.forEach((res, index) => {
      const resId = `res-${res._id}`;
      const isCollapsed = collapsedNodes.has(resId);

      nodes.push({
        id: resId,
        label: res.title,
        type: res.type,
        resourcesCount: 0,
        notesCount: res.type === 'notes' ? 1 : 0,
        isExpanded: !isCollapsed
      });

      links.push({ source: rootId, target: resId, type: 'main' });

      if (!isCollapsed) {
        const subNodeTypes = ['Concepts', 'Flashcards', 'Quiz'];
        subNodeTypes.forEach(type => {
          const subId = `${resId}-${type.toLowerCase()}`;
          nodes.push({
            id: subId,
            label: type,
            type: 'ai-node',
            resourcesCount: 0,
            notesCount: 0,
            isExpanded: false
          });

          links.push({ source: resId, target: subId, type: 'ai' });
        });
      }
    });

    return { nodes, links };
  }, [session, resources, collapsedNodes]);

  // Synchronize graph nodes array with positions preservation
  useEffect(() => {
    const prevMap = new Map(nodesRef.current.map(n => [n.id, n]));
    
    // Position nodes using horizontal structure
    const updatedNodes = graphData.nodes.map((node, index) => {
      const existing = prevMap.get(node.id);
      if (existing) {
        return { ...node, ...existing, label: node.label, type: node.type };
      }

      // Initial layout calculations to prevent massive explosions
      let x = 0, y = 0, z = 0;
      if (node.type === 'root') {
        x = -250;
      } else if (node.type === 'ai-node') {
        x = 250;
        y = (Math.random() - 0.5) * 200;
        z = (Math.random() - 0.5) * 100;
      } else {
        x = 0;
        y = (index - resources.length / 2) * 120;
        z = (Math.random() - 0.5) * 50;
      }

      return {
        ...node,
        x, y, z,
        vx: 0, vy: 0, vz: 0,
        fx: 0, fy: 0, fz: 0
      };
    });

    nodesRef.current = updatedNodes;
    linksRef.current = graphData.links;
  }, [graphData, resources.length]);

  // Setup Three.js environment
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cssScene = new THREE.Scene();
    cssSceneRef.current = cssScene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    camera.position.set(0, 0, 800);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: webglCanvasRef.current, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // 4. CSS 3D Renderer
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(width, height);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.width = '100%';
    cssRenderer.domElement.style.height = '100%';
    cssCanvasRef.current.appendChild(cssRenderer.domElement);
    cssRendererRef.current = cssRenderer;

    // 5. Controls
    const controls = new OrbitControls(camera, cssCanvasRef.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 1500;
    controls.minDistance = 150;
    controlsRef.current = controls;

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xa78bfa, 2, 800);
    pointLight.position.set(0, 100, 300);
    scene.add(pointLight);

    // 7. Dynamic Space Galaxy Particles (Background Stars)
    const particleCount = 250;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(particleCount * 3);
    const starSpeeds = [];

    for (let i = 0; i < particleCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1600;
      starPositions[i+1] = (Math.random() - 0.5) * 1200;
      starPositions[i+2] = (Math.random() - 0.5) * 800;
      starSpeeds.push({
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.08,
        z: (Math.random() - 0.5) * 0.08
      });
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    
    // Minimal beautiful circle stars texture
    const starMaterial = new THREE.PointsMaterial({
      size: 3.5,
      color: 0x8ab4f8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 8. Setup window resizing
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
      cssRenderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animate camera fly-in at start
    cameraTarget.current = new THREE.Vector3(0, 0, 750);
    controlsTarget.current = new THREE.Vector3(0, 0, 0);

    const domEl = cssRenderer.domElement;
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      controls.dispose();
      renderer.dispose();
      if (cssCanvasRef.current && domEl) {
        cssCanvasRef.current.removeChild(domEl);
      }
    };
  }, []);

  // Update HTML Card Elements inside CSS 3D scene
  useEffect(() => {
    if (!sceneRef.current || !cssSceneRef.current) return;

    // Clear previous objects
    Object.values(cssObjectsRef.current).forEach(obj => {
      cssSceneRef.current.remove(obj);
    });
    cssObjectsRef.current = {};

    // Remove old particle models and lines
    linkLinesRef.current.forEach(line => sceneRef.current.remove(line));
    linkLinesRef.current = [];
    
    linkParticlesRef.current.forEach(p => sceneRef.current.remove(p.mesh));
    linkParticlesRef.current = [];

    // Particle geometry and glowing visual material
    const particleGeo = new THREE.SphereGeometry(2.5, 8, 8);

    // Mount nodes
    nodesRef.current.forEach(node => {
      const theme = getCategoryTheme(node.type);
      const isSelected = selectedNode?.id === node.id;
      const isFaded = searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase());
      
      const nodeEl = document.createElement('div');
      nodeEl.className = 'css3d-node-wrapper';
      nodeEl.style.width = node.type === 'ai-node' ? '140px' : '190px';
      nodeEl.style.height = node.type === 'ai-node' ? '40px' : '56px';

      const root = createRoot(nodeEl);
      const IconComp = theme.icon;

      // Handle double click toggle
      const handleNodeDoubleClick = (e) => {
        e.stopPropagation();
        if (node.type === 'root') return;
        
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      };

      // Handle selection click
      const handleNodeClick = (e) => {
        e.stopPropagation();
        setSelectedNode(node);
        // Position camera to zoom in on clicked node
        cameraTarget.current = new THREE.Vector3(node.x, node.y, node.z + 320);
        controlsTarget.current = new THREE.Vector3(node.x, node.y, node.z);
      };

      root.render(
        <div
          onClick={handleNodeClick}
          onDoubleClick={handleNodeDoubleClick}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: node.type === 'ai-node' ? '6px' : '10px',
            padding: node.type === 'ai-node' ? '4px 10px' : '6px 14px',
            borderRadius: node.type === 'ai-node' ? '20px' : '8px',
            background: theme.bg,
            border: `1px solid ${isSelected ? '#fff' : theme.border}`,
            boxShadow: isSelected 
              ? `0 0 20px 0 ${theme.shadow}, 0 8px 32px 0 rgba(0, 0, 0, 0.5)` 
              : `0 8px 24px 0 rgba(0, 0, 0, 0.45)`,
            backdropFilter: 'blur(16px)',
            color: '#fff',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            opacity: isFaded ? 0.25 : 1,
            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden'
          }}
          title={node.label.length > 20 ? node.label : ''}
        >
          {/* Theme Colored Indicator Border */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            background: theme.color,
            display: node.type === 'ai-node' ? 'none' : 'block'
          }} />

          {/* Left Icon */}
          <div style={{ display: 'flex', alignItems: 'center', color: theme.color, flexShrink: 0 }}>
            <IconComp size={node.type === 'ai-node' ? 12 : 14} />
          </div>

          {/* Text Title Content */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: node.type === 'ai-node' ? '10px' : '11px',
              fontWeight: 650,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2
            }}>
              {node.label}
            </span>
            {node.type !== 'ai-node' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                {node.resourcesCount > 0 && (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                    {node.resourcesCount} Res
                  </span>
                )}
                {node.notesCount > 0 && (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                    {node.notesCount} Notes
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action chevron */}
          {node.type !== 'ai-node' && node.type !== 'root' && (
            <div style={{ opacity: 0.35, color: '#fff', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={10} style={{ transform: collapsedNodes.has(node.id) ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
            </div>
          )}
        </div>
      );

      // Create 3D wrapper object
      const cssObj = new CSS3DObject(nodeEl);
      cssObj.position.set(node.x, node.y, node.z);
      cssSceneRef.current.add(cssObj);
      cssObjectsRef.current[node.id] = cssObj;
    });

    // Create 3D connector tubes and particles
    linksRef.current.forEach(link => {
      const sourceNode = nodesRef.current.find(n => n.id === link.source);
      const targetNode = nodesRef.current.find(n => n.id === link.target);
      if (!sourceNode || !targetNode) return;

      // Draw connection line
      const material = new THREE.LineBasicMaterial({
        color: link.type === 'ai' ? 0x2dd4bf : 0xa78bfa,
        transparent: true,
        opacity: searchQuery ? 0.12 : 0.28
      });

      const points = [];
      points.push(new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z));
      points.push(new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z));

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      
      sceneRef.current.add(line);
      linkLinesRef.current.push(line);

      // Render traveling glowing particle
      const pColor = link.type === 'ai' ? 0x48efb3 : 0xa78bfa;
      const pMat = new THREE.MeshBasicMaterial({
        color: pColor,
        transparent: true,
        opacity: searchQuery ? 0.2 : 0.75
      });
      const pMesh = new THREE.Mesh(particleGeo, pMat);
      
      sceneRef.current.add(pMesh);
      linkParticlesRef.current.push({
        mesh: pMesh,
        source: sourceNode,
        target: targetNode,
        progress: Math.random()
      });
    });

  }, [graphData, selectedNode, searchQuery, collapsedNodes]);

  // Main 3D Physics Simulation & Loop
  useEffect(() => {
    const loop = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;

      // 1. Verlet 3D force physics
      nodes.forEach(node => {
        node.fx = 0;
        node.fy = 0;
        node.fz = 0;

        // Add subtle slow floating wave motion
        const time = Date.now() * 0.001;
        node.fx += Math.sin(time + node.id.charCodeAt(0)) * 0.035;
        node.fy += Math.cos(time + (node.id.charCodeAt(1) || 0)) * 0.035;
        node.fz += Math.sin(time + (node.id.charCodeAt(2) || 0)) * 0.02;
      });

      // Coulomb Repulsion (pushes cards apart, preventing overlays)
      const repulsion = 14000;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dz = n2.z - n1.z;
          const distSq = dx * dx + dy * dy + dz * dz + 0.1;
          const dist = Math.sqrt(distSq);

          if (dist < 380) {
            const force = repulsion / (distSq + 1);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const fz = (dz / dist) * force;

            n1.fx -= fx;
            n1.fy -= fy;
            n1.fz -= fz;
            n2.fx += fx;
            n2.fy += fy;
            n2.fz += fz;
          }
        }
      }

      // Spring Links Attraction (pulls branches together)
      const springLength = 160;
      const springK = 0.075;
      links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return;

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dz = targetNode.z - sourceNode.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

        const delta = dist - springLength;
        const force = springK * delta;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        sourceNode.fx += fx;
        sourceNode.fy += fy;
        sourceNode.fz += fz;
        targetNode.fx -= fx;
        targetNode.fy -= fy;
        targetNode.fz -= fz;
      });

      // Gravity center pull
      const gravity = 0.025;
      nodes.forEach(node => {
        node.fx -= node.x * gravity;
        node.fy -= node.y * gravity;
        node.fz -= node.z * gravity;
      });

      // Update positions
      const damping = 0.82;
      const timeStep = 0.45;
      nodes.forEach(node => {
        if (node.id === 'root') return; // Anchor root

        node.vx = (node.vx + node.fx) * damping;
        node.vy = (node.vy + node.fy) * damping;
        node.vz = (node.vz + node.fz) * damping;

        node.x += node.vx * timeStep;
        node.y += node.vy * timeStep;
        node.z += node.vz * timeStep;
      });

      // Update 3D card coordinate positions
      nodes.forEach(node => {
        const cssObj = cssObjectsRef.current[node.id];
        if (cssObj) {
          cssObj.position.set(node.x, node.y, node.z);
        }
      });

      // Update link line segment coordinates
      let lineIdx = 0;
      links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        const line = linkLinesRef.current[lineIdx++];
        if (sourceNode && targetNode && line) {
          const positions = line.geometry.attributes.position.array;
          positions[0] = sourceNode.x;
          positions[1] = sourceNode.y;
          positions[2] = sourceNode.z;
          positions[3] = targetNode.x;
          positions[4] = targetNode.y;
          positions[5] = targetNode.z;
          line.geometry.attributes.position.needsUpdate = true;
        }
      });

      // Animate flowing energy particles along connecting links
      linkParticlesRef.current.forEach(p => {
        p.progress += 0.006;
        if (p.progress > 1) p.progress = 0;
        
        const sourceX = p.source.x;
        const sourceY = p.source.y;
        const sourceZ = p.source.z;

        const targetX = p.target.x;
        const targetY = p.target.y;
        const targetZ = p.target.z;

        p.mesh.position.set(
          sourceX + (targetX - sourceX) * p.progress,
          sourceY + (targetY - sourceY) * p.progress,
          sourceZ + (targetZ - sourceZ) * p.progress
        );
      });

      // Smooth camera interpolation targeting (LERP)
      if (cameraTarget.current && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerp(cameraTarget.current, 0.05);
        controlsRef.current.target.lerp(controlsTarget.current, 0.05);
        
        // Stop LERPing when close enough
        if (cameraRef.current.position.distanceTo(cameraTarget.current) < 1) {
          cameraTarget.current = null;
        }
      }

      // 2. Render loops
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      if (cssRendererRef.current && cssSceneRef.current && cameraRef.current) {
        cssRendererRef.current.render(cssSceneRef.current, cameraRef.current);
      }

      // 3. Render 2D viewport minimap (projective dot map)
      renderMinimap();

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [selectedNode, searchQuery]);

  // Projective 2D Minimap renderer
  const renderMinimap = () => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Compute graph bounds
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const graphW = (maxX - minX) || 1;
    const graphH = (maxY - minY) || 1;
    
    // Fit projectively inside canvas padding
    const padding = 15;
    const mapW = canvas.width - padding * 2;
    const mapH = canvas.height - padding * 2;

    const scaleX = mapW / graphW;
    const scaleY = mapH / graphH;
    const mapScale = Math.min(scaleX, scaleY);

    const offsetX = padding + (mapW - graphW * mapScale) / 2;
    const offsetY = padding + (mapH - graphH * mapScale) / 2;

    // Draw connection lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    linksRef.current.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (source && target) {
        const sx = offsetX + (source.x - minX) * mapScale;
        const sy = offsetY + (source.y - minY) * mapScale;
        const tx = offsetX + (target.x - minX) * mapScale;
        const ty = offsetY + (target.y - minY) * mapScale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    });

    // Draw node dot indicators
    nodes.forEach(n => {
      const x = offsetX + (n.x - minX) * mapScale;
      const y = offsetY + (n.y - minY) * mapScale;
      
      const theme = getCategoryTheme(n.type);
      ctx.fillStyle = theme.color;
      ctx.shadowBlur = n.id === selectedNode?.id ? 8 : 0;
      ctx.shadowColor = theme.color;

      ctx.beginPath();
      ctx.arc(x, y, n.id === selectedNode?.id ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  // Helper Controls
  const handleResetCamera = useCallback(() => {
    cameraTarget.current = new THREE.Vector3(0, 0, 750);
    controlsTarget.current = new THREE.Vector3(0, 0, 0);
    setSelectedNode(null);
  }, []);

  const handleAutoArrange = useCallback(() => {
    // Shuffles coordinates to restart gravity convergence smoothly
    nodesRef.current.forEach((node, index) => {
      if (node.id === 'root') return;
      node.x = (Math.random() - 0.5) * 100;
      node.y = (Math.random() - 0.5) * 100;
      node.z = (Math.random() - 0.5) * 50;
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
    });
  }, []);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        console.error('Failed to trigger fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleExportPNG = () => {
    // Focus capture on WebGL layers
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `MindSync-${session?.title || 'Map'}.png`;
    link.href = url;
    link.click();
  };

  const handleExpandAll = () => {
    setCollapsedNodes(new Set());
  };

  const handleCollapseAll = () => {
    const collapsedSet = new Set(resources.map(r => `res-${r._id}`));
    setCollapsedNodes(collapsedSet);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'radial-gradient(circle at center, #111827 0%, #0f172a 45%, #09090b 100%)',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* GLOW ATMOSPHERE GRAPHICS CANVASES */}
      <canvas 
        ref={webglCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      <div 
        ref={cssCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2
        }}
      />

      {/* FLOATING TOP-LEFT PANEL: Search & Details Overlay */}
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 10,
          width: '260px',
          pointerEvents: 'auto'
        }}
      >
        {/* Glass Search Input */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '8px 12px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)'
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search nodes..."
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

        {/* Dynamic Context Panel */}
        {selectedNode ? (
          <div 
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '14px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={12} style={{ color: getCategoryTheme(selectedNode.type).color }} />
              <span style={{ fontSize: '9px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Node Details
              </span>
            </div>
            <h4 style={{ margin: '4px 0 2px 0', fontSize: '12px', fontWeight: 700, color: '#fff' }}>
              {selectedNode.label}
            </h4>
            <span style={{ fontSize: '9px', color: getCategoryTheme(selectedNode.type).color, fontWeight: 600 }}>
              Category: {selectedNode.type.toUpperCase()}
            </span>
            <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              Double-click to expand or collapse child branches in the interactive graph canvas.
            </span>
          </div>
        ) : (
          <div 
            style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '10px 14px',
              backdropFilter: 'blur(12px)',
              color: 'var(--text-muted)',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <GitFork size={12} />
            <span>Select a card to view active connections.</span>
          </div>
        )}
      </div>

      {/* FLOATING TOP-RIGHT PANEL: Full Action Toolbars */}
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '6px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          pointerEvents: 'auto'
        }}
      >
        <button 
          onClick={handleResetCamera} 
          className="action-btn-circle" 
          title="Reset Viewport"
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RotateCcw size={12} />
        </button>

        <button 
          onClick={handleAutoArrange} 
          className="action-btn-circle" 
          title="Auto-Arrange Nodes"
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <LayoutGrid size={12} />
        </button>

        <div style={{ width: '1px', height: '14px', background: 'var(--glass-border)', margin: '0 2px' }} />

        <button 
          onClick={handleExpandAll} 
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '9px', fontWeight: 650, cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
          title="Expand all nodes"
        >
          EXPAND
        </button>

        <button 
          onClick={handleCollapseAll} 
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '9px', fontWeight: 650, cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
          title="Collapse all nodes"
        >
          COLLAPSE
        </button>

        <div style={{ width: '1px', height: '14px', background: 'var(--glass-border)', margin: '0 2px' }} />

        <button 
          onClick={handleExportPNG} 
          className="action-btn-circle" 
          title="Export Canvas Capture"
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Download size={12} />
        </button>

        <button 
          onClick={handleToggleFullscreen} 
          className="action-btn-circle" 
          title="Fullscreen Toggle"
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>

      {/* FLOATING BOTTOM-RIGHT PANEL: 2D Viewport Projective Minimap */}
      <div 
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '120px',
          height: '100px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '6px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
          <MapIcon size={9} />
          <span style={{ fontSize: '8px', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Live Map
          </span>
        </div>
        <canvas 
          ref={minimapCanvasRef} 
          width={108} 
          height={76} 
          style={{
            flex: 1,
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.02)'
          }}
        />
      </div>

      {/* BOTTOM-LEFT GRAPH TIPS FOOTER */}
      <div 
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(255, 255, 255, 0.02)',
          borderRadius: '20px',
          fontSize: '9px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <Sparkles size={10} style={{ color: 'var(--accent-purple)' }} />
        <span>Use Left-Click + Drag to rotate. Right-Click + Drag to pan. Double-click cards to collapse children.</span>
      </div>
    </div>
  );
});

MindMapPanel.displayName = 'MindMapPanel';
export default MindMapPanel;
