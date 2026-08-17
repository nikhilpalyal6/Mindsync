import KnowledgeJob from '../../models/knowledgeJob.model.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import processingService from './processing.service.js';
import StudySession from '../../models/studySession.model.js';
import ApiError from '../../utils/ApiError.js';
import winstonLogger from '../../config/logger.js';

class KnowledgeService {
  /**
   * Fetches the lightweight status of a resource's knowledge indexing.
   */
  async getStatus(userId, workspaceId, resourceId) {
    // 1. Verify workspace ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId })
      .select('_id user resources._id resources.url resources.title')
      .lean();
    if (!session) {
      throw ApiError.notFound('Workspace not found or unauthorized');
    }

    // Verify resource belongs to the workspace
    const resource = session.resources?.find(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId
    );
    if (!resource) {
      throw ApiError.notFound('Resource not found in this workspace');
    }

    // 2. Check if a KnowledgeDocument exists first
    const docStart = Date.now();
    const doc = await KnowledgeDocument.findOne({ userId, workspaceId, resourceId });
    console.log(`[KnowledgeStatusTiming] docQueryMs=${Date.now() - docStart} docFound=${!!doc} userId=${userId} workspaceId=${workspaceId} resourceId=${resourceId}`);
    if (doc) {
      if (doc.processingStatus === 'READY') {
        return {
          status: 'READY',
          progress: 100,
          chunks: doc.chunkCount ?? 0,
          error: null
        };
      }

      if (doc.processingStatus === 'FAILED') {
        return {
          status: 'FAILED',
          progress: 100,
          chunks: doc.chunkCount ?? 0,
          error: doc.errorMessage || 'Processing failed'
        };
      }

      // If document exists in an active processing status
      const job = await KnowledgeJob.findOne({ userId, workspaceId, resourceId });
      return {
        status: doc.processingStatus,
        progress: job ? job.progress : 50,
        chunks: doc.chunkCount ?? 0,
        error: job ? job.errorMessage : null
      };
    }

    // 3. Fallback to active KnowledgeJob if no document exists yet
    const jobStart = Date.now();
    const job = await KnowledgeJob.findOne({ userId, workspaceId, resourceId });
    console.log(`[KnowledgeStatusTiming] jobQueryMs=${Date.now() - jobStart} jobFound=${!!job} userId=${userId} workspaceId=${workspaceId} resourceId=${resourceId}`);
    if (job) {
      return {
        status: job.status,
        progress: job.progress,
        chunks: 0,
        error: job.errorMessage
      };
    }

    // 4. Default to NOT_INDEXED if neither document nor job exists
    return {
      status: 'NOT_INDEXED',
      progress: 0,
      chunks: 0,
      error: null
    };
  }

  /**
   * Manually triggers reindexing of a resource.
   */
  async reindexResource(userId, workspaceId, resourceId) {
    // 1. Verify workspace ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw ApiError.notFound('Workspace not found or unauthorized');
    }

    // Verify resource exists
    const resource = session.resources?.find(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId
    );
    if (!resource) {
      throw ApiError.notFound('Resource not found in this workspace');
    }

    // Invalidate cache
    try {
      const retrievalService = (await import('./retrieval.service.js')).default;
      retrievalService.invalidateWorkspaceCache(workspaceId);
    } catch (err) {
      winstonLogger.warn(`Failed to invalidate cache during reindex: ${err.message}`);
    }

    // Trigger processing
    return await processingService.triggerReindex(userId, workspaceId, resourceId);
  }
}

export default new KnowledgeService();
