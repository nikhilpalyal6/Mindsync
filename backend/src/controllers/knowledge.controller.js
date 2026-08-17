import knowledgeService from '../knowledge/services/knowledge.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import StudySession from '../models/studySession.model.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class KnowledgeController {
  getStatus = asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const { resourceId } = req.params;
    const userId = req.user._id;
    let { workspaceId } = req.query;

    // Feature flag check
    if (process.env.KNOWLEDGE_ENGINE_ENABLED === 'false') {
      return res.status(HTTP_STATUS.OK).json(
        ApiResponse.success({
          status: 'PENDING',
          progress: 0,
          chunks: 0,
          error: 'Knowledge engine is globally disabled.'
        }, 'Feature disabled')
      );
    }

    // Securely find workspace and verify ownership
    const startTime = Date.now();
    let session;
    if (workspaceId) {
      session = await StudySession.findOne({ _id: workspaceId, user: userId })
        .select('_id user resources._id resources.type')
        .lean();
    } else {
      session = await StudySession.findOne({ user: userId, 'resources._id': resourceId })
        .select('_id user resources._id resources.type')
        .lean();
    }

    if (!session) {
      console.warn(`[KnowledgeStatus] Session not found or unauthorized: workspaceId=${workspaceId}, resourceId=${resourceId}, userId=${userId}`);
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Resource workspace not found or unauthorized.');
    }

    const matchedResource = session.resources.find(r => r._id?.toString() === resourceId || r.url === resourceId);
    if (!matchedResource) {
      console.warn(`[KnowledgeStatus] Resource not found in session: resourceId=${resourceId}, sessionResources=${JSON.stringify(session.resources.map(r => r._id || r.url))}`);
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Resource not found in workspace.');
    }

    const statusData = await knowledgeService.getStatus(userId, session._id, resourceId);
    const duration = Date.now() - startTime;
    console.log(`[KnowledgeStatusTiming] controllerDurationMs=${duration} status=${statusData.status} resourceId=${resourceId} workspaceId=${session._id}`);
    
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(statusData, 'Knowledge processing status retrieved successfully.')
    );
  });

  reindex = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const userId = req.user._id;
    let { workspaceId } = req.body;

    // Feature flag check
    if (process.env.KNOWLEDGE_ENGINE_ENABLED === 'false' || process.env.KNOWLEDGE_INGESTION_ENABLED === 'false') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Knowledge ingestion is globally disabled.');
    }

    // Securely find workspace and verify ownership
    let session;
    if (workspaceId) {
      session = await StudySession.findOne({ _id: workspaceId, user: userId });
    } else {
      session = await StudySession.findOne({ user: userId, 'resources._id': resourceId });
    }

    if (!session) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Resource workspace not found or unauthorized.');
    }

    const matchedResource = session.resources.find(r => r._id?.toString() === resourceId);
    if (!matchedResource) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Resource not found in workspace.');
    }

    await knowledgeService.reindexResource(userId, session._id, resourceId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Resource reindexing triggered successfully.')
    );
  });

  search = asyncHandler(async (req, res) => {
    const { workspaceId, query, topK = 5 } = req.body;
    const userId = req.user._id;

    // Feature flag check
    if (process.env.KNOWLEDGE_ENGINE_ENABLED === 'false' || process.env.KNOWLEDGE_RETRIEVAL_ENABLED === 'false') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Knowledge retrieval is globally disabled.');
    }

    if (!workspaceId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Workspace ID is required.');
    }

    if (!query || !query.trim()) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Query text is required.');
    }

    // Securely check workspace ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Workspace not found or unauthorized.');
    }

    // Limit topK to a safe max (e.g. 20)
    const limit = Math.min(20, Math.max(1, parseInt(topK, 10) || 5));

    const retrievalService = (await import('../knowledge/services/retrieval.service.js')).default;
    const results = await retrievalService.retrieve(userId, workspaceId, query, limit);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ results }, 'Knowledge search completed successfully.')
    );
  });
}

export default new KnowledgeController();
