import StudySession from '../models/studySession.model.js';
import StudyActivity from '../models/studyActivity.model.js';
import ApiError from '../utils/ApiError.js';

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
    const query = { user: userId };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    return await StudySession.find(query)
      .sort({ pinned: -1, lastOpened: -1 })
      .lean();
  }

  async createSession(userId, { title, description = '', metadata = {} }) {
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
    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        session[field] = updates[field];
      }
    });

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
