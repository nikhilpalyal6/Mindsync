import StudySession from '../../models/studySession.model.js';
import aiProviderService from '../ai/aiProvider.service.js';
import summaryPromptService from './summaryPrompt.service.js';
import summaryFormatterService from './summaryFormatter.service.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

class SummaryService {
  /**
   * Phase 3.2.4: Generate or retrieve cached AI summary for the active resource
   */
  async generateSummary({ userId, sessionId, summaryType = 'quick', forceRefresh = false }) {
    logger.info(`[Summary Engine] Summary Requested: Workshop ${sessionId} (Type: ${summaryType}, Refresh: ${forceRefresh})`);

    // 1. Fetch & verify workshop ownership
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const metadata = session.metadata || {};
    const activeResourceType = (metadata.activeResourceType || metadata.lastTab || 'pdf').toLowerCase();
    const typeKey = (summaryType || 'quick').toLowerCase();

    // Initialize nested summary metadata structure
    if (!metadata.summaries) {
      metadata.summaries = {};
    }
    if (!metadata.summaries[activeResourceType]) {
      metadata.summaries[activeResourceType] = {};
    }

    // 2. Check for cached summary
    const existingSummary = metadata.summaries[activeResourceType][typeKey];
    if (existingSummary && existingSummary.summaryContent && !forceRefresh) {
      logger.info(`[Summary Engine] Summary Cached: Returning saved ${activeResourceType.toUpperCase()} summary (${typeKey})`);
      logger.info(`[Summary Engine] Summary Loaded`);
      return {
        success: true,
        cached: true,
        resourceType: activeResourceType,
        summaryType: typeKey,
        summaryContent: existingSummary.summaryContent,
        generatedAt: existingSummary.generatedAt,
      };
    }

    if (forceRefresh && existingSummary) {
      logger.info(`[Summary Engine] Summary Refreshed: Regenerating ${activeResourceType.toUpperCase()} summary`);
    }

    // 3. Extract active resource content
    let resourceData = {};
    if (activeResourceType === 'pdf') {
      resourceData = metadata.pdf || metadata.pdfList || (metadata.pdfFilename ? metadata : {});
    } else if (activeResourceType === 'youtube') {
      resourceData = metadata.youtube || metadata.video || (metadata.youtubeUrl ? metadata : {});
    } else if (activeResourceType === 'notes') {
      const notesList = metadata.notes || metadata.notesList || [];
      if (Array.isArray(notesList) && notesList.length > 0) {
        resourceData = {
          title: notesList[0].title || notesList[0].noteTitle || 'Untitled Note',
          content: notesList.map(n => `### ${n.title || 'Note'}\n${n.content || ''}`).join('\n\n')
        };
      } else {
        resourceData = {
          title: metadata.noteTitle || 'Untitled Note',
          content: metadata.notesContent || metadata.noteContent || ''
        };
      }
    }

    // 4. Build prompt
    const promptResult = summaryPromptService.buildPrompt({
      resourceType: activeResourceType,
      resourceData,
      summaryType: typeKey,
      sessionTitle: session.title
    });

    if (promptResult.isUnavailable) {
      const fallbackContent = summaryFormatterService.formatFallbackMessage(promptResult.message);
      return {
        success: true,
        isUnavailable: true,
        resourceType: activeResourceType,
        summaryType: typeKey,
        summaryContent: fallbackContent,
        generatedAt: new Date().toISOString()
      };
    }

    // 5. Invoke AI Provider (Groq / Gemini)
    let rawResponse = '';
    try {
      rawResponse = await aiProviderService.generateAIResponse({
        messages: promptResult.messages,
        systemInstruction: promptResult.systemInstruction
      });
    } catch (err) {
      logger.error(`[Summary Engine] AI Provider call failed: ${err.message}`);
      throw ApiError.internal(`Failed to generate AI summary: ${err.message}`);
    }

    // 6. Format response & persist to MongoDB
    const formattedContent = summaryFormatterService.formatSummary(rawResponse, typeKey);
    const summaryRecord = {
      summaryType: typeKey,
      resourceType: activeResourceType,
      summaryContent: formattedContent,
      generatedAt: new Date().toISOString()
    };

    metadata.summaries[activeResourceType][typeKey] = summaryRecord;
    session.metadata = metadata;
    session.markModified('metadata');
    await session.save();

    logger.info(`[Summary Engine] Summary Generated: ${activeResourceType.toUpperCase()} (${typeKey}) saved to MongoDB`);

    return {
      success: true,
      cached: false,
      resourceType: activeResourceType,
      summaryType: typeKey,
      summaryContent: formattedContent,
      generatedAt: summaryRecord.generatedAt
    };
  }

  /**
   * Retrieve saved summary from MongoDB metadata
   */
  async getSummary({ userId, sessionId, resourceType, summaryType = 'quick' }) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId }).lean();
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const metadata = session.metadata || {};
    const resType = (resourceType || metadata.activeResourceType || metadata.lastTab || 'pdf').toLowerCase();
    const typeKey = (summaryType || 'quick').toLowerCase();

    const summaryRecord = metadata.summaries?.[resType]?.[typeKey];
    if (summaryRecord) {
      logger.info(`[Summary Engine] Summary Loaded: Returning saved ${resType.toUpperCase()} summary from MongoDB`);
      return {
        success: true,
        found: true,
        resourceType: resType,
        summaryType: typeKey,
        summaryContent: summaryRecord.summaryContent,
        generatedAt: summaryRecord.generatedAt
      };
    }

    return {
      success: true,
      found: false,
      resourceType: resType,
      summaryType: typeKey,
      summaryContent: null
    };
  }
}

export default new SummaryService();
