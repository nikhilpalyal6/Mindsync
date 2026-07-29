import StudySession from '../models/studySession.model.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

class ResourceService {
  /**
   * Find the most recent active study session (workspace) or create one if none exists
   */
  async findOrCreateActiveSession(userId, defaultTitle = 'My Study Session') {
    try {
      logger.info(`[Resource Service] Finding active session for user: ${userId}`);
      let session = await StudySession.findOne({ user: userId }).sort({ lastOpened: -1 });
      
      if (!session) {
        session = new StudySession({
          user: userId,
          title: defaultTitle,
          description: 'Auto-created active study session'
        });
        await session.save();
        logger.info(`[Resource Service] Created new active session for user ${userId}`);
      } else {
        logger.info(`[Resource Service] Found existing active session: ${session._id}`);
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

      const resourcePayload = {
        type,
        url,
        title: title || 'Untitled Resource',
        data: data || {},
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
        session.metadata.youtube = data;
      } else if (type === 'pdf') {
        session.metadata.pdf = data;
      } else if (type === 'notes') {
        session.metadata.notes = data;
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
      
      return session;
    } catch (err) {
      logger.error(`[Resource Service] linkResourceToSession error: ${err.stack}`);
      throw err;
    }
  }
}

export default new ResourceService();
