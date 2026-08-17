import embeddingService from './embedding.service.js';
import vectorStore from '../providers/vectorStore.js';
import rerankingService from './reranking.service.js';
import citationService from './citation.service.js';
import scoreFusion from '../utils/scoreFusion.util.js';
import hashUtil from '../utils/hash.util.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import winstonLogger from '../../config/logger.js';

class RetrievalService {
  constructor() {
    this._cache = new Map();
    this._inFlight = new Map();
    this._knowledgeVersion = 1;
    this.TTL_MS = parseInt(process.env.KNOWLEDGE_CACHE_TTL_MS, 10) || 60000;
    this.MAX_CACHE_ENTRIES = 1000;
  }

  /**
   * Performs hybrid search retrieval with caching and deduplication.
   */
  async retrieve(userId, workspaceId, queryText, topK = 5, options = {}) {
    if (process.env.KNOWLEDGE_ENGINE_ENABLED === 'false' || process.env.KNOWLEDGE_RETRIEVAL_ENABLED === 'false') {
      winstonLogger.info('[Retrieval Service] Retrieval bypassed: Knowledge Engine is disabled by feature flag.');
      return [];
    }

    const maxQueryLength = parseInt(process.env.KNOWLEDGE_MAX_QUERY_LENGTH, 10) || 200;
    const sanitizedQuery = (queryText || '').trim().slice(0, maxQueryLength);
    if (!sanitizedQuery) {
      return [];
    }

    const resourceFilter = options.resourceId || '';
    const queryHash = hashUtil.generateContentHash(sanitizedQuery);
    const cacheKey = `${userId.toString()}:${workspaceId.toString()}:${resourceFilter}:${queryHash}:${this._knowledgeVersion}`;

    // 1. Check Bounded Retrieval Cache
    if (this._cache.has(cacheKey)) {
      const cachedEntry = this._cache.get(cacheKey);
      if (Date.now() - cachedEntry.timestamp < this.TTL_MS) {
        winstonLogger.info(`[Retrieval Service] Cache hit for key: ${cacheKey}`);
        return cachedEntry.data;
      }
      this._cache.delete(cacheKey); // Evict expired
    }

    // 2. Request Deduplication (prevent duplicate embedding calls)
    if (this._inFlight.has(cacheKey)) {
      winstonLogger.info(`[Retrieval Service] Deduplicating active request for: ${cacheKey}`);
      return this._inFlight.get(cacheKey);
    }

    // Wrap execution in a deduplication promise
    const retrievePromise = (async () => {
      try {
        const results = await this._executeRetrieval(userId, workspaceId, sanitizedQuery, topK, options);
        
        // Cache successful non-empty results
        if (results.length > 0) {
          this._cache.set(cacheKey, { data: results, timestamp: Date.now() });
          
          // Bounded FIFO cache eviction
          if (this._cache.size > this.MAX_CACHE_ENTRIES) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
          }
        }
        
        return results;
      } finally {
        this._inFlight.delete(cacheKey); // Cleanup inflight
      }
    })();

