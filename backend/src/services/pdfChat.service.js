import PDFChat from '../models/pdfChat.model.js';
import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import pdfExtractorService from './pdf/pdfExtractor.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

class PDFChatService {
  /**
   * Retrieve PDF-specific chat history
   */
  async getPDFChatHistory({ userId, workspaceId, resourceId }) {
    // Verify study session ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    let pdfChat = await PDFChat.findOne({ workspaceId, resourceId });
    if (!pdfChat) {
      pdfChat = await PDFChat.create({
        workspaceId,
        resourceId,
        messages: []
      });
    }

    return pdfChat;
  }

  /**
   * Send a message to the PDF AI assistant and generate a response grounded only in the PDF text
   */
  async sendPDFChatMessage({ userId, workspaceId, resourceId, message }) {
    // 1. Verify study session ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // 2. Fetch or create PDFChat record
    let pdfChat = await PDFChat.findOne({ workspaceId, resourceId });
    if (!pdfChat) {
      pdfChat = new PDFChat({
        workspaceId,
        resourceId,
        messages: []
      });
    }

    // 3. Extract PDF text content
    let pdfText = '';
    const resource = session.resources?.find(
      r => r.type === 'pdf' && (r.url === resourceId || r.title === resourceId)
    );

    if (resource?.data?.extractedText) {
      pdfText = resource.data.extractedText;
    } else if (session.metadata?.pdf?.extractedText) {
      pdfText = session.metadata.pdf.extractedText;
    } else {
      // Auto extraction trigger fallback
      const pdfMeta = session.metadata?.pdf || {};
      const fileData = pdfMeta.fileData || resource?.data?.fileData;
      if (fileData) {
        logger.info(`[PDF Chat Service] Text is empty. Triggering auto-extraction...`);
        pdfText = await pdfExtractorService.extractTextFromBase64(fileData);
        if (pdfText) {
          if (session.metadata?.pdf) {
            session.metadata.pdf.extractedText = pdfText;
            session.markModified('metadata');
          }
          if (resource) {
            resource.data = { ...(resource.data || {}), extractedText: pdfText };
            session.markModified('resources');
          }
          await session.save();
        }
      }
    }

    if (!pdfText || !pdfText.trim()) {
      throw ApiError.badRequest("I can see that a PDF is open, but its contents haven't been processed yet.");
    }

    // 4. Construct isolated prompt
    const systemInstruction = 
      `You are an AI assistant.\n` +
      `Only answer using the PDF content provided below. ` +
      `If the answer is not contained inside the PDF, say "I couldn't find this information in the uploaded PDF."\n\n` +
      `PDF Content:\n${pdfText.slice(0, 12000)}\n\n`;

    // 5. Structure conversation history
    const apiMessages = [
      ...pdfChat.messages.map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    // 6. Invoke AI Provider
    let aiResponseText = '';
    try {
      const aiResponse = await aiProviderService.generateAIResponse({
        messages: apiMessages,
        systemInstruction
      });
      aiResponseText = aiResponse.text || aiResponse.toString() || '';
    } catch (err) {
      logger.error('[PDF Chat Service] AI generation failed:', err);
      throw ApiError.internal(`AI Assistant failed to generate response: ${err.message}`);
    }

    // 7. Save conversation messages
    pdfChat.messages.push({ role: 'user', content: message, timestamp: new Date() });
    pdfChat.messages.push({ role: 'assistant', content: aiResponseText, timestamp: new Date() });
    await pdfChat.save();

    return {
      success: true,
      userMessage: pdfChat.messages[pdfChat.messages.length - 2],
      assistantMessage: pdfChat.messages[pdfChat.messages.length - 1],
      history: pdfChat.messages
    };
  }
}

export default new PDFChatService();
