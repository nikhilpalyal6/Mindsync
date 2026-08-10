import smartHighlightService from '../services/smartHighlight.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import logger from '../config/logger.js';

class SmartHighlightController {
  generatePageSuggestions = asyncHandler(async (req, res) => {
    const { resourceId, pageNumber, studySessionId } = req.body;
    const userId = req.user._id;

    logger.info(`[SmartHighlights] ROUTE RECEIVED\nuserId: ${userId}\nresourceId: ${resourceId}\npageNumber: ${pageNumber}\npageNumberType: ${typeof pageNumber}`);
    logger.info(`[SmartHighlights] CONTROLLER START`);

    const result = await smartHighlightService.generatePageSuggestions(userId, resourceId, pageNumber, studySessionId);

    logger.info(`[SmartHighlights] RESPONSE SENT\nstatus: 200`);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Smart highlight suggestions generated successfully')
    );
  });

  regeneratePageSuggestions = asyncHandler(async (req, res) => {
    const { resourceId, pageNumber, studySessionId } = req.body;
    const userId = req.user._id;

    logger.info(`[SmartHighlights] ROUTE RECEIVED\nuserId: ${userId}\nresourceId: ${resourceId}\npageNumber: ${pageNumber}\npageNumberType: ${typeof pageNumber}`);
    logger.info(`[SmartHighlights] CONTROLLER START`);

    const result = await smartHighlightService.regeneratePageSuggestions(userId, resourceId, pageNumber, studySessionId);

    logger.info(`[SmartHighlights] RESPONSE SENT\nstatus: 200`);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Smart highlight suggestions regenerated successfully')
    );
  });

  getSuggestions = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const userId = req.user._id;

    const result = await smartHighlightService.getSuggestions(userId, resourceId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Smart highlight suggestions retrieved successfully')
    );
  });

  acceptSuggestions = asyncHandler(async (req, res) => {
    const { resourceId, suggestions } = req.body;
    const userId = req.user._id;

    const result = await smartHighlightService.acceptSuggestions(userId, resourceId, suggestions);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Smart highlight suggestions accepted successfully')
    );
  });

  rejectSuggestions = asyncHandler(async (req, res) => {
    const { resourceId } = req.body;
    let suggestionIds = req.body.suggestionIds;
    const { suggestionId } = req.params;

    if (suggestionId) {
      suggestionIds = [suggestionId];
    }

    const userId = req.user._id;

    const result = await smartHighlightService.rejectSuggestions(userId, resourceId, suggestionIds);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Smart highlight suggestions rejected successfully')
    );
  });
}

export default new SmartHighlightController();
