import AIConversation from '../models/aiConversation.model.js';
import AIMessage from '../models/aiMessage.model.js';
import StudySession from '../models/studySession.model.js';
import ApiError from '../utils/ApiError.js';
import aiProviderService from './ai/aiProvider.service.js';
import contextBuilderService from './context/contextBuilder.service.js';

class AIService {
  async getConversations(userId, studySessionId, resourceId) {
    if (!studySessionId) {
      throw ApiError.badRequest('studySessionId query parameter is required');
    }

    const query = {
      user: userId,
      studySession: studySessionId,
    };

    if (resourceId) {
      query.resourceId = resourceId;
    } else {
      query.$or = [
        { resourceId: { $exists: false } },
        { resourceId: '' }
      ];
    }

    let conversations = await AIConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .lean();

    // Auto-seed an initial default conversation if none exists
    if (conversations.length === 0) {
      const defaultConv = await AIConversation.create({
        user: userId,
        studySession: studySessionId,
        resourceId: resourceId || '',
        title: resourceId ? 'Resource Chat' : 'General Discussion',
      });
      conversations = [defaultConv.toObject()];
    }

    return conversations;
  }

  async createConversation(userId, { studySessionId, resourceId, title }) {
    if (!studySessionId) {
      throw ApiError.badRequest('studySessionId is required to create a conversation');
    }

    const conversation = await AIConversation.create({
      user: userId,
      studySession: studySessionId,
      resourceId: resourceId || '',
      title: title?.trim() || 'New Chat',
    });

    return conversation;
  }

  async updateConversation(userId, conversationId, { title }) {
    const conversation = await AIConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found or unauthorized');
    }

    if (title && title.trim()) {
      conversation.title = title.trim();
      await conversation.save();
    }

    return conversation;
  }

  async deleteConversation(userId, conversationId) {
    const conversation = await AIConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found or unauthorized');
    }

    await AIMessage.deleteMany({ conversation: conversationId });
    await AIConversation.deleteOne({ _id: conversationId });

    return { id: conversationId };
  }

  async getMessages(userId, conversationId) {
    if (!conversationId) {
      throw ApiError.badRequest('conversationId is required');
    }

    const conversation = await AIConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found or unauthorized');
    }

    return await AIMessage.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .lean();
  }

  async sendMessage(userId, { conversationId, content }) {
    if (!conversationId || !content || !content.trim()) {
      throw ApiError.badRequest('conversationId and message content are required');
    }

    const conversation = await AIConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found or unauthorized');
    }

    // 1. Save User Message in MongoDB
    const userMessage = await AIMessage.create({
      conversation: conversationId,
      user: userId,
      role: 'user',
      content: content.trim(),
      status: 'completed',
    });

    // 2. Build Enriched Workshop Memory & Context via ContextBuilderService
    const { systemInstruction, messages: boundedHistory } = await contextBuilderService.buildContext({
      userId,
      studySessionId: conversation.studySession,
      conversationId,
      currentQuery: content.trim(),
    });

    // 3. Generate AI Response via Active AI Provider (Groq / Gemini)
    let assistantContent = '';
    let status = 'completed';

    try {
      assistantContent = await aiProviderService.generateAIResponse({
        messages: boundedHistory,
        systemInstruction,
      });
    } catch (err) {
      console.error('AI Provider Error:', err.message);
      status = 'failed';
      assistantContent = 
        "I'm sorry, I encountered a temporary issue generating a response from the AI service. " +
        "Please verify your connection and try again in a moment.";
    }

    // 4. Save Assistant Message in MongoDB
    const assistantMessage = await AIMessage.create({
      conversation: conversationId,
      user: userId,
      role: 'assistant',
      content: assistantContent,
      status: status,
    });

    // 5. Update conversation lastMessageAt
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // 6. Increment chatCount on parent StudySession
    try {
      await StudySession.updateOne(
        { _id: conversation.studySession },
        { $inc: { chatCount: 2 } }
      );
    } catch (e) {
      console.error('Failed to update studySession chatCount:', e.message);
    }

    return {
      userMessage,
      assistantMessage,
    };
  }
}

export default new AIService();
