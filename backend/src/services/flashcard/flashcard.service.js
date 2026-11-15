import StudySession from '../../models/studySession.model.js';
import aiProviderService from '../ai/aiProvider.service.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import crypto from 'crypto';
import pdfExtractorService from '../pdf/pdfExtractor.service.js';

class FlashcardService {
  /**
   * Extract content from the resource in the study session.
   */
  async getResourceContent(session, resourceId, resourceType) {
    let content = '';
    let title = '';

    // 1. Find resource in resources array
    if (session.resources && Array.isArray(session.resources)) {
      const res = session.resources.find(
        r => r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId || (r.type === resourceType && (r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId))
      );
      if (res) {
        title = res.title || '';
        if (res.data) {
          if (res.type === 'pdf') {
            content = res.data.extractedText || (res.data.pages ? res.data.pages.map(p => p.text).filter(Boolean).join('\n\n') : '') || '';
          } else if (res.type === 'youtube') {
            content = res.data.englishTranscript || res.data.transcript || res.data.originalTranscript || (res.data.transcriptItems ? res.data.transcriptItems.map(t => t.text).join(' ') : '') || '';
          } else if (res.type === 'notes') {
            content = res.data.content || res.data.notesContent || res.data.noteContent || '';
          }
        }
      }
    }

    // 2. Fallback to session.metadata if resource content not found in resources array
    if (!content && session.metadata) {
      const meta = session.metadata;
      if (resourceType === 'pdf') {
        const pdf = meta.pdf || {};
        content = pdf.extractedText || (pdf.pages ? pdf.pages.map(p => p.text).filter(Boolean).join('\n\n') : '') || meta.extractedText || '';
        title = pdf.filename || pdf.pdfFilename || '';
      } else if (resourceType === 'youtube') {
        const yt = meta.youtube || meta.video || {};
        content = yt.englishTranscript || yt.transcript || yt.originalTranscript || (yt.transcriptItems ? yt.transcriptItems.map(t => t.text).join(' ') : '') || '';
        title = yt.title || yt.videoTitle || '';
      } else if (resourceType === 'notes') {
        const notes = meta.notes || {};
        if (notes.noteId === resourceId || notes.id === resourceId || resourceId === 'default_notes_id') {
          content = notes.content || notes.notesContent || notes.noteContent || meta.notesContent || meta.noteContent || '';
          title = notes.title || meta.noteTitle || 'Untitled Note';
        }
        if (!content && Array.isArray(meta.notesList)) {
          const note = meta.notesList.find(n => n.noteId === resourceId || n.title === resourceId);
          if (note) {
            content = note.content || '';
            title = note.title || '';
          }
        }
      }
    }

    // 3. Fallback to KnowledgeChunk in case heavy text was moved to chunks
    if (!content) {
      try {
        const KnowledgeChunk = (await import('../../models/knowledgeChunk.model.js')).default;
        const chunks = await KnowledgeChunk.find({ workspaceId: session._id, resourceId }).sort({ chunkIndex: 1 });
        if (chunks.length > 0) {
          content = chunks.map(c => c.text).join('\n\n');
        }
      } catch (_) {}
    }

    return { content, title };
  }

  /**
   * Generate AI flashcards or retrieve cached cards.
   */
  async generateFlashcards({ userId, studySessionId, resourceId, resourceType, forceRegenerate = false }) {
    logger.info(`[Flashcard Engine] Request: Session ${studySessionId}, Resource ${resourceId} (Type: ${resourceType}, Force: ${forceRegenerate})`);

    // 1. Fetch Study Session
    const session = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // Initialize resources array if missing
    if (!session.resources) {
      session.resources = [];
    }

    // 2. Locate Resource index in session.resources
    let resourceIndex = session.resources.findIndex(
      r => r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId || (r.type === resourceType && (r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId))
    );

    // If resource is not in array but metadata has it, link it
    if (resourceIndex === -1 && session.metadata) {
      let title = 'Resource';
      let data = {};
      if (resourceType === 'pdf' && session.metadata.pdf) {
        title = session.metadata.pdf.filename || 'PDF Document';
        data = session.metadata.pdf;
      } else if (resourceType === 'youtube' && session.metadata.youtube) {
        title = session.metadata.youtube.title || 'YouTube Video';
        data = session.metadata.youtube;
      } else if (resourceType === 'notes' && session.metadata.notes) {
        title = session.metadata.notes.title || 'Notes';
        data = session.metadata.notes;
      }

      session.resources.push({
        type: resourceType,
        url: resourceId,
        title,
        data,
        addedAt: new Date(),
        updatedAt: new Date()
      });
      resourceIndex = session.resources.length - 1;
    }

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in study session');
    }

