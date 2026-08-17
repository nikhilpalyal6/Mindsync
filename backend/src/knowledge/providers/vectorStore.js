import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import winstonLogger from '../../config/logger.js';

class MongoVectorStore {
  /**
   * Upsert chunks to the vector store database.
   * @param {Array<Object>} chunks - Array of KnowledgeChunk documents to save.
   */
  async upsert(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) return;
    winstonLogger.info(`[Mongo Vector Store] Upserting ${chunks.length} chunks`);
    
    // Perform bulk insertion or individual updates
    const bulkOps = chunks.map(chunk => ({
      updateOne: {
        filter: { 
          userId: chunk.userId, 
          workspaceId: chunk.workspaceId, 
          resourceId: chunk.resourceId, 
          chunkIndex: chunk.chunkIndex 
        },
        update: { $set: chunk },
        upsert: true
      }
    }));
    await KnowledgeChunk.bulkWrite(bulkOps);
  }

  /**
   * Performs an in-memory cosine similarity search over database-filtered chunks.
   */
  async search(userId, workspaceId, queryEmbedding, topK = 5, options = {}) {
    winstonLogger.info(`[Mongo Vector Store] Querying vectors for workspace ${workspaceId} and user ${userId}`);
    const { resourceId } = options;

    // Filter by READY documents that have successfully generated embeddings
    const KnowledgeDocument = (await import('../../models/knowledgeDocument.model.js')).default;
    const docFilter = { userId, workspaceId, processingStatus: 'READY', embeddingStatus: 'SUCCESS' };
    if (resourceId) {
      docFilter.resourceId = resourceId;
    }
    const readyDocs = await KnowledgeDocument.find(docFilter).select('_id').lean();
    const readyDocIds = readyDocs.map(d => d._id);
    
    if (readyDocIds.length === 0) {
      return [];
    }

    // Critical Requirement: Scope query at the DB driver level before performing vector calculations
    const chunkFilter = { 
      userId, 
      workspaceId, 
      documentId: { $in: readyDocIds } 
    };
    if (resourceId) {
      chunkFilter.resourceId = resourceId;
    }

    const chunks = await KnowledgeChunk.find(chunkFilter).lean();
    if (chunks.length === 0) {
      return [];
    }

    const queryLength = queryEmbedding.length;

    // Calculate Cosine Similarity
    const scoredChunks = chunks.map(chunk => {
      const chunkEmbedding = chunk.embedding;
      if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length !== queryLength) {
        return { chunk, score: 0 };
      }

      const score = this._calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
      return { chunk, score };
    });

    // Sort by descending score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Limit and format result list
    return scoredChunks.slice(0, topK).map(item => ({
      ...item.chunk,
      score: item.score
    }));
  }

  /**
   * Deletes chunks associated with a specific resource.
   */
  async deleteByResource(resourceId) {
    winstonLogger.info(`[Mongo Vector Store] Deleting chunks for resource ${resourceId}`);
    await KnowledgeChunk.deleteMany({ resourceId });
  }

  /**
   * Deletes chunks associated with an entire workspace.
   */
  async deleteByWorkspace(workspaceId) {
    winstonLogger.info(`[Mongo Vector Store] Deleting chunks for workspace ${workspaceId}`);
    await KnowledgeChunk.deleteMany({ workspaceId });
  }

  _calculateCosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const valA = vecA[i];
      const valB = vecB[i];
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default new MongoVectorStore();
