import mindMapService from '../services/mindMap.service.js';
import StudySession from '../models/studySession.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import logger from '../config/logger.js';

class MindMapController {
  // Retrieve an existing mind map status and data by workspaceId
  getMindMapByWorkspace = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workspaceId } = req.params;

    if (!workspaceId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Workspace ID is required.');
    }

    // 1. Verify workspace ownership (Step 3: Security)
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this study workspace.');
    }

    const data = await mindMapService.getMindMapByWorkspace(userId, workspaceId);
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({
        mindMap: data,
        status: data ? data.status : 'NOT_FOUND'
      }, 'Workspace mind map retrieved successfully.')
    );
  });

  // Trigger mind map generation
  generateMindMap = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workspaceId } = req.params;

    if (!workspaceId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Workspace ID is required.');
    }

    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this study workspace.');
    }

    mindMapService.generateWorkspaceMindMapBackground(
      userId.toString(),
      workspaceId,
      session.title,
      session.resources || [],
      true
    ).catch(err => logger.error(`[Workspace MindMap Generation] Error: ${err.message}`));

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({
        status: 'GENERATING'
      }, 'Workspace mind map generation triggered successfully.')
    );
  });
}

export default new MindMapController();
