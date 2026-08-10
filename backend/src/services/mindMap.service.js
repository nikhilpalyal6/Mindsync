import MindMap from '../models/mindMap.model.js';
import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import aiRouterConfig from '../config/aiRouter.config.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

// Helper to compute workspace resources hash
function computeWorkspaceHash(resources) {
  if (!resources || resources.length === 0) return '';
  
  // Sort resources by id to ensure deterministic serialization
  const sorted = [...resources].sort((a, b) => {
    const idA = (a._id || a.url || '').toString();
    const idB = (b._id || b.url || '').toString();
    return idA.localeCompare(idB);
  });

  const serialized = sorted.map(r => {
    const text = r.data?.extractedText || r.data?.transcript || r.data?.content || r.data?.noteContent || r.data?.notesContent || '';
    const dateStr = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    return `${r._id || r.url}_${text.length}_${dateStr}`;
  }).join('|');

  return crypto.createHash('sha256').update(serialized).digest('hex');
}

// Parse page numbers and sections from the extractedText string
function parsePagesFromExtractedText(extractedText) {
  const pages = [];
  if (!extractedText) return pages;

  const pageRegex = /\[Page\s+(\d+)\]/gi;
  let match;
  const pagePositions = [];

  while ((match = pageRegex.exec(extractedText)) !== null) {
    pagePositions.push({
      pageNumber: parseInt(match[1], 10),
      index: match.index,
      headerLength: match[0].length
    });
  }

  if (pagePositions.length === 0) {
    return [{
      pageNumber: 1,
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    }];
  }

  for (let i = 0; i < pagePositions.length; i++) {
    const current = pagePositions[i];
    const next = pagePositions[i + 1];
    const startIdx = current.index + current.headerLength;
    const endIdx = next ? next.index : extractedText.length;
    const text = extractedText.substring(startIdx, endIdx).trim();

    pages.push({
      pageNumber: current.pageNumber,
      text: text,
      wordCount: text.split(/\s+/).filter(Boolean).length
    });
  }

  return pages;
}

// Chunk text (for transcripts/notes)
function chunkText(text, maxWords = 3000) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

// Clean markdown tags from JSON responses
function parseCleanJson(text) {
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.substring(7);
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3);
  }
  return JSON.parse(clean.trim());
}

class MindMapService {
  // Retrieve an existing workspace mind map
  async getMindMapByWorkspace(userId, workspaceId) {
    logger.info(`[MindMap] Request received for workspaceId: ${workspaceId} for user: ${userId}`);
    const mindMap = await MindMap.findOne({ workspaceId, user: userId });
    if (mindMap) {
      logger.info(`[MindMap] Cached result found with status: ${mindMap.status}`);
    }
    return mindMap;
  }

