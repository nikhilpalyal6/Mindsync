import mongoose from 'mongoose';
import StudySession from '../models/studySession.model.js';
import StudyActivity from '../models/studyActivity.model.js';
import ApiError from '../utils/ApiError.js';
import resourceService from './resource.service.js';
import logger from '../config/logger.js';
import PDFChat from '../models/pdfChat.model.js';
import AIConversation from '../models/aiConversation.model.js';
import AIMessage from '../models/aiMessage.model.js';

// Recursive helper to perform deep merges on Mongoose objects/documents
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

async function migrateLegacySession(session) {
  let needsSave = false;
  if (!session.resources) {
    session.resources = [];
    needsSave = true;
  }
  
  if (session.resources.length === 0) {
    const meta = session.metadata || {};
    
    // Migrate YouTube resources
    if (meta.youtube && (meta.youtube.videoUrl || meta.youtube.url)) {
      const url = meta.youtube.videoUrl || meta.youtube.url;
      const alreadyExists = session.resources.some(r => r.type === 'youtube' && r.url === url);
      if (!alreadyExists) {
        session.resources.push({
          _id: `youtube_${session._id.toString()}`,
          type: 'youtube',
          url: url,
          title: meta.youtube.title || 'YouTube Video',
          data: meta.youtube,
          addedAt: session.createdAt || new Date(),
          updatedAt: session.updatedAt || new Date()
        });
        needsSave = true;
      }
    }
    
    // Migrate PDF resources
    if (meta.pdf && (meta.pdf.filename || meta.pdf.pdfFilename || meta.pdf.fileData)) {
      const url = meta.pdf.filename || meta.pdf.pdfFilename || 'Document.pdf';
      const alreadyExists = session.resources.some(r => r.type === 'pdf' && r.url === url);
      if (!alreadyExists) {
        session.resources.push({
          _id: `pdf_${session._id.toString()}`,
          type: 'pdf',
          url: url,
          title: url,
          data: meta.pdf,
          addedAt: session.createdAt || new Date(),
          updatedAt: session.updatedAt || new Date()
        });
        needsSave = true;
      }
    }
    
    // Migrate Notes resources
    if (meta.notes && meta.notes.content) {
      const alreadyExists = session.resources.some(r => r.type === 'notes');
      if (!alreadyExists) {
        session.resources.push({
          _id: `notes_${session._id.toString()}`,
          type: 'notes',
          url: 'default_notes_id',
          title: 'Revision Notes',
          data: meta.notes,
          addedAt: session.createdAt || new Date(),
          updatedAt: session.updatedAt || new Date()
        });
        needsSave = true;
      }
    }
  }

  // Ensure all existing resources have an _id
  session.resources = session.resources.map(r => {
    if (!r._id) {
      const typePrefix = r.type === 'pdf' ? 'pdf_' : r.type === 'youtube' ? 'youtube_' : r.type === 'notes' ? 'notes_' : 'resource_';
      r._id = `${typePrefix}${session._id.toString()}`;
      needsSave = true;
    }
    return r;
  });

  if (needsSave) {
    console.log(`[Migration] Migrating legacy study session resources: "${session.title}"`);
    
    try {
      const KnowledgeDocument = mongoose.model('KnowledgeDocument');
      const KnowledgeJob = mongoose.model('KnowledgeJob');
      const KnowledgeChunk = mongoose.model('KnowledgeChunk');

      for (const r of session.resources) {
        const prefix = `${r.type}_${session._id.toString()}`;
        if (r._id === prefix) {
          const oldResourceIdCandidates = [];
          if (r.type === 'pdf') {
            if (r.url) oldResourceIdCandidates.push(r.url);
          } else if (r.type === 'youtube') {
            if (r.data?.videoId) oldResourceIdCandidates.push(r.data.videoId);
            if (r.url) oldResourceIdCandidates.push(r.url);
          } else if (r.type === 'notes') {
            oldResourceIdCandidates.push('default_notes_id');
          }

          for (const oldId of oldResourceIdCandidates) {
            if (oldId && oldId !== r._id) {
              console.log(`[Migration Reconciliation] Reconciling legacy resourceId: old="${oldId}" -> new="${r._id}"`);
              await KnowledgeDocument.updateMany(
                { workspaceId: session._id, resourceId: oldId },
                { $set: { resourceId: r._id } }
              );
              await KnowledgeJob.updateMany(
                { workspaceId: session._id, resourceId: oldId },
                { $set: { resourceId: r._id } }
              );
              await KnowledgeChunk.updateMany(
                { workspaceId: session._id, resourceId: oldId },
                { $set: { resourceId: r._id } }
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('[Migration Reconciliation] Error updating knowledge documents:', err);
    }

    session.markModified('resources');
    await session.save();
  }
}

class StudyService {
  async logActivity(userId, { session = null, sessionTitle = '', action, details = '' }) {
    try {
      await StudyActivity.create({
        user: userId,
        session: session?._id || session || null,
        sessionTitle: sessionTitle || session?.title || '',
        action,
        details
      });
    } catch (err) {
      console.error('Failed to log study activity:', err.message);
    }
  }

  async getSessions(userId, { search } = {}) {
    console.log('[DEBUG SERVICE] Entering getSessions. User ID:', userId);
    const query = { user: userId };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    console.log('[DEBUG SERVICE] Running StudySession.find with projection for lightweight cards. Query:', JSON.stringify(query));
    
    // Select only lightweight dashboard fields to optimize payload and network bandwidth
    const result = await StudySession.find(query)
      .select('_id title description pinned lastOpened pdfCount youtubeCount notesCount flashcardsCount quizCount chatCount progress thumbnail createdAt updatedAt resources._id resources.type resources.url resources.title resources.addedAt')
      .sort({ pinned: -1, lastOpened: -1 })
      .lean();
      
    console.log('[DEBUG SERVICE] StudySession.find returned successfully. Count:', result?.length);
    return result;
  }

  async saveSessionWithRetry(sessionId, mutateFn) {
    let attempts = 0;
    while (attempts < 10) {
      try {
        const session = await StudySession.findById(sessionId);
        if (!session) {
          throw ApiError.notFound('Study session not found');
        }
        await mutateFn(session);
        return await session.save();
      } catch (error) {
        if (error.name === 'VersionError' || error.message.includes('No matching document found')) {
          attempts++;
          logger.warn(`[Concurrency Retry] VersionError encountered for session ${sessionId}, attempt ${attempts}/10. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 50 * attempts));
        } else {
          throw error;
        }
      }
    }
    throw new ApiError(500, `Failed to save StudySession ${sessionId} after 10 attempts due to concurrent modifications.`);
  }

  async getSessionById(userId, sessionId) {
    console.log('[DEBUG SERVICE] Entering getSessionById. User ID:', userId, 'Session ID:', sessionId);
    const sessionDoc = await StudySession.findOne({ _id: sessionId, user: userId }).lean();
    if (!sessionDoc) {
      throw ApiError.notFound('Study session not found');
    }

    // Check if migration/reconciliation is needed (e.g. empty resources or missing resource IDs)
    const needsMigration = !sessionDoc.resources || sessionDoc.resources.length === 0 || sessionDoc.resources.some(r => !r._id);
    if (needsMigration) {
      console.log('[DEBUG SERVICE] Session requires migration, fetching full document...');
      const fullSession = await StudySession.findOne({ _id: sessionId, user: userId });
      await migrateLegacySession(fullSession);
      return fullSession.toObject();
    }

    // Dynamic population of resources
    const populatedResources = [];
    const KnowledgeDocument = mongoose.model('KnowledgeDocument');
    const KnowledgeChunk = mongoose.model('KnowledgeChunk');
    
    const fs = await import('fs');
    const path = await import('path');
    const fileURLToPath = (await import('url')).fileURLToPath;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const backendDir = path.resolve(__dirname, '../../');

    for (const r of (sessionDoc.resources || [])) {
      const resourceId = r._id?.toString();
      const populatedRes = { ...r, data: { ...(r.data || {}) } };

      if (r.type === 'pdf') {
        // 1. Populate fileData from disk if storagePath is present
        const storagePath = r.data?.storagePath;
        if (storagePath) {
          const absPath = path.resolve(backendDir, storagePath);
          if (fs.existsSync(absPath)) {
            const fileBuffer = fs.readFileSync(absPath);
            const base64Data = fileBuffer.toString('base64');
            populatedRes.data.fileData = `data:${r.data.fileType || 'application/pdf'};base64,${base64Data}`;
          }
        }

        // 2. Populate extractedText and pages from Knowledge base
        const doc = await KnowledgeDocument.findOne({ userId, workspaceId: sessionId, resourceId });
        if (doc) {
          const chunks = await KnowledgeChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 }).lean();
          
          let extractedText = '';
          const pagesMap = new Map();

          for (const chunk of chunks) {
            extractedText += chunk.text + '\n\n';
            
            const pageStart = chunk.metadata?.pageStart;
            const pageEnd = chunk.metadata?.pageEnd;
            if (pageStart !== null && pageStart !== undefined) {
              for (let pNum = pageStart; pNum <= (pageEnd || pageStart); pNum++) {
                if (!pagesMap.has(pNum)) {
                  pagesMap.set(pNum, { pageNumber: pNum, text: '' });
                }
                pagesMap.get(pNum).text += chunk.text + ' ';
              }
            }
          }

          populatedRes.data.extractedText = extractedText.trim();
          populatedRes.data.pages = Array.from(pagesMap.values()).map(p => ({
            pageNumber: p.pageNumber,
            text: p.text.trim(),
            extractionStatus: 'completed'
          }));
          populatedRes.data.pageCount = doc.metadata?.pageCount || populatedRes.data.pages.length;
          populatedRes.data.totalPages = doc.metadata?.pageCount || populatedRes.data.pages.length;
          populatedRes.data.processingStatus = doc.processingStatus === 'READY' ? 'completed' : doc.processingStatus === 'FAILED' ? 'failed' : 'processing';
        }
      } else if (r.type === 'youtube') {
        const doc = await KnowledgeDocument.findOne({ userId, workspaceId: sessionId, resourceId });
        if (doc) {
          const chunks = await KnowledgeChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 }).lean();
          
          let originalTranscript = '';
          let englishTranscript = '';
          const originalTranscriptItems = [];
          const englishTranscriptItems = [];

          for (const chunk of chunks) {
            originalTranscript += chunk.text + '\n';
            
            const chunkItems = chunk.metadata?.transcriptItems || [];
            for (const item of chunkItems) {
              originalTranscriptItems.push({
                text: item.originalText || item.text,
                time: item.time,
                seconds: item.seconds
              });
              if (item.text) {
                englishTranscriptItems.push({
                  text: item.text,
                  time: item.time,
                  seconds: item.seconds
                });
              }
            }
          }

          englishTranscript = englishTranscriptItems.map(i => i.text).join(' ');

          populatedRes.data = {
            ...populatedRes.data,
            videoId: doc.youtubeData?.videoId || populatedRes.data.videoId,
            videoUrl: doc.youtubeData?.videoUrl || populatedRes.data.videoUrl,
            title: doc.title,
            authorName: doc.youtubeData?.authorName,
            authorUrl: doc.youtubeData?.authorUrl,
            thumbnailUrl: doc.youtubeData?.thumbnailUrl,
            duration: doc.youtubeData?.duration,
            publishedDate: doc.youtubeData?.publishedDate,
            chapters: doc.metadata?.chapters || [],
            originalTranscript: originalTranscript.trim(),
            originalTranscriptItems,
            englishTranscript: englishTranscript.trim() || originalTranscript.trim(),
            englishTranscriptItems: englishTranscriptItems.length > 0 ? englishTranscriptItems : originalTranscriptItems,
            transcriptItems: englishTranscriptItems.length > 0 ? englishTranscriptItems : originalTranscriptItems,
            transcript: englishTranscript.trim() || originalTranscript.trim(),
            transcriptLanguage: doc.metadata?.language || 'en',
            translationStatus: 'completed',
            translated: englishTranscriptItems.length > 0,
            hasTranscript: originalTranscriptItems.length > 0,
            processingStatus: doc.processingStatus === 'READY' ? 'completed' : doc.processingStatus === 'FAILED' ? 'failed' : 'processing'
          };
        }
      }

      populatedResources.push(populatedRes);
    }

    sessionDoc.resources = populatedResources;

    // Sync active metadata shortcuts in returned object for frontend state consistency
    if (sessionDoc.metadata) {
      if (sessionDoc.metadata.activeResourceType === 'pdf' && sessionDoc.metadata.pdf) {
        const activePdf = populatedResources.find(r => r.type === 'pdf' && (r.title === sessionDoc.metadata.pdf.filename || r._id?.toString() === sessionDoc.metadata.pdf._id?.toString()));
        if (activePdf) sessionDoc.metadata.pdf = activePdf.data;
      } else if (sessionDoc.metadata.activeResourceType === 'youtube' && sessionDoc.metadata.youtube) {
        const activeYt = populatedResources.find(r => r.type === 'youtube' && (r.url === sessionDoc.metadata.youtube.videoUrl || r._id?.toString() === sessionDoc.metadata.youtube._id?.toString()));
        if (activeYt) sessionDoc.metadata.youtube = activeYt.data;
      } else if (sessionDoc.metadata.activeResourceType === 'notes' && sessionDoc.metadata.notes) {
        const activeNotes = populatedResources.find(r => r.type === 'notes' && (r.url === sessionDoc.metadata.notes.noteId || r._id?.toString() === sessionDoc.metadata.notes._id?.toString()));
        if (activeNotes) sessionDoc.metadata.notes = activeNotes.data;
      }
    }

    return sessionDoc;
  }

  async createSession(userId, { title, description = '', metadata = {} }) {
    const isResourceSession = 
      title?.endsWith('Workspace') || 
      description?.startsWith('PDF Document:') || 
      description?.startsWith('Web resources:') || 
      description?.startsWith('Pasted text content.') || 
      metadata?.pasteUrl || 
      metadata?.pasteText;

    if (isResourceSession) {
      const session = await resourceService.findOrCreateActiveSession(userId, title);

      if (session.title === 'My Study Session') {
        session.title = title;
      }
      if (description) {
        session.description = (session.description && session.description !== 'Auto-created active study session')
          ? `${session.description}\n${description}`
          : description;
      }

      if (metadata.pdf || description?.startsWith('PDF Document:')) {
        const pdfName = metadata.pdf?.filename || description?.replace('PDF Document: ', '') || 'Document.pdf';
        await resourceService.linkResourceToSession(session, {
          type: 'pdf',
          url: pdfName,
          title: pdfName,
          data: metadata.pdf || { filename: pdfName }
        });
      } else if (metadata.youtube || metadata.pasteUrl || description?.startsWith('Web resources:')) {
        const videoUrl = metadata.youtube?.videoUrl || metadata.pasteUrl || description?.replace('Web resources: ', '') || '';
        if (videoUrl) {
          await resourceService.linkResourceToSession(session, {
            type: 'youtube',
            url: videoUrl,
            title: metadata.youtube?.title || 'YouTube Video',
            data: metadata.youtube || { videoUrl }
          });
        }
      } else if (metadata.pasteText || description?.startsWith('Pasted text content.')) {
        const noteContent = metadata.pasteText || '';
        await resourceService.linkResourceToSession(session, {
          type: 'notes',
          url: 'default_notes_id',
          title: 'Lecture Notes',
          data: { content: noteContent }
        });
      }

      const savedSession = await session.save();

      await this.logActivity(userId, {
        session: savedSession._id,
        sessionTitle: savedSession.title,
        action: 'updated',
        details: `Linked resource to active workspace "${savedSession.title}"`
      });

      return savedSession;
    }

    const session = new StudySession({
      user: userId,
      title: title || 'Untitled Study Session',
      description,
      metadata
    });
    const savedSession = await session.save();

    await this.logActivity(userId, {
      session: savedSession._id,
      sessionTitle: savedSession.title,
      action: 'created',
      details: `Created workspace "${savedSession.title}"`
    });

    return savedSession;
  }

  async updateSession(userId, sessionId, updates) {
    const updatedSession = await this.saveSessionWithRetry(sessionId, async (session) => {
      if (session.user.toString() !== userId.toString()) {
        throw ApiError.forbidden('Unauthorized to update this session');
      }

      const allowedUpdates = [
        'title', 'description', 'pinned', 'lastOpened', 'metadata',
        'pdfCount', 'youtubeCount', 'notesCount', 'flashcardsCount', 'quizCount', 'chatCount'
      ];
      
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          if (field === 'metadata') {
            session.metadata = deepMerge(session.metadata || {}, updates.metadata || {});
            session.markModified('metadata');
          } else {
            session[field] = updates[field];
          }
        }
      }

      if (updates.metadata) {
        const meta = updates.metadata;
        if (meta.pdf && (meta.pdf.filename || meta.pdf.pdfFilename)) {
          await resourceService.linkResourceToSession(session, {
            type: 'pdf',
            url: meta.pdf.pdfFilename || meta.pdf.filename,
            title: meta.pdf.filename || meta.pdf.pdfFilename || 'PDF Document',
            data: meta.pdf
          });
        }
        if (meta.youtube && meta.youtube.videoUrl) {
          await resourceService.linkResourceToSession(session, {
            type: 'youtube',
            url: meta.youtube.videoUrl,
            title: meta.youtube.title || 'YouTube Video',
            data: meta.youtube
          });
        }
        if (meta.notes && meta.notes.noteId) {
          await resourceService.linkResourceToSession(session, {
            type: 'notes',
            url: meta.notes.noteId,
            title: meta.notes.title || 'Note',
            data: meta.notes
          });
        } else if (meta.notesContent || meta.noteContent || (meta.notes && (meta.notes.content || meta.notes.notesContent))) {
          await resourceService.linkResourceToSession(session, {
            type: 'notes',
            url: 'default_notes_id',
            title: meta.notes?.title || 'Lecture Notes',
            data: meta.notes || { content: meta.notesContent || meta.noteContent }
          });
        }
      }
    });

    return await this.getSessionById(userId, sessionId);
  }

  async deleteSession(userId, sessionId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const title = session.title;
    await StudySession.deleteOne({ _id: sessionId });

    try {
      const KnowledgeDocument = (await import('../models/knowledgeDocument.model.js')).default;
      const KnowledgeChunk = (await import('../models/knowledgeChunk.model.js')).default;
      const KnowledgeJob = (await import('../models/knowledgeJob.model.js')).default;
      await KnowledgeDocument.deleteMany({ workspaceId: sessionId });
      await KnowledgeChunk.deleteMany({ workspaceId: sessionId });
      await KnowledgeJob.deleteMany({ workspaceId: sessionId });

      const retrievalService = (await import('../knowledge/services/retrieval.service.js')).default;
      retrievalService.invalidateWorkspaceCache(sessionId);
    } catch (keErr) {
      logger.error(`[Workspace Cleanup Error] Failed to cleanup knowledge engine data for session ${sessionId}: ${keErr.message}`);
    }

    await this.logActivity(userId, {
      session: null,
      sessionTitle: title,
      action: 'deleted',
      details: `Deleted workspace "${title}"`
    });

    return { id: sessionId };
  }

  async getResources(userId, sessionId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId })
      .select('-metadata -resources.data.fileData -resources.data.originalTranscript -resources.data.originalTranscriptItems -resources.data.englishTranscript -resources.data.englishTranscriptItems -resources.data.transcriptItems -resources.data.transcript')
      .lean();
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }
    return session.resources || [];
  }

  async addResource(userId, sessionId, { type, url, title, data }) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const existingRes = session.resources?.find(r => r.type === type && r.url === url);
    await resourceService.linkResourceToSession(session, { type, url, title, data });

    if (existingRes) {
      const updatedRes = session.resources.find(r => r._id?.toString() === existingRes._id?.toString());
      const updateQuery = {
        'resources.$.title': updatedRes.title,
        'resources.$.data': updatedRes.data,
        'resources.$.updatedAt': new Date(),
        metadata: session.metadata,
        videoCount: session.videoCount,
        youtubeCount: session.youtubeCount,
        pdfCount: session.pdfCount,
        notesCount: session.notesCount,
        resourceCount: session.resourceCount
      };

      await StudySession.updateOne(
        { _id: sessionId, 'resources._id': existingRes._id },
        { $set: updateQuery }
      );
    } else {
      const newRes = session.resources[session.resources.length - 1];
      const setQuery = {
        metadata: session.metadata,
        videoCount: session.videoCount,
        youtubeCount: session.youtubeCount,
        pdfCount: session.pdfCount,
        notesCount: session.notesCount,
        resourceCount: session.resourceCount
      };

      await StudySession.updateOne(
        { _id: sessionId },
        {
          $push: { resources: newRes },
          $set: setQuery
        }
      );
    }

    await this.logActivity(userId, {
      session: sessionId,
      sessionTitle: session.title,
      action: 'updated',
      details: `Linked resource to workspace "${session.title}"`
    });

    return await this.getSessionById(userId, sessionId);
  }

  async renameResource(userId, sessionId, resourceId, newTitle) {
    if (!newTitle || !newTitle.trim()) {
      throw ApiError.badRequest('New title is required');
    }

    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const resourceIndex = session.resources.findIndex(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId || r.title === resourceId
    );

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in this study session');
    }

    const resource = session.resources[resourceIndex];
    const type = resource.type;

    const updateQuery = {
      'resources.$.title': newTitle.trim(),
      'resources.$.updatedAt': new Date()
    };

    if (session.metadata) {
      if (type === 'pdf' && session.metadata.pdf) {
        updateQuery['metadata.pdf.filename'] = newTitle.trim();
      } else if (type === 'youtube' && session.metadata.youtube) {
        updateQuery['metadata.youtube.title'] = newTitle.trim();
      } else if (type === 'notes' && session.metadata.notes) {
        updateQuery['metadata.notes.title'] = newTitle.trim();
      }
    }

    await StudySession.updateOne(
      { _id: sessionId, 'resources._id': resource._id },
      { $set: updateQuery }
    );

    return await this.getSessionById(userId, sessionId);
  }

  async replaceResource(userId, sessionId, resourceId, { url, title, data }) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const resourceIndex = session.resources.findIndex(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId || r.title === resourceId
    );

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource to replace not found in this study session');
    }

    const oldResource = session.resources[resourceIndex];

    await resourceService.linkResourceToSession(session, {
      type: oldResource.type,
      url,
      title: title || oldResource.title,
      data: {
        ...data,
        processingStatus: 'completed'
      }
    });

    const updatedRes = session.resources.find(r => r._id?.toString() === resourceId);

    if (updatedRes) {
      const updateQuery = {
        'resources.$.url': url,
        'resources.$.title': title || oldResource.title,
        'resources.$.data': updatedRes.data,
        'resources.$.updatedAt': new Date(),
        metadata: session.metadata,
        videoCount: session.videoCount,
        youtubeCount: session.youtubeCount,
        pdfCount: session.pdfCount,
        notesCount: session.notesCount,
        resourceCount: session.resourceCount
      };

      await StudySession.updateOne(
        { _id: sessionId, 'resources._id': resourceId },
        { $set: updateQuery }
      );
    }

    try {
      await PDFChat.deleteMany({ workspaceId: sessionId, resourceId: resourceId });
      const conversations = await AIConversation.find({ studySession: sessionId, resourceId: resourceId }).lean();
      const conversationIds = conversations.map(c => c._id);
      if (conversationIds.length > 0) {
        await AIMessage.deleteMany({ conversation: { $in: conversationIds } });
        await AIConversation.deleteMany({ _id: { $in: conversationIds } });
      }
    } catch (err) {
      logger.error(`[Resource Replace Cleanup Error] Failed to cleanup sub-data for replaced resource ${resourceId}: ${err.message}`);
    }

    return await this.getSessionById(userId, sessionId);
  }

  async deleteResource(userId, sessionId, resourceId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const resourceIndex = session.resources.findIndex(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId || r.title === resourceId
    );

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in this study session');
    }

    const resource = session.resources[resourceIndex];
    const type = resource.type;

    session.resources.splice(resourceIndex, 1);

    if (session.metadata) {
      const typeMap = { pdf: 'pdf', youtube: 'youtube', notes: 'notes' };
      const activeType = typeMap[resource.type] || 'pdf';
      if (session.metadata.activeResourceType === activeType || session.metadata.lastTab === activeType) {
        session.metadata.activeResourceType = '';
        session.metadata.lastTab = '';
        if (activeType === 'pdf') session.metadata.pdf = null;
        else if (activeType === 'youtube') session.metadata.youtube = null;
        else if (activeType === 'notes') session.metadata.notes = null;
      }
    }

    const videoCount = session.resources.filter(r => r.type === 'youtube').length;
    const pdfCount = session.resources.filter(r => r.type === 'pdf').length;
    const notesCount = session.resources.filter(r => r.type === 'notes').length;
    const resourceCount = session.resources.length;

    await StudySession.updateOne(
      { _id: sessionId },
      {
        $set: {
          resources: session.resources,
          metadata: session.metadata,
          videoCount,
          youtubeCount: videoCount,
          pdfCount,
          notesCount,
          resourceCount
        }
      }
    );

    try {
      await PDFChat.deleteMany({ workspaceId: sessionId, resourceId });
      const conversations = await AIConversation.find({ studySession: sessionId, resourceId }).lean();
      const conversationIds = conversations.map(c => c._id);
      if (conversationIds.length > 0) {
        await AIMessage.deleteMany({ conversation: { $in: conversationIds } });
        await AIConversation.deleteMany({ _id: { $in: conversationIds } });
      }

      const KnowledgeDocument = (await import('../models/knowledgeDocument.model.js')).default;
      const KnowledgeChunk = (await import('../models/knowledgeChunk.model.js')).default;
      const KnowledgeJob = (await import('../models/knowledgeJob.model.js')).default;
      await KnowledgeDocument.deleteMany({ resourceId });
      await KnowledgeChunk.deleteMany({ resourceId });
      await KnowledgeJob.deleteMany({ resourceId });

      const retrievalService = (await import('../knowledge/services/retrieval.service.js')).default;
      retrievalService.invalidateWorkspaceCache(sessionId);
    } catch (err) {
      logger.error(`[Resource Cleanup Error] Failed to cleanup sub-data for resource ${resourceId}: ${err.message}`);
    }

    await this.logActivity(userId, {
      session: sessionId,
      sessionTitle: session.title,
      action: 'deleted_resource',
      details: `Deleted ${resource.type} resource "${resource.title}"`
    });

    return await this.getSessionById(userId, sessionId);
  }

  async getActivities(userId) {
    return await StudyActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}

export default new StudyService();
