import aiService from '../services/ai.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AIController {
  getConversations = asyncHandler(async (req, res) => {
    const { studySessionId, resourceId } = req.query;
    const userId = req.user._id;

    const conversations = await aiService.getConversations(userId, studySessionId, resourceId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(conversations, 'AI conversations retrieved successfully')
    );
  });

  createConversation = asyncHandler(async (req, res) => {
    const { studySessionId, resourceId, title } = req.body;
    const userId = req.user._id;

    const conversation = await aiService.createConversation(userId, {
      studySessionId,
      resourceId,
      title,
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success(conversation, 'AI conversation created successfully')
    );
  });

  updateConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await aiService.updateConversation(userId, id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(conversation, 'AI conversation updated successfully')
    );
  });

  deleteConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    await aiService.deleteConversation(userId, id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'AI conversation deleted successfully')
    );
  });

  getMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.query;
    const userId = req.user._id;

    const messages = await aiService.getMessages(userId, conversationId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(messages, 'AI messages retrieved successfully')
    );
  });

  sendMessage = asyncHandler(async (req, res) => {
    const { conversationId, content } = req.body;
    const userId = req.user._id;

    const result = await aiService.sendMessage(userId, {
      conversationId,
      content,
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success(result, 'Message sent successfully')
    );
  });
}

export default new AIController();
