import StudySession from '../../models/studySession.model.js';
import AIMessage from '../../models/aiMessage.model.js';
import logger from '../../config/logger.js';

class ContextBuilderService {
  /**
   * Phase 3.2.3B: Context-Aware AI Builder
   * Dynamically constructs context using ONLY the currently active study resource (pdf | youtube | notes).
   * Inactive resources are strictly excluded.
   */
  async buildContext({ userId, studySessionId, conversationId, currentQuery }) {
    // 1. Fetch & Verify Workshop (StudySession) Ownership
    const session = await StudySession.findOne({
      _id: studySessionId,
      user: userId,
    }).lean();

    if (session) {
      logger.info(`[Context Builder] Workshop Loaded: ${session.title}`);
    } else {
      logger.warn(`[Context Builder] Workshop ${studySessionId} not found or unauthorized for user ${userId}`);
    }

    const metadata = session?.metadata || {};
    const activeResourceType = (metadata.activeResourceType || metadata.lastTab || 'pdf').toLowerCase();
    
    logger.info(`[Context Builder] Active Resource Detected: ${activeResourceType.toUpperCase()}`);

    // 2. Base System Persona Prompt
    const baseSystemPrompt = 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot. ' +
      'Your mission is to explain complex concepts, teach step-by-step, simplify difficult ideas, ' +
      'provide practical real-world examples, answer questions, and foster an active learning environment. ' +
      'Format your responses with clean Markdown, clear headings, bullet points, and code blocks where helpful.';

    // 3. Workshop Summary Header (Included for all active resources)
    let workshopSection = '';
    if (session) {
      workshopSection += `\n\n[ACTIVE WORKSHOP CONTEXT]\n`;
      workshopSection += `- Workshop Title: ${session.title}\n`;
      if (session.description) {
        workshopSection += `- Workshop Description: ${session.description}\n`;
      }
      workshopSection += `- Active Resource: ${activeResourceType.toUpperCase()}\n`;
    }

    // 4. Assemble ONLY the Active Resource Context
    let activeResourceSection = '';

    if (activeResourceType === 'pdf') {
      const pdfData = metadata.pdf || metadata.pdfList || (metadata.pdfFilename ? metadata : null);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: PDF]\n`;
      if (pdfData) {
        activeResourceSection += `- Filename: ${pdfData.filename || pdfData.pdfFilename || 'Document.pdf'}\n`;
        if (pdfData.pageCount) activeResourceSection += `- Total Pages: ${pdfData.pageCount}\n`;
        if (pdfData.activePage) activeResourceSection += `- Current Page: ${pdfData.activePage}\n`;
        
        if (pdfData.extractedText && pdfData.extractedText.trim()) {
          activeResourceSection += `- Document Content:\n${pdfData.extractedText.slice(0, 2000)}\n`;
        } else {
          activeResourceSection += `- Status: I can see that a PDF is open, but its contents haven't been processed yet.\n`;
        }
      } else {
        activeResourceSection += `- Status: I can see that a PDF is open, but no PDF file is selected yet.\n`;
      }
    } else if (activeResourceType === 'youtube') {
      const youtubeData = metadata.youtube || metadata.video || (metadata.youtubeUrl ? metadata : null);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: YOUTUBE VIDEO]\n`;
      if (youtubeData) {
        activeResourceSection += `- Video Title: ${youtubeData.title || youtubeData.videoTitle || 'Educational Video'}\n`;
        if (youtubeData.url || youtubeData.youtubeUrl) {
          activeResourceSection += `- Video URL: ${youtubeData.url || youtubeData.youtubeUrl}\n`;
        }
        if (youtubeData.channelName) {
          activeResourceSection += `- Channel: ${youtubeData.channelName}\n`;
        }
        if (youtubeData.transcript && youtubeData.transcript.trim()) {
          activeResourceSection += `- Transcript Snippet:\n${youtubeData.transcript.slice(0, 2000)}\n`;
        } else {
          activeResourceSection += `- Status: I can see the video, but no transcript is available yet.\n`;
        }
      } else {
        activeResourceSection += `- Status: I can see the video tab is open, but no YouTube video link is loaded yet.\n`;
      }
    } else if (activeResourceType === 'notes') {
      const notesData = metadata.notes || metadata.notesList || (metadata.noteTitle || metadata.noteContent ? [metadata] : []);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: NOTES]\n`;
      let hasNoteContent = false;

      if (Array.isArray(notesData) && notesData.length > 0) {
        notesData.forEach((note, i) => {
          const title = note.title || note.noteTitle || 'Untitled Note';
          const content = note.content || note.noteContent || '';
          if (content.trim()) {
            hasNoteContent = true;
            activeResourceSection += `### ${title}\n${content}\n\n`;
          } else {
            activeResourceSection += `### ${title}\n- Status: This note is empty. Add some content and then ask AI questions about it.\n\n`;
          }
        });
      } else if (metadata.notesContent || metadata.noteContent) {
        hasNoteContent = true;
        const title = metadata.noteTitle || 'Untitled Note';
        activeResourceSection += `### ${title}\n${metadata.notesContent || metadata.noteContent}\n\n`;
      }

      if (!hasNoteContent && (!notesData || notesData.length === 0)) {
        activeResourceSection += `### Untitled Note\n- Status: This note is empty. Add some content and then ask AI questions about it.\n`;
      }
    }

    // 5. Instructions for AI Response (Strict single resource focus & no hallucination)
    const contextInstruction = 
      '\n[INSTRUCTIONS FOR AI RESPONSE]\n' +
      `The student is currently working on the active resource: ${activeResourceType.toUpperCase()}. ` +
      'You MUST base your response ONLY on the provided active resource context and conversation history. ' +
      'Do NOT reference or assume any information from inactive resource types. ' +
      'If the active resource content or transcript is unavailable, politely explain to the user (e.g. "I can see that a PDF is open, but its contents haven\'t been processed yet.") without inventing content.';

    // Combine system prompt, workshop header, active resource section, and response instructions
    let fullSystemInstruction = `${baseSystemPrompt}${workshopSection}${activeResourceSection}${contextInstruction}`;

    // 6. Intelligent Trimming
    const MAX_SYSTEM_CHARS = 10000;
    if (fullSystemInstruction.length > MAX_SYSTEM_CHARS) {
      fullSystemInstruction = fullSystemInstruction.slice(0, MAX_SYSTEM_CHARS) + '\n[...Active resource context trimmed to fit token limits...]';
    }

    // 7. Chronological Conversation History (latest 25 messages)
    let history = [];
    if (conversationId) {
      history = await AIMessage.find({ conversation: conversationId })
        .sort({ createdAt: 1 })
        .lean();
    }

    const boundedHistory = history.slice(-25);

    logger.info('[Context Builder] Context Built');

    return {
      systemInstruction: fullSystemInstruction,
      messages: boundedHistory,
      session,
      activeResourceType,
    };
  }
}

export default new ContextBuilderService();