    const resource = session.resources[resourceIndex];

    // 3. Check Cache
    if (!forceRegenerate && resource.ai?.flashcards?.cards && resource.ai.flashcards.cards.length > 0) {
      logger.info(`[Flashcard Engine] Cache Hit: Returning cached flashcards for resource ${resourceId}`);
      return {
        success: true,
        cached: true,
        flashcards: resource.ai.flashcards.cards,
        metadata: {
          generatedAt: resource.ai.flashcards.generatedAt,
          aiModel: resource.ai.flashcards.aiModel,
          version: resource.ai.flashcards.version
        }
      };
    }

    // 4. Extract content
    let { content, title } = await this.getResourceContent(session, resourceId, resourceType);
    if (resourceType === 'pdf' && (!content || !content.trim())) {
      const pdfMeta = session.metadata?.pdf || {};
      const fileData = pdfMeta.fileData || (session.resources?.find(r => r.type === 'pdf')?.data?.fileData);
      if (fileData) {
        logger.info(`[Flashcard Engine] Auto-extracting empty PDF text...`);
        const extractedText = await pdfExtractorService.extractTextFromBase64(fileData);
        if (extractedText) {
          if (session.metadata?.pdf) {
            session.metadata.pdf.extractedText = extractedText;
            session.markModified('metadata');
          }
          if (session.resources) {
            session.resources.forEach(r => {
              if (r.type === 'pdf') {
                if (!r.data) r.data = {};
                r.data.extractedText = extractedText;
              }
            });
            session.markModified('resources');
          }
          await session.save();
          content = extractedText;
          title = pdfMeta.filename || 'PDF Document';
        }
      }
    }

    if (!content || !content.trim()) {
      throw ApiError.badRequest('No learning material found for this resource. Please make sure the content has been processed or transcript extracted.');
    }

    // 5. Construct AI Instruction & Prompt
    const systemInstruction = 
      `You are an expert AI Flashcard Generator. Your task is to generate high-quality educational flashcards based on the provided learning material.
      
      Guidelines for generating flashcards:
      1. Generate enough flashcards to cover every important concept in the provided text.
      2. You must generate a minimum of 10 flashcards and a maximum of 40 flashcards.
      3. Ensure there are no duplicate flashcards or duplicate concepts.
      4. Questions must be concise and direct. For example, use "What is Binary Search?" instead of "Can you explain Binary Search in detail?".
      5. Answers must be precise, informative, and have a maximum length of 80 words.
      6. Assign a difficulty level to each card: "Easy", "Medium", or "Hard".
      7. Identify the specific sub-topic or theme for each card and set it in the "topic" field.
      8. Output your response STRICTLY as a raw JSON array of objects. Do not include markdown code block formatting (like \`\`\`json), no preamble, and no explanation.

      JSON Format:
      [
         {
            "question": "Concise question",
            "answer": "Clear, informative answer (max 80 words)",
            "difficulty": "Easy",
            "topic": "Concept Topic"
         }
      ]`;

    const userMessage = `Please generate educational flashcards covering the key concepts in the following content:\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 12000)}`;

    const messages = [{ role: 'user', content: userMessage }];

    // 6. Invoke AI Provider
    let rawResponse = '';
    try {
      rawResponse = await aiProviderService.generateAIResponse({
        messages,
        systemInstruction
      });
    } catch (err) {
      logger.error(`[Flashcard Engine] AI Provider failed: ${err.message}`);
      throw ApiError.internal(`Failed to generate flashcards via AI Service: ${err.message}`);
    }

    // 7. Parse and clean raw JSON response
    let rawJson = rawResponse.trim();
    if (rawJson.startsWith('```json')) {
      rawJson = rawJson.substring(7);
    } else if (rawJson.startsWith('```')) {
      rawJson = rawJson.substring(3);
    }
    if (rawJson.endsWith('```')) {
      rawJson = rawJson.substring(0, rawJson.length - 3);
    }
    rawJson = rawJson.trim();