    this._inFlight.set(cacheKey, retrievePromise);
    return retrievePromise;
  }

  /**
   * Internal retrieval process.
   */
  async _executeRetrieval(userId, workspaceId, query, topK, options = {}) {
    // A. Query only chunks from documents matching user + workspace that are READY
    const docQuery = { 
      userId, 
      workspaceId, 
      processingStatus: 'READY' 
    };
    if (options.resourceId) {
      docQuery.resourceId = options.resourceId;
    }
    const readyDocs = await KnowledgeDocument.find(docQuery).lean();

    if (readyDocs.length === 0) {
      return [];
    }

    const readyDocIds = readyDocs.map(d => d._id);
    const docLookup = new Map(readyDocs.map(d => [d._id.toString(), d]));

    // B. Semantic Retrieval
    const hasSuccessfulEmbeddings = readyDocs.some(d => d.embeddingStatus === 'SUCCESS');
    let semanticResults = [];

    const semanticMultiplier = parseInt(process.env.KNOWLEDGE_SEMANTIC_CANDIDATE_MULTIPLIER, 10) || 2;
    const keywordMultiplier = parseInt(process.env.KNOWLEDGE_KEYWORD_CANDIDATE_MULTIPLIER, 10) || 2;

    const semanticTopK = topK * semanticMultiplier;
    const keywordTopK = topK * keywordMultiplier;

    if (hasSuccessfulEmbeddings) {
      try {
        const queryEmbedding = await embeddingService.generateEmbedding(query);
        semanticResults = await vectorStore.search(userId, workspaceId, queryEmbedding, semanticTopK, options);
      } catch (embErr) {
        winstonLogger.warn(`[Retrieval Service] Failed to generate query embedding: ${embErr.message}. Bypassing semantic search.`);
      }
    } else {
      winstonLogger.info(`[Retrieval Service] All documents in workspace have failed embedding status. Bypassing semantic search.`);
    }

    // C. Keyword Retrieval
    const keywordResults = await this._executeKeywordSearch(userId, workspaceId, readyDocIds, query, keywordTopK, options);

    // D. Score Fusion
    const semanticWeight = parseFloat(process.env.KNOWLEDGE_SEMANTIC_WEIGHT) || 0.7;
    const keywordWeight = parseFloat(process.env.KNOWLEDGE_KEYWORD_WEIGHT) || 0.3;

    const fusedResults = scoreFusion.fuseScores(semanticResults, keywordResults, {
      semanticWeight,
      keywordWeight
    });

    // E. Ollama Reranking
    const reranked = await rerankingService.rerankCandidates(query, fusedResults);

    // F. Limit, Populate Document info, and Map Citation
    const finalResults = [];
    const selection = reranked.slice(0, topK);

    for (const item of selection) {
      const doc = docLookup.get(item.documentId.toString());
      if (!doc) continue;

      const citation = citationService.buildCitation(item, doc.type);

      finalResults.push({
        chunkId: item._id.toString(),
        documentId: item.documentId.toString(),
        resourceId: item.resourceId,
        workspaceId: item.workspaceId.toString(),
        text: item.text,
        score: item.score,
        semanticScore: item._details?.semanticScore || 0,
        keywordScore: item._details?.keywordScore || 0,
        sourceMetadata: {
          pageStart: item.metadata?.pageStart || null,
          pageEnd: item.metadata?.pageEnd || null,
          timestampStart: item.metadata?.timestampStart || null,
          timestampEnd: item.metadata?.timestampEnd || null,
          section: item.metadata?.section || '',
          heading: item.metadata?.heading || '',
          chunkIndex: item.chunkIndex,
          resourceType: doc.type,
          title: doc.title
        },
        citation
      });
    }

    return finalResults;
  }

  async _executeKeywordSearch(userId, workspaceId, readyDocIds, query, topK, options = {}) {
    const { resourceId } = options;
    let results = [];

    const chunkFilter = {
      userId,
      workspaceId,
      documentId: { $in: readyDocIds }
    };
    if (resourceId) {
      chunkFilter.resourceId = resourceId;
    }

    try {
      // 1. Text index search
      const textQuery = { ...chunkFilter, $text: { $search: query } };
      const textResults = await KnowledgeChunk.find(textQuery, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(topK).lean();

      if (textResults.length > 0) {
        // Normalize textScore by dividing by maximum score found
        const maxScore = Math.max(...textResults.map(r => r.score || 1.0));
        results = textResults.map(r => ({
          ...r,
          score: (r.score || 1.0) / maxScore
        }));
      }
    } catch (err) {
      winstonLogger.warn(`[Retrieval Service] Text index search failed or not index created: ${err.message}. Falling back to Regex.`);
    }

    // 2. Regex fallback search if no text results or text index is absent
    if (results.length === 0) {
      // Escape regex special characters to prevent injection/errors
      const escaped = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regexQuery = {
        ...chunkFilter,
        text: { $regex: escaped, $options: 'i' }
      };
      const regexResults = await KnowledgeChunk.find(regexQuery).limit(topK).lean();

      // Normalize regex matches with basic binary/constant score
      results = regexResults.map(r => ({
        ...r,
        score: 0.8 // high weight constant for regex match fallback
      }));
    }

    return results;
  }

  /**
   * Invalidates cached items for a specific workspace.
   */
  invalidateWorkspaceCache(workspaceId) {
    winstonLogger.info(`[Retrieval Service] Invalidating cache for workspace ${workspaceId}`);
    const wsIdStr = workspaceId.toString();

    for (const key of this._cache.keys()) {
      const parts = key.split(':');
      if (parts[1] === wsIdStr) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Invalidates entire cache due to global updates/reindexes.
   */
  invalidateAll() {
    winstonLogger.info('[Retrieval Service] Clearing all retrieval caches.');
    this._cache.clear();
    this._knowledgeVersion++;
  }
}

export default new RetrievalService();
