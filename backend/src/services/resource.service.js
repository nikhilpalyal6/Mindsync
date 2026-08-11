import StudySession from '../models/studySession.model.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';
import mindMapService from './mindMap.service.js';

class ResourceService {
  /**
   * Find the most recent active study session (workspace) or create one if none exists
   */
  async findOrCreateActiveSession(userId, defaultTitle = 'My Study Session') {
    try {
      logger.info(`[Resource Service] Finding active session for user: ${userId}`);
      
      const UserPreferences = (await import('../models/userPreferences.model.js')).default;
      const prefs = await UserPreferences.findOne({ userId });
      const tz = prefs?.timezone || 'UTC';

      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });
      const todayStr = formatter.format(now);

      const sessions = await StudySession.find({ user: userId }).sort({ lastOpened: -1 });
      let session = sessions.find(s => {
        const sessionDateStr = formatter.format(s.createdAt);
        return sessionDateStr === todayStr;
      });
      
      if (!session) {
        session = new StudySession({
          user: userId,
          title: defaultTitle,
          description: 'Auto-created active study session'
        });
        await session.save();
        logger.info(`[Resource Service] Created new active session for user ${userId} for today's date`);
      } else {
        logger.info(`[Resource Service] Found existing active session for today: ${session._id}`);
      }
      return session;
    } catch (err) {
      logger.error(`[Resource Service] findOrCreateActiveSession error: ${err.stack}`);
      throw err;
    }
  }

  /**
   * Append a resource to the session's resources array and update statistics
   */
  async linkResourceToSession(session, { type, url, title, data }) {
    try {
      if (!type || !url) {
        throw new Error('Resource type and URL/identifier are required.');
      }

      logger.info(`[Resource Service] Linking resource type: ${type}, URL: ${url} to session ${session._id}`);

      // Initialize resources array if missing
      if (!session.resources) {
        session.resources = [];
      }

      // Ensure all existing resources in the session have an _id
      session.resources = session.resources.map(r => {
        if (!r._id) {
          r._id = new mongoose.Types.ObjectId().toString();
        }
        return r;
      });

      // Check for duplicate resource
      const existingResourceIndex = session.resources.findIndex(
        r => r.type === type && r.url === url
      );

      const existingData = existingResourceIndex > -1 ? (session.resources[existingResourceIndex].data || {}) : {};
      
      // Perform deep merge to avoid losing rich fields during lightweight updates
      const mergedData = {
        ...existingData,
        ...(data || {})
      };

      // Explicitly preserve heavy payload keys if they exist in the DB but are missing in the update
      if (existingData.fileData && !mergedData.fileData) {
        mergedData.fileData = existingData.fileData;
      }
      if (existingData.extractedText && !mergedData.extractedText) {
        mergedData.extractedText = existingData.extractedText;
      }
      if (existingData.pages && !mergedData.pages) {
        mergedData.pages = existingData.pages;
      }
      if (existingData.transcriptItems && !mergedData.transcriptItems) {
        mergedData.transcriptItems = existingData.transcriptItems;
      }
      if (existingData.originalTranscriptItems && !mergedData.originalTranscriptItems) {
        mergedData.originalTranscriptItems = existingData.originalTranscriptItems;
      }
      if (existingData.chapters && !mergedData.chapters) {
        mergedData.chapters = existingData.chapters;
      }

      const resourcePayload = {
        type,
        url,
        title: title || 'Untitled Resource',
        data: mergedData,
        updatedAt: new Date()
      };

      if (existingResourceIndex > -1) {
        logger.info(`[Resource Service] Found existing resource, updating details in-place`);
        session.resources[existingResourceIndex] = {
          ...session.resources[existingResourceIndex],
          ...resourcePayload,
          _id: session.resources[existingResourceIndex]._id || new mongoose.Types.ObjectId().toString(),
          addedAt: session.resources[existingResourceIndex].addedAt || new Date()
        };
      } else {
        logger.info(`[Resource Service] Appending new resource to list`);
        session.resources.push({
          _id: new mongoose.Types.ObjectId().toString(),
          ...resourcePayload,
          addedAt: new Date()
        });
      }

      // Sync active metadata shortcuts for backward compatibility with frontend/context builder
      if (!session.metadata) {
        session.metadata = {};
      }

      session.metadata.activeResourceType = type;
      session.metadata.lastTab = type;
      session.metadata.lastOpened = new Date().toISOString();

      if (type === 'youtube') {
        session.metadata.youtube = mergedData;
      } else if (type === 'pdf') {
        session.metadata.pdf = mergedData;
      } else if (type === 'notes') {
        session.metadata.notes = mergedData;
      }

      session.markModified('resources');
      session.markModified('metadata');

      // Update statistics
      session.videoCount = session.resources.filter(r => r.type === 'youtube').length;
      session.youtubeCount = session.videoCount;
      session.pdfCount = session.resources.filter(r => r.type === 'pdf').length;
      session.notesCount = session.resources.filter(r => r.type === 'notes').length;
      session.resourceCount = session.resources.length;

      logger.info(`[Resource Service] Updated statistics: resourceCount=${session.resourceCount}, videoCount=${session.videoCount}, pdfCount=${session.pdfCount}, notesCount=${session.notesCount}`);
      
      // Trigger background Workspace Mind Map generation asynchronously (Step 13 & 16)
      if (session && session.user && session._id) {
        const resourcesForMap = session.resources || [];
        mindMapService.generateWorkspaceMindMapBackground(
          session.user.toString(),
          session._id.toString(),
          session.title || 'Workspace Learning Map',
          resourcesForMap
        ).catch(err => logger.error(`[Workspace MindMap Hook] Automatic background generation failed: ${err.message}`));
      }

      return session;
    } catch (err) {
      logger.error(`[Resource Service] linkResourceToSession error: ${err.stack}`);
      throw err;
    }
  }
}

export default new ResourceService();
