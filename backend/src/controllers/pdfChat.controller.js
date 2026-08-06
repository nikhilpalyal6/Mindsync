import pdfChatService from '../services/pdfChat.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class PDFChatController {
  getPDFChatHistory = asyncHandler(async (req, res) => {
    const { workspaceId, resourceId } = req.query;
    const userId = req.user._id;

    if (!workspaceId || !resourceId) {
      return res.status(400).json(ApiResponse.error('Missing workspaceId or resourceId'));
    }

    const result = await pdfChatService.getPDFChatHistory({
      userId,
      workspaceId,
      resourceId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'PDF chat history retrieved successfully')
    );
  });

  sendPDFChatMessage = asyncHandler(async (req, res) => {
    const { workspaceId, resourceId, message } = req.body;
    const userId = req.user._id;

    if (!workspaceId || !resourceId || !message) {
      return res.status(400).json(ApiResponse.error('Missing workspaceId, resourceId, or message'));
    }

    const result = await pdfChatService.sendPDFChatMessage({
      userId,
      workspaceId,
      resourceId,
      message
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Message processed successfully')
    );
  });
}

export default new PDFChatController();
