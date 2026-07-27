import AIConversation from '../models/aiConversation.model.js';
import AIMessage from '../models/aiMessage.model.js';
import StudySession from '../models/studySession.model.js';
import ApiError from '../utils/ApiError.js';
import aiProviderService from './ai/aiProvider.service.js';

class AIService {
  async getConversations(userId, studySessionId) {
    if (!studySessionId) {
      throw ApiError.badRequest('studySessionId query parameter is required');
    }

    let conversations = await AIConversation.find({
      user: userId,
      studySession: studySessionId,
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    // Auto-seed an initial default conversation if none exists
    if (conversations.length === 0) {
      const defaultConv = await AIConversation.create({
        user: userId,
        studySession: studySessionId,
        title: 'General Discussion',
      });
      conversations = [defaultConv.toObject()];
    }

    return conversations;
  }

  async createConversation(userId, { studySessionId, title }) {
    if (!studySessionId) {
      throw ApiError.badRequest('studySessionId is required to create a conversation');
    }

    const conversation = await AIConversation.create({
      user: userId,
      studySession: studySessionId,
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

    // 1. Save User Message
    const userMessage = await AIMessage.create({
      conversation: conversationId,
      user: userId,
      role: 'user',
      content: content.trim(),
      status: 'completed',
    });

    // 2. Load conversation history in chronological order
    const history = await AIMessage.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .lean();

    // Context Window Limiting: Select up to last 20 messages for context safety
    const boundedHistory = history.slice(-20);

    // 3. System Prompt Definition
    const systemInstruction = 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot. ' +
      'Your mission is to explain complex concepts, teach step-by-step, simplify difficult ideas, ' +
      'provide practical real-world examples, generate quizzes and flashcards when requested, answer questions, ' +
      'and encourage active learning. Format your responses with clear markdown, headings, bullet points, and code blocks where helpful.';

    // 4. Generate AI Response via Gemini Provider
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

    // 5. Save Assistant Message in MongoDB
    const assistantMessage = await AIMessage.create({
      conversation: conversationId,
      user: userId,
      role: 'assistant',
      content: assistantContent,
      status: status,
    });

    // 6. Update conversation lastMessageAt
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // 7. Increment chatCount on parent StudySession
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
