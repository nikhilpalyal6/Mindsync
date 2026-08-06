import summaryService from '../services/summary/summary.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class SummaryController {
  generateSummary = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { summaryType, forceRefresh, resourceType, resourceId } = req.body;
    const userId = req.user._id;

    const result = await summaryService.generateSummary({
      userId,
      sessionId,
      summaryType,
      forceRefresh: Boolean(forceRefresh),
      resourceType,
      resourceId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Summary generated successfully')
    );
  });

  getSummary = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { resourceType, summaryType, resourceId } = req.query;
    const userId = req.user._id;

    const result = await summaryService.getSummary({
      userId,
      sessionId,
      resourceType,
      summaryType,
      resourceId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Summary retrieved successfully')
    );
  });
}

export default new SummaryController();
