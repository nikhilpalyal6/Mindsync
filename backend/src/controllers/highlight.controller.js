import highlightService from '../services/highlight.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class HighlightController {
  createHighlight = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const highlight = await highlightService.createHighlight(userId, req.body);
    
    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.created(highlight, 'Highlight created successfully')
    );
  });

  getHighlights = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { resourceId } = req.params;
    
    const highlights = await highlightService.getHighlights(userId, resourceId);
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(highlights, 'Highlights retrieved successfully')
    );
  });

  deleteHighlight = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { highlightId } = req.params;
    
    await highlightService.deleteHighlight(userId, highlightId);
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Highlight deleted successfully')
    );
  });
}

export default new HighlightController();