    let cardsList = [];
    try {
      cardsList = JSON.parse(rawJson);
    } catch (parseErr) {
      logger.error(`[Flashcard Engine] JSON Parse failed. Raw response snippet: ${rawJson.substring(0, 200)}`);
      throw ApiError.internal('AI response could not be parsed into valid JSON cards. Please try again.');
    }

    if (!Array.isArray(cardsList)) {
      throw ApiError.internal('AI did not return a valid array of cards.');
    }

    // 8. Attach IDs and Model Metadata
    const generatedAt = new Date().toISOString();
    const aiModel = aiProviderService.getModel();
    const version = '1.0';

    const formattedCards = cardsList.map(card => ({
      id: crypto.randomUUID(),
      question: card.question || 'Untitled Question',
      answer: card.answer || '',
      difficulty: card.difficulty || 'Medium',
      topic: card.topic || 'General',
      bookmarked: false,
      reviewCount: 0,
      createdAt: generatedAt
    }));

    // 9. Persist into session.resources under resource.ai.flashcards
    if (!resource.ai) {
      resource.ai = {};
    }
    resource.ai.flashcards = {
      cards: formattedCards,
      generatedAt,
      aiModel,
      version
    };

    session.resources[resourceIndex] = resource;

    // Update overall flashcardsCount
    let totalCount = 0;
    session.resources.forEach(r => {
      if (r.ai?.flashcards?.cards) {
        totalCount += r.ai.flashcards.cards.length;
      }
    });
    session.flashcardsCount = totalCount;

    session.markModified('resources');
    await session.save();

    logger.info(`[Flashcard Engine] Saved ${formattedCards.length} flashcards to database for resource ${resourceId}`);

    return {
      success: true,
      cached: false,
      flashcards: formattedCards,
      metadata: {
        generatedAt,
        aiModel,
        version
      }
    };
  }

  /**
   * Retrieve cached flashcards or return empty list.
   */
  async getFlashcards({ userId, studySessionId, resourceId }) {
    logger.info(`[Flashcard Engine] Get Request: Session ${studySessionId}, Resource ${resourceId}`);

    let session = null;
    if (studySessionId) {
      session = await StudySession.findOne({ _id: studySessionId, user: userId }).lean();
    } else {
      session = await StudySession.findOne({ user: userId, 'resources.url': resourceId }).lean();
    }

    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // Locate Resource
    const resource = session.resources?.find(r => r.url === resourceId);
    if (resource?.ai?.flashcards?.cards) {
      return {
        success: true,
        found: true,
        flashcards: resource.ai.flashcards.cards,
        metadata: {
          generatedAt: resource.ai.flashcards.generatedAt,
          aiModel: resource.ai.flashcards.aiModel,
          version: resource.ai.flashcards.version
        }
      };
    }

    return {
      success: true,
      found: false,
      flashcards: [],
      metadata: null
    };
  }

  /**
   * Update flashcard bookmark and reviewCount status in-place.
   */
  async updateFlashcardState({ userId, studySessionId, resourceId, cardId, bookmarked, incrementReview }) {
    logger.info(`[Flashcard Engine] Update Request: Card ${cardId} in Resource ${resourceId}`);

    let session = null;
    if (studySessionId) {
      session = await StudySession.findOne({ _id: studySessionId, user: userId });
    } else {
      session = await StudySession.findOne({ user: userId, 'resources.url': resourceId });
    }

    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const resourceIndex = session.resources?.findIndex(r => r.url === resourceId);
    if (resourceIndex === -1 || resourceIndex === undefined) {
      throw ApiError.notFound('Resource not found in session');
    }

    const resource = session.resources[resourceIndex];
    const cards = resource.ai?.flashcards?.cards || [];

    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      throw ApiError.notFound('Flashcard not found');
    }

    if (bookmarked !== undefined) {
      cards[cardIndex].bookmarked = Boolean(bookmarked);
    }

    if (incrementReview) {
      cards[cardIndex].reviewCount = (cards[cardIndex].reviewCount || 0) + 1;
    }

    resource.ai.flashcards.cards = cards;
    session.resources[resourceIndex] = resource;

    session.markModified('resources');
    await session.save();

    return {
      success: true,
      card: cards[cardIndex]
    };
  }
}

export default new FlashcardService();
