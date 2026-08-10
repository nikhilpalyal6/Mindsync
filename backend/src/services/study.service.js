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
          _id: new mongoose.Types.ObjectId().toString(),
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
          _id: new mongoose.Types.ObjectId().toString(),
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
          _id: new mongoose.Types.ObjectId().toString(),
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
      r._id = new mongoose.Types.ObjectId().toString();
      needsSave = true;
    }
    return r;
  });

  if (needsSave) {
    console.log(`[Migration] Migrating legacy study session resources: "${session.title}"`);
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

  async getSessionById(userId, sessionId) {
    console.log('[DEBUG SERVICE] Entering getSessionById. User ID:', userId, 'Session ID:', sessionId);
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found');
    }
    await migrateLegacySession(session);
    return session.toObject();
  }

  async createSession(userId, { title, description = '', metadata = {} }) {
    // Check if this is a resource-triggered session creation
    const isResourceSession = 
      title?.endsWith('Workspace') || 
      description?.startsWith('PDF Document:') || 
      description?.startsWith('Web resources:') || 
      description?.startsWith('Pasted text content.') || 
      metadata?.pasteUrl || 
      metadata?.pasteText;

    if (isResourceSession) {
      // Find or create a single active session (prevents duplicates)
      const session = await resourceService.findOrCreateActiveSession(userId, title);

      if (session.title === 'My Study Session') {
        session.title = title;
      }
      if (description) {
        session.description = (session.description && session.description !== 'Auto-created active study session')
          ? `${session.description}\n${description}`
          : description;
      }

      // Link any metadata payload to resources array
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

    // Default flow: create new session
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
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const oldTitle = session.title;
    const oldPinned = session.pinned;

    // Set allowable updates
    const allowedUpdates = [
      'title', 'description', 'pinned', 'lastOpened', 'metadata',
      'pdfCount', 'youtubeCount', 'notesCount', 'flashcardsCount', 'quizCount', 'chatCount'
    ];
    
    for (const field of allowedUpdates) {
      if (updates[field] !== undefined) {
        if (field === 'metadata') {
          // Perform a deep merge to avoid losing sub-keys (like base64 fileData or transcript arrays)
          session.metadata = deepMerge(session.metadata || {}, updates.metadata || {});
          session.markModified('metadata');
        } else {
          session[field] = updates[field];
        }
      }
    }

    // Link updated resource to array and update counts atomically
    if (updates.metadata) {
      const meta = updates.metadata;

      // Sync PDF
      if (meta.pdf && (meta.pdf.filename || meta.pdf.pdfFilename)) {
        const pdfUrl = meta.pdf.pdfFilename || meta.pdf.filename;
        const pdfTitle = meta.pdf.filename || meta.pdf.pdfFilename || 'PDF Document';
        await resourceService.linkResourceToSession(session, {
          type: 'pdf',
          url: pdfUrl,
          title: pdfTitle,
          data: meta.pdf
        });
      }

      // Sync YouTube
      if (meta.youtube && meta.youtube.videoUrl) {
        await resourceService.linkResourceToSession(session, {
          type: 'youtube',
          url: meta.youtube.videoUrl,
          title: meta.youtube.title || 'YouTube Video',
          data: meta.youtube
        });
      }

      // Sync Notes
      if (meta.notes && meta.notes.noteId) {
        await resourceService.linkResourceToSession(session, {
          type: 'notes',
          url: meta.notes.noteId,
          title: meta.notes.title || 'Note',
          data: meta.notes
        });
      } else if (meta.notesContent || meta.noteContent || (meta.notes && (meta.notes.content || meta.notes.notesContent))) {
        const notesId = 'default_notes_id';
        const notesTitle = meta.notes?.title || 'Lecture Notes';
        await resourceService.linkResourceToSession(session, {
          type: 'notes',
          url: notesId,
          title: notesTitle,
          data: meta.notes || { content: meta.notesContent || meta.noteContent }
        });
      }
    }

    const updatedSession = await session.save();

    // Log relevant activities
    if (updates.title && updates.title !== oldTitle) {
      await this.logActivity(userId, {
        session: updatedSession._id,
        sessionTitle: updatedSession.title,
        action: 'renamed',
        details: `Renamed workspace from "${oldTitle}" to "${updatedSession.title}"`
      });
    } else if (updates.pinned !== undefined && updates.pinned !== oldPinned) {
      await this.logActivity(userId, {
        session: updatedSession._id,
        sessionTitle: updatedSession.title,
        action: updates.pinned ? 'pinned' : 'unpinned',
        details: `${updates.pinned ? 'Pinned' : 'Unpinned'} workspace "${updatedSession.title}"`
      });
    } else if (updates.lastOpened) {
      await this.logActivity(userId, {
        session: updatedSession._id,
        sessionTitle: updatedSession.title,
        action: 'opened',
        details: `Opened workspace "${updatedSession.title}"`
      });
    }

    return updatedSession;
  }

  async deleteSession(userId, sessionId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const title = session.title;
    await StudySession.deleteOne({ _id: sessionId });

    await this.logActivity(userId, {
      session: null,
      sessionTitle: title,
      action: 'deleted',
      details: `Deleted workspace "${title}"`
    });

    return { id: sessionId };
  }

  async getResources(userId, sessionId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId }).lean();
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }
    return session.resources || [];
  }

  async addResource(userId, sessionId, { type, url, title, data }) {
    let session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }
    
    session = await resourceService.linkResourceToSession(session, { type, url, title, data });
    return await session.save();
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

    // Update title
    session.resources[resourceIndex].title = newTitle.trim();
    session.resources[resourceIndex].updatedAt = new Date();

    // If active metadata matches, update it too
    if (session.metadata) {
      const resource = session.resources[resourceIndex];
      const type = resource.type;
      if (type === 'pdf' && session.metadata.pdf) {
        session.metadata.pdf.filename = newTitle.trim();
      } else if (type === 'youtube' && session.metadata.youtube) {
        session.metadata.youtube.title = newTitle.trim();
      } else if (type === 'notes' && session.metadata.notes) {
        session.metadata.notes.title = newTitle.trim();
      }
    }

    session.markModified('resources');
    session.markModified('metadata');

    return await session.save();
  }

  async replaceResource(userId, sessionId, resourceId, { url, title, data }) {
    if (!url) {
      throw ApiError.badRequest('Replacement URL/identifier is required');
    }

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

    // Update details in-place
    session.resources[resourceIndex] = {
      ...oldResource,
      url,
      title: title || oldResource.title,
      data: data || {},
      ai: {}, // Clear previous AI contents for new file grounding
      updatedAt: new Date()
    };

    // Update active metadata shortcuts if applicable
    if (session.metadata) {
      const type = oldResource.type;
      if (type === 'pdf') {
        session.metadata.pdf = data || {};
      } else if (type === 'youtube') {
        session.metadata.youtube = data || {};
      } else if (type === 'notes') {
        session.metadata.notes = data || {};
      }
    }

    // Cascade: delete past PDFChat logs, AIConversations and AIMessages for the old resourceId
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

    session.markModified('resources');
    session.markModified('metadata');

    return await session.save();
  }

  async deleteResource(userId, sessionId, resourceId) {
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // Find the resource inside session.resources
    const resourceIndex = session.resources.findIndex(
      r => (r._id && r._id.toString() === resourceId) || r.url === resourceId || r.title === resourceId
    );

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in this study session');
    }

    const resource = session.resources[resourceIndex];
    
    // Remove the resource
    session.resources.splice(resourceIndex, 1);

    // Update metadata if this was the active resource
    if (session.metadata) {
      const typeMap = {
        pdf: 'pdf',
        youtube: 'youtube',
        notes: 'notes'
      };
      
      const activeType = typeMap[resource.type] || 'pdf';
      
      // If the activeResourceType matches the deleted resource's type, clear the active status
      if (session.metadata.activeResourceType === activeType || session.metadata.lastTab === activeType) {
        session.metadata.activeResourceType = '';
        session.metadata.lastTab = '';
        
        // Also clear the active metadata sub-key
        if (activeType === 'pdf') {
          session.metadata.pdf = null;
        } else if (activeType === 'youtube') {
          session.metadata.youtube = null;
        } else if (activeType === 'notes') {
          session.metadata.notes = null;
        }
      }
    }

    // Update counts
    session.videoCount = session.resources.filter(r => r.type === 'youtube').length;
    session.youtubeCount = session.videoCount;
    session.pdfCount = session.resources.filter(r => r.type === 'pdf').length;
    session.notesCount = session.resources.filter(r => r.type === 'notes').length;
    session.resourceCount = session.resources.length;

    session.markModified('resources');
    session.markModified('metadata');

    const savedSession = await session.save();

    // Cleanup associated data asynchronously
    try {
      await PDFChat.deleteMany({ workspaceId: sessionId, resourceId: resourceId });
      
      const conversations = await AIConversation.find({ studySession: sessionId, resourceId: resourceId }).lean();
      const conversationIds = conversations.map(c => c._id);
      
      if (conversationIds.length > 0) {
        await AIMessage.deleteMany({ conversation: { $in: conversationIds } });
        await AIConversation.deleteMany({ _id: { $in: conversationIds } });
      }
    } catch (err) {
      logger.error(`[Resource Cleanup Error] Failed to cleanup sub-data for resource ${resourceId}: ${err.message}`);
    }

    // Log activity
    await this.logActivity(userId, {
      session: sessionId,
      sessionTitle: session.title,
      action: 'deleted_resource',
      details: `Deleted ${resource.type} resource "${resource.title}"`
    });

    return savedSession;
  }

  async getActivities(userId) {
    return await StudyActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}

export default new StudyService();