  // AI-powered graph extraction pipeline running in backend background thread (Workspace Scoped)
  async generateWorkspaceMindMapBackground(userId, workspaceId, workspaceTitle, resources) {
    // 1. Filter out empty resources
    const validResources = (resources || []).filter(r => {
      const text = r.data?.extractedText || r.data?.transcript || r.data?.content || r.data?.noteContent || r.data?.notesContent || '';
      return text && text.trim().length > 0;
    });

    // Compute unique content hash
    const contentHash = computeWorkspaceHash(validResources);

    // If empty workspace: Save a completed mind map with empty nodes/edges so client shows empty state instantly
    if (validResources.length === 0) {
      logger.info(`[MindMap] Empty workspace detected for ${workspaceId}. Saving empty completed graph.`);
      await MindMap.findOneAndUpdate(
        { workspaceId, user: userId },
        {
          title: workspaceTitle || 'Workspace Learning Map',
          status: 'COMPLETED',
          nodes: [],
          edges: [],
          contentHash: '',
          error: null
        },
        { upsert: true, new: true }
      );
      return null;
    }

    // 2. Check if a mind map document already exists
    let mindMap = await MindMap.findOne({ workspaceId, user: userId });
    
    if (mindMap) {
      if (mindMap.status === 'COMPLETED' && mindMap.contentHash === contentHash) {
        logger.info(`[MindMap] Reusing existing completed workspace mind map for workspace: ${workspaceId}`);
        return mindMap;
      }
      if (mindMap.status === 'GENERATING') {
        logger.info(`[MindMap] Active workspace generation already running for workspace: ${workspaceId}`);
        return mindMap;
      }
      // Reset failed status to start fresh
      mindMap.status = 'GENERATING';
      mindMap.contentHash = contentHash;
      mindMap.error = null;
      await mindMap.save();
    } else {
      try {
        mindMap = await MindMap.create({
          workspaceId,
          user: userId,
          title: workspaceTitle || 'Workspace Learning Map',
          status: 'GENERATING',
          contentHash
        });
      } catch (err) {
        if (err.code === 11000) {
          mindMap = await MindMap.findOne({ workspaceId, user: userId });
          if (mindMap.status === 'COMPLETED' && mindMap.contentHash === contentHash) {
            return mindMap;
          }
          if (mindMap.status === 'GENERATING') {
            return mindMap;
          }
        } else {
          logger.error(`[MindMap] Mongoose create error: ${err.message}`);
          throw err;
        }
      }
    }

    // 3. Perform AI Provider Diagnostics
    const activeProviders = Object.keys(aiRouterConfig.providers).filter(
      name => aiRouterConfig.providers[name].enabled()
    );
    if (activeProviders.length === 0) {
      logger.error('[MindMap] AI provider configuration missing');
      mindMap.status = 'FAILED';
      mindMap.error = 'AI provider is not configured.';
      await mindMap.save();
      return mindMap;
    }

    logger.info(`[MindMap] Starting async background generation for workspace: ${workspaceId}`);

    // Trigger async processing loop
    try {
      const extractedConceptsPool = [];

      // 4. Pass 1: Extract concepts chunk-by-chunk for each resource
      for (const res of validResources) {
        const text = res.data?.extractedText || res.data?.transcript || res.data?.content || res.data?.noteContent || res.data?.notesContent || '';
        const isPdf = res.type === 'pdf';
        const pages = isPdf ? parsePagesFromExtractedText(text) : [];

        // Divide this resource into logical chunks (approx 6 pages or 3000 words each)
        const chunkSize = 6;
        const chunks = [];
        if (isPdf) {
          for (let i = 0; i < pages.length; i += chunkSize) {
            chunks.push({
              type: 'pdf',
              data: pages.slice(i, i + chunkSize)
            });
          }
        } else {
          const textChunks = chunkText(text, 3000);
          textChunks.forEach((chunk, index) => {
            chunks.push({
              type: res.type,
              data: chunk,
              index
            });
          });
        }

        // Call AI sequentially for each chunk of the resource to avoid rate limits
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          let chunkTextContent = '';
          let refPageNumber = null;
          let refTimestamp = null;

          if (chunk.type === 'pdf') {
            chunkTextContent = chunk.data.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n');
            refPageNumber = chunk.data[0]?.pageNumber || 1;
          } else {
            chunkTextContent = chunk.data;
            if (res.type === 'youtube') {
              refTimestamp = '0:00';
            }
          }

          const chunkPrompt = `
            Extract a list of key concepts, formulas, definitions, and topics from this study material.
            For each item, specify a short descriptive label, the conceptual type, and a brief description (1-2 sentences).

            Content:
            ---
            ${chunkTextContent}
            ---

            Your output must be a strict JSON array of objects with this exact structure:
            [
              {
                "label": "Name of the concept",
                "type": "TOPIC" | "SUBTOPIC" | "CONCEPT" | "PROCESS" | "FORMULA" | "DEFINITION" | "IMPORTANT",
                "description": "Short explanation",
                "page": ${refPageNumber ? refPageNumber : 'null'}
              }
            ]
          `;

          try {
            const chunkRes = await aiProviderService.generateAIResponse({
              messages: [{ role: 'user', content: chunkPrompt }],
              systemInstruction: 'Output strict JSON array only. No markdown fences.',
              jsonMode: true
            });

            const parsedConcepts = parseCleanJson(chunkRes.text || chunkRes.toString() || '');
            if (Array.isArray(parsedConcepts)) {
              parsedConcepts.forEach(c => {
                extractedConceptsPool.push({
                  label: c.label,
                  type: c.type || 'CONCEPT',
                  description: c.description || '',
                  source: {
                    resourceId: res._id.toString(),
                    resourceName: res.title || 'Resource',
                    pageNumber: c.page || refPageNumber || null,
                    timestamp: refTimestamp || null,
                    sectionTitle: res.type === 'notes' ? 'Notes Content' : null
                  }
                });
              });
            }
          } catch (e) {
            logger.warn(`[MindMap] Failed to parse concepts for resource chunk ${res.title} idx ${idx}: ${e.message}`);
          }
        }
      }

      // If no concepts were extracted in pass 1, throw error
      if (extractedConceptsPool.length === 0) {
        throw new Error('Could not extract any concepts from the workspace materials.');
      }

      // 5. Pass 2: Merge, deduplicate, and connect concepts into a unified graph (Cross-Resource mapping)
      // Compile pool concepts into readable context for the AI
      const poolContextText = extractedConceptsPool.map((c, idx) => 
        `Index: ${idx}\nLabel: "${c.label}"\nType: "${c.type}"\nDescription: "${c.description}"\nSource File: "${c.source.resourceName}"\nSource Page/Time: ${c.source.pageNumber || c.source.timestamp || 'N/A'}`
      ).join('\n\n');

      const consolidationPrompt = `
        You are MindSync's master knowledge-graph architect.
        We have extracted the following raw concepts from multiple resources in the study workspace:

        ---
        ${poolContextText}
        ---

        Your task:
        1. Consolidate and merge semantically identical concepts into a single unified node (e.g. if "TCP" or "Transmission Control Protocol" is mentioned multiple times across files, merge them into ONE node with nodeId "tcp").
        2. Keep a unified list of "sources" referencing the corresponding raw items' source resources.
        3. Create a clean hierarchical graph structure:
           - Provide exactly ONE "ROOT" node representing the entire workspace theme: "${workspaceTitle}".
           - Link the ROOT node to 3 to 6 major "TOPIC" nodes.
           - Link "TOPIC" nodes to "SUBTOPIC" or "CONCEPT" nodes.
           - Add "DEFINITION", "FORMULA", "PROCESS", or "EXAMPLE" nodes linked to their parents.
        4. Detect cross-resource relationships and draw links (edges) between them.
        5. Output strict JSON with "title", "nodes", and "edges".

        Your output must be a strict JSON object with this exact structure:
        {
          "title": "A concise title representing the entire workspace knowledge map",
          "nodes": [
            {
              "nodeId": "unique_short_id (e.g. root, tcp, osi_model, ip_routing)",
              "label": "Short name of concept (2-4 words)",
              "type": "ROOT" | "TOPIC" | "SUBTOPIC" | "CONCEPT" | "PROCESS" | "FORMULA" | "EXAMPLE" | "DEFINITION" | "IMPORTANT",
              "description": "Consolidated explanation of this concept",
              "importance": "HIGH" | "MEDIUM" | "LOW",
              "sources": [
                {
                  "resourceId": "resourceId string",
                  "resourceName": "Name of file",
                  "pageNumber": number or null,
                  "timestamp": "string or null",
                  "sectionTitle": "string or null"
                }
              ]
            }
          ],
          "edges": [
            {
              "sourceNode": "nodeId of source",
              "targetNode": "nodeId of target",
              "relationship": "CONTAINS" | "RELATED_TO" | "DEPENDS_ON" | "EXPLAINS" | "EXAMPLE_OF" | "PART_OF" | "COMPARES_WITH" | "CAUSES" | "USED_IN"
            }
          ]
        }
      `;

      const finalRes = await aiProviderService.generateAIResponse({
        messages: [{ role: 'user', content: consolidationPrompt }],
        systemInstruction: 'Output strict JSON object only. No markdown formatting.',
        jsonMode: true
      });

      const finalGraphData = parseCleanJson(finalRes.text || finalRes.toString() || '');

      // --- AI RESPONSE VALIDATION LAYER ---
      if (!finalGraphData || !Array.isArray(finalGraphData.nodes) || finalGraphData.nodes.length === 0) {
        throw new Error('AI consolidation returned an empty or malformed node list.');
      }

      // Remove duplicate Node IDs (keep first occurrence)
      const uniqueNodesMap = new Map();
      finalGraphData.nodes.forEach(node => {
        if (node && node.nodeId && !uniqueNodesMap.has(node.nodeId)) {
          uniqueNodesMap.set(node.nodeId, node);
        }
      });

      const colorMap = {
        ROOT: '#a855f7',
        RESOURCE: '#a855f7',
        TOPIC: '#3b82f6',
        SUBTOPIC: '#06b6d4',
        CONCEPT: '#10b981',
        FORMULA: '#eab308',
        PROCESS: '#f97316',
        DEFINITION: '#ef4444',
        EXAMPLE: '#22c55e',
        IMPORTANT: '#ec4899'
      };

      // Valid types/edges lists
      const validNodeTypes = ['ROOT', 'RESOURCE', 'TOPIC', 'SUBTOPIC', 'CONCEPT', 'PROCESS', 'FORMULA', 'EXAMPLE', 'DEFINITION', 'IMPORTANT'];
      const validEdgeTypes = ['CONTAINS', 'RELATED_TO', 'DEPENDS_ON', 'EXPLAINS', 'EXAMPLE_OF', 'PART_OF', 'COMPARES_WITH', 'CAUSES', 'USED_IN'];

      // Position placement and details formatting
      const validatedNodes = [];
      const nodeIdsSet = new Set(uniqueNodesMap.keys());
      let nodeIdx = 0;

      uniqueNodesMap.forEach((node, nodeId) => {
        const angle = (nodeIdx / uniqueNodesMap.size) * 2 * Math.PI;
        const radius = node.type === 'ROOT' ? 0 : (['TOPIC', 'RESOURCE'].includes(node.type) ? 180 : 320);
        const position = {
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius)
        };

        const validatedType = validNodeTypes.includes(node.type) ? node.type : 'CONCEPT';

        // Format sources array safely
        const formattedSources = [];
        if (Array.isArray(node.sources)) {
          node.sources.forEach(src => {
            if (src && (src.resourceId || src.resourceName)) {
              formattedSources.push({
                resourceId: src.resourceId || null,
                resourceName: src.resourceName || 'Resource',
                pageNumber: src.pageNumber || null,
                timestamp: src.timestamp || null,
                sectionTitle: src.sectionTitle || null
              });
            }
          });
        }

        // If sources list is empty, default it to workspace references if matching resource exists
        if (formattedSources.length === 0 && extractedConceptsPool.length > 0) {
          // Fallback search match by matching raw labels
          const rawMatch = extractedConceptsPool.find(rc => rc.label.toLowerCase() === node.label.toLowerCase());
          if (rawMatch) {
            formattedSources.push(rawMatch.source);
          }
        }

        validatedNodes.push({
          nodeId: nodeId,
          label: node.label || 'Concept',
          type: validatedType,
          description: node.description || '',
          importance: ['HIGH', 'MEDIUM', 'LOW'].includes(node.importance) ? node.importance : 'MEDIUM',
          color: colorMap[validatedType] || '#3b82f6',
          sources: formattedSources,
          position
        });
        nodeIdx++;
      });

