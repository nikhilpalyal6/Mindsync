import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import hashUtil from '../utils/hash.util.js';
import winstonLogger from '../../config/logger.js';
import mongoose from 'mongoose';

class ProcessingService {
  /**
   * Queues background knowledge processing for a resource.
   * Fired asynchronously from resource ingestion hooks (fire-and-forget).
   */
  async queueProcessing(userId, workspaceId, resourceId, contentText, type, title) {
    if (process.env.KNOWLEDGE_ENGINE_ENABLED === 'false' || process.env.KNOWLEDGE_INGESTION_ENABLED === 'false') {
      winstonLogger.info('[Processing Service] Ingestion skipped: Knowledge Engine is disabled by feature flag.');
      return null;
    }

    try {
      const contentHash = hashUtil.generateContentHash(contentText || '');
      if (!contentHash) {
        throw new Error('Resource content is empty or invalid');
      }

      const processingVersion = 1;
      const embeddingModel = process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001';
      const chunkingVersion = 1;

      winstonLogger.info(`[Processing Service] Queueing job request for resource ${resourceId} in workspace ${workspaceId}`);

      // Check if document exists and matches hash
      const existingDoc = await KnowledgeDocument.findOne({ userId, workspaceId, resourceId });
      
      if (existingDoc) {
        const isSameConfig = existingDoc.contentHash === contentHash &&
                             existingDoc.processingVersion === processingVersion &&
                             existingDoc.embeddingModel === embeddingModel &&
                             existingDoc.chunkingVersion === chunkingVersion;

        if (isSameConfig && existingDoc.processingStatus === 'READY') {
          winstonLogger.info(`[Processing Service] Identical READY document already exists for resource ${resourceId}. Skipping execution.`);
          // Sync job state
          await KnowledgeJob.findOneAndUpdate(
            { userId, workspaceId, resourceId },
            { 
              $set: { 
                status: 'READY', 
                progress: 100, 
                completedAt: new Date(), 
                errorMessage: null, 
                errorCode: null 
              } 
            },
            { upsert: true }
          );
          return null;
        }

        // If content changed, we must clean up old chunks first
        if (existingDoc.contentHash !== contentHash) {
          winstonLogger.info(`[Processing Service] Content hash changed for resource ${resourceId}. Evicting stale chunks.`);
          await KnowledgeChunk.deleteMany({ resourceId });
        }
      }

      // Upsert KnowledgeJob atomically
      const job = await KnowledgeJob.findOneAndUpdate(
        { userId, workspaceId, resourceId },
        {
          $set: {
            status: 'PENDING',
            attempts: 0,
            progress: 0,
            errorCode: null,
            errorMessage: null,
            lockedAt: null,
            lockedBy: null,
            heartbeatAt: null
          }
        },
        { upsert: true, new: true }
      );

      // Trigger the background worker asynchronously (fire-and-forget)
      // We dynamically import the worker to avoid circular dependency loops during initialization
      import('../workers/knowledge.worker.js').then(m => {
        m.default.triggerWorker().catch(err => {
          winstonLogger.error(`[Processing Service] Background worker trigger failed: ${err.message}`);
        });
      }).catch(err => {
        winstonLogger.error(`[Processing Service] Failed to dynamically load background worker: ${err.message}`);
      });

      return job;
    } catch (err) {
      winstonLogger.error(`[Processing Service] Error queueing processing for resource ${resourceId}: ${err.message}`);
      // Do not throw the error to ensure caller does not fail
      return null;
    }
  }

  /**
   * Triggers reindexing manually for a failed job.
   */
  async triggerReindex(userId, workspaceId, resourceId) {
    winstonLogger.info(`[Processing Service] Manual reindex requested for resource ${resourceId}`);

    // Update job to pending state
    const job = await KnowledgeJob.findOneAndUpdate(
      { userId, workspaceId, resourceId },
      {
        $set: {
          status: 'PENDING',
          attempts: 0,
          progress: 0,
          errorCode: null,
          errorMessage: null,
          lockedAt: null,
          lockedBy: null,
          heartbeatAt: null
        }
      },
      { new: true }
    );

    if (!job) {
      throw new Error('No processing job exists for the specified resource.');
    }

    // Trigger worker asynchronously
    import('../workers/knowledge.worker.js').then(m => {
      m.default.triggerWorker().catch(err => {
        winstonLogger.error(`[Processing Service] Background worker trigger failed: ${err.message}`);
      });
    });

    return job;
  }
}

export default new ProcessingService();
