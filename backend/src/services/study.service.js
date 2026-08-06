import mongoose from 'mongoose';
import StudySession from '../models/studySession.model.js';
import StudyActivity from '../models/studyActivity.model.js';
import ApiError from '../utils/ApiError.js';
import resourceService from './resource.service.js';

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
      .select('_id title description pinned lastOpened pdfCount youtubeCount notesCount flashcardsCount quizCount chatCount progress thumbnail createdAt updatedAt')
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

  async getActivities(userId) {
    return await StudyActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}

export default new StudyService();
