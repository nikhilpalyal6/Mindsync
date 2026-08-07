import StudySession from '../../models/studySession.model.js';
import AIMessage from '../../models/aiMessage.model.js';
import mongoose from 'mongoose';
import logger from '../../config/logger.js';

class ContextBuilderService {
  /**
   * Phase 3.2.3 Foundation: Context-Aware AI Builder
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
      logger.info(`[Workshop Loaded] Workshop: ${session.title} (ID: ${session._id})`);
    } else {
      logger.warn(`[Context Builder] Workshop ${studySessionId} not found or unauthorized for user ${userId}`);
    }

    const metadata = session?.metadata || {};
    let activeResourceType = (metadata.activeResourceType || metadata.lastTab || 'pdf').toLowerCase();
    let activeResource = null;

    // Resolve resource type and resource object directly from the active conversation's resourceId if available
    if (conversationId) {
      try {
        const AIConversation = mongoose.model('AIConversation');
        const conversation = await AIConversation.findById(conversationId).lean();
        if (conversation && conversation.resourceId) {
          // Find resource in study session resources list
          const foundRes = session?.resources?.find(r => 
            (r._id && r._id.toString() === conversation.resourceId) || 
            r.url === conversation.resourceId || 
            r.title === conversation.resourceId
          );
          if (foundRes) {
            activeResource = foundRes;
            activeResourceType = foundRes.type.toLowerCase();
            logger.info(`[Context Builder] Resolved active resource type "${activeResourceType}" from conversation resourceId "${conversation.resourceId}"`);
          }
        }
      } catch (err) {
        logger.error(`[Context Builder] Error resolving active resource from conversation: ${err.message}`);
      }
    }

    logger.info(`[Resource Context] Active Pipeline: ${activeResourceType.toUpperCase()}`);

    // 2. Base System Persona Prompt depending on resource type
    let baseSystemPrompt = '';
    if (activeResourceType === 'pdf') {
      baseSystemPrompt = 
        'You are MindSync PDF AI.\n' +
        'The active resource is a PDF document.\n' +
        'Only answer using the indexed PDF.\n' +
        'Never mention YouTube.\n' +
        'Never reference transcripts.\n' +
        'If the answer is not inside the PDF, clearly say it isn\'t found.\n' +
        'Format your responses with clean Markdown, clear headings, bullet points, and code blocks where helpful.';
    } else if (activeResourceType === 'youtube') {
      baseSystemPrompt = 
        'You are MindSync Video AI.\n' +
        'The active resource is a YouTube video.\n' +
        'Only answer using the transcript.\n' +
        'Never reference PDFs.\n' +
        'Format your responses with clean Markdown, clear headings, bullet points, and code blocks where helpful.';
    } else {
      baseSystemPrompt = 
        'You are MindSync Notes AI.\n' +
        'The active resource is a Markdown Notes document.\n' +
        'Only answer using the Notes.\n' +
        'Never reference PDFs or YouTube.\n' +
        'Format your responses with clean Markdown, clear headings, bullet points, and code blocks where helpful.';
    }

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
      const pdfData = activeResource?.data || metadata.pdf || metadata.pdfList || (metadata.pdfFilename ? metadata : null);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: PDF DOCUMENT]\n`;
      if (pdfData) {
        activeResourceSection += `- Filename: ${pdfData.filename || pdfData.pdfFilename || 'Document.pdf'}\n`;
        if (pdfData.pageCount) activeResourceSection += `- Total Pages: ${pdfData.pageCount}\n`;
        if (pdfData.pageNumber || pdfData.activePage) activeResourceSection += `- Current Page: ${pdfData.pageNumber || pdfData.activePage}\n`;
        
        const text = pdfData.extractedText || '';
        if (text.trim()) {
          activeResourceSection += `- Extracted PDF Content:\n${text.slice(0, 6000)}\n`;
          logger.info(`[PDF Extracted] Using ${text.length} chars of PDF text for AI context`);
        } else {
          activeResourceSection += `- Status: I can see that a PDF is open, but its contents haven't been processed yet.\n`;
        }
      } else {
        activeResourceSection += `- Status: I can see that a PDF is open, but no PDF file is selected yet.\n`;
      }
    } else if (activeResourceType === 'youtube') {
      const youtubeData = activeResource?.data || metadata.youtube || metadata.video || (metadata.youtubeUrl ? metadata : null);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: YOUTUBE VIDEO]\n`;
      if (youtubeData) {
        activeResourceSection += `- Video Title: ${youtubeData.title || youtubeData.videoTitle || 'Educational Video'}\n`;
        if (youtubeData.url || youtubeData.youtubeUrl) {
          activeResourceSection += `- Video URL: ${youtubeData.url || youtubeData.youtubeUrl}\n`;
        }
        if (youtubeData.channelName || youtubeData.channel) {
          activeResourceSection += `- Channel: ${youtubeData.channelName || youtubeData.channel}\n`;
        }
        if (youtubeData.chapters && Array.isArray(youtubeData.chapters) && youtubeData.chapters.length > 0) {
          activeResourceSection += `- Video Chapters:\n${youtubeData.chapters.map(c => `  - ${c.time || ''} ${c.title || ''}`).join('\n')}\n`;
        }
        const activeTranscript = youtubeData.englishTranscript || youtubeData.transcript || youtubeData.originalTranscript;
        if (activeTranscript && activeTranscript.trim()) {
          activeResourceSection += `- Video Transcript:\n${activeTranscript.slice(0, 6000)}\n`;
          logger.info(`[DEBUG] Context Builder loaded transcript. Length: ${activeTranscript.length} (Title: ${youtubeData.title})`);
        } else {
          activeResourceSection += `- Status: I can see the video, but no transcript is available yet.\n`;
          logger.warn(`[DEBUG] Context Builder found no transcript for YouTube resource (${youtubeData?.title || 'No Title'})`);
        }
      } else {
        activeResourceSection += `- Status: I can see the video tab is open, but no YouTube video link is loaded yet.\n`;
      }
    } else if (activeResourceType === 'notes') {
      const notesData = activeResource?.data || metadata.notes || metadata.notesList || (metadata.noteTitle || metadata.noteContent ? [metadata] : []);
      activeResourceSection += `\n[CURRENT ACTIVE RESOURCE: WORKSHOP NOTES]\n`;
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
      'If the active resource content or transcript is unavailable, politely explain to the user without inventing content.';

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

    return {
      systemInstruction: fullSystemInstruction,
      messages: boundedHistory,
      session,
      activeResourceType,
    };
  }
}

export default new ContextBuilderService();