      // Ensure at least one ROOT node exists
      const hasRoot = validatedNodes.some(n => n.type === 'ROOT');
      if (!hasRoot && validatedNodes.length > 0) {
        validatedNodes[0].type = 'ROOT';
        validatedNodes[0].color = colorMap.ROOT;
      }

      // Validate Edges
      const validatedEdges = [];
      if (Array.isArray(finalGraphData.edges)) {
        finalGraphData.edges.forEach(edge => {
          if (edge && edge.sourceNode && edge.targetNode) {
            if (nodeIdsSet.has(edge.sourceNode) && nodeIdsSet.has(edge.targetNode)) {
              validatedEdges.push({
                sourceNode: edge.sourceNode,
                targetNode: edge.targetNode,
                relationship: validEdgeTypes.includes(edge.relationship) ? edge.relationship : 'RELATED_TO'
              });
            }
          }
        });
      }

      // Update document
      mindMap.title = finalGraphData.title || workspaceTitle || 'Workspace Learning Map';
      mindMap.nodes = validatedNodes;
      mindMap.edges = validatedEdges;
      mindMap.status = 'COMPLETED';
      mindMap.error = null;
      
      const savedResult = await mindMap.save();
      logger.info(`[MindMap] Workspace knowledge map completed successfully for workspaceId: ${workspaceId}`);
      return savedResult;

    } catch (err) {
      logger.error(`[MindMap] Background generation failed for workspace ${workspaceId}: ${err.message}`);
      mindMap.status = 'FAILED';
      mindMap.error = err.message || 'Generation failed.';
      await mindMap.save();
      return mindMap;
    }
  }
}

export default new MindMapService();
