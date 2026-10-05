import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomFocusSession from '../models/studyRoomFocusSession.model.js';
import StudyRoomGoal from '../models/studyRoomGoal.model.js';
import StudyRoomActivityLog from '../models/studyRoomActivityLog.model.js';
import ApiError from '../../utils/ApiError.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

class StudyRoomService {
  /**
   * Helper to verify if user is the host of a room
   */
  async verifyHost(roomId, userId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }
    const User = (await import('../../models/user.model.js')).default;
    const user = await User.findById(userId);
    if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      return room;
    }
    throw ApiError.forbidden('Only an admin/moderator can perform this action');
  }

  /**
   * Create a Study Room and add host as first participant
   */
  async createRoom(hostId, roomData) {
    let status = roomData.status || 'LIVE';
    if (roomData.scheduledStart && new Date(roomData.scheduledStart) > new Date()) {
      status = 'SCHEDULED';
    }

    const room = await StudyRoom.create({
      ...roomData,
      status,
      host: hostId
    });

    // Add host as active participant only if they are not system admins/moderators
    const User = (await import('../../models/user.model.js')).default;
    const hostUser = await User.findById(hostId);
    const isHostAdmin = hostUser && (hostUser.role === 'ADMIN' || hostUser.role === 'SUPER_ADMIN');

    if (!isHostAdmin) {
      await StudyRoomParticipant.create({
        room: room._id,
        user: hostId,
        role: 'HOST',
        status: 'active'
      });
    }

    // Log event
    await StudyRoomActivityLog.create({
      room: room._id,
      user: hostId,
      eventType: 'ROOM_CREATED'
    });

    return room;
  }

  async listRooms(filters = {}, currentUserId = null) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.visibility) query.visibility = filters.visibility;
    if (filters.host) query.host = filters.host;
    
    const rooms = await StudyRoom.find(query)
      .populate('host', 'name username profileImage avatar')
      .populate('workshopId', 'title')
      .lean();

    const updatedRooms = await Promise.all(
      rooms.map(async (room) => {
        const count = await StudyRoomParticipant.countDocuments({
          room: room._id,
          status: { $in: ['joined', 'active'] }
        });

        let isCurrentUserParticipant = false;
        if (currentUserId) {
          const participant = await StudyRoomParticipant.findOne({
            room: room._id,
            user: currentUserId,
            status: { $in: ['joined', 'active'] }
          });
          isCurrentUserParticipant = !!participant;
        }

        return {
          ...room,
          participantsCount: count,
          isCurrentUserParticipant
        };
      })
    );

    return updatedRooms;
  }

  /**
   * Get Study Room by ID
   */
  async getRoom(roomId, currentUserId = null) {
    const room = await StudyRoom.findById(roomId)
      .populate('host', 'name username profileImage avatar')
      .populate('workshopId', 'title')
      .lean();

    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    const count = await StudyRoomParticipant.countDocuments({
      room: room._id,
      status: { $in: ['joined', 'active'] }
    });

    let isCurrentUserParticipant = false;
    if (currentUserId) {
      const participant = await StudyRoomParticipant.findOne({
        room: room._id,
        user: currentUserId,
        status: { $in: ['joined', 'active'] }
      });
      isCurrentUserParticipant = !!participant;
    }

    return {
      ...room,
      participantsCount: count,
      isCurrentUserParticipant
    };
  }

  /**
   * Update Room Metadata (Host only)
   */
  async updateRoom(roomId, userId, updateData) {
    const room = await this.verifyHost(roomId, userId);

    // Apply updates
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        room[key] = updateData[key];
      }
    });

    await room.save();
    return room;
  }

  /**
   * Delete Study Room and clean up related resources (Host only)
   */
  async deleteRoom(roomId, userId) {
    await this.verifyHost(roomId, userId);

    await StudyRoom.deleteOne({ _id: roomId });
    await StudyRoomParticipant.deleteMany({ room: roomId });
    await StudyRoomFocusSession.deleteMany({ room: roomId });
    await StudyRoomGoal.deleteMany({ room: roomId });
    await StudyRoomActivityLog.deleteMany({ room: roomId });

    return { success: true, message: 'Room and associated data deleted' };
  }

  /**
   * Transition Room Status to LIVE
   */
  async startRoom(roomId, userId) {
    const room = await this.verifyHost(roomId, userId);

    if (['ENDED', 'CANCELLED'].includes(room.status)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, `Cannot start a room that is already ${room.status.toLowerCase()}`);
    }

    room.status = 'LIVE';
    room.actualStart = new Date();
    await room.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'ROOM_STARTED'
    });

    return room;
  }

  /**
   * Transition Room Status to ENDED
   */
  async endRoom(roomId, userId) {
    const room = await this.verifyHost(roomId, userId);

    if (room.status === 'ENDED') {
      return room; // already ended
    }

    room.status = 'ENDED';
    room.actualEnd = new Date();
    await room.save();

    // Mark all active participants as left
    await StudyRoomParticipant.updateMany(
      { room: roomId, status: { $in: ['joined', 'active'] } },
      { $set: { status: 'left', leftAt: new Date() } }
    );

    // End any active focus sessions
    const activeFocus = await StudyRoomFocusSession.findOne({ room: roomId, status: { $in: ['PENDING', 'ACTIVE', 'PAUSED'] } });
    if (activeFocus) {
      activeFocus.status = 'COMPLETED';
      activeFocus.endedAt = new Date();
      activeFocus.actualDuration = activeFocus.startedAt
        ? Math.round((new Date() - activeFocus.startedAt) / 60000)
        : 0;
      await activeFocus.save();
      
      await StudyRoomActivityLog.create({
        room: roomId,
        eventType: 'FOCUS_ENDED'
      });
    }

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'ROOM_ENDED'
    });

    return room;
  }

  /**
   * Transition Room Status to CANCELLED
   */
  async cancelRoom(roomId, userId) {
    const room = await this.verifyHost(roomId, userId);

    if (room.status === 'CANCELLED') {
      return room;
    }

    if (room.status === 'ENDED') {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Cannot cancel a room that has already ended');
    }

    room.status = 'CANCELLED';
    await room.save();

    // Mark all active participants as left
    await StudyRoomParticipant.updateMany(
      { room: roomId, status: { $in: ['joined', 'active'] } },
      { $set: { status: 'left', leftAt: new Date() } }
    );

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'ROOM_ENDED',
      metadata: { cancellation: true }
    });

    return room;
  }

  /**
   * Lock Room
   */
  async lockRoom(roomId, userId) {
    const room = await this.verifyHost(roomId, userId);

    room.isLocked = true;
    await room.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'ROOM_LOCKED'
    });

    return room;
  }

  /**
   * Unlock Room
   */
  async unlockRoom(roomId, userId) {
    const room = await this.verifyHost(roomId, userId);

    room.isLocked = false;
    await room.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'ROOM_UNLOCKED'
    });

    return room;
  }

  /**
   * Join a room (Participant join)
   */
  async joinRoom(roomId, userId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    if (['ENDED', 'CANCELLED'].includes(room.status)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Cannot join an ended or cancelled room');
    }

    const User = (await import('../../models/user.model.js')).default;
    const userObj = await User.findById(userId);
    const isAdmin = userObj && (userObj.role === 'ADMIN' || userObj.role === 'SUPER_ADMIN');

    if (isAdmin) {
      return {
        room: roomId,
        user: userId,
        role: 'ADMIN',
        status: 'active',
        isAdminVirtual: true
      };
    }

    // Lock check (host bypasses lock)
    const isHost = room.host.toString() === userId.toString();
    if (room.isLocked && !isHost) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Cannot join room: room is locked');
    }

    // Look for existing participant document (active or left)
    let participant = await StudyRoomParticipant.findOne({ room: roomId, user: userId });
    
    if (participant) {
      if (['joined', 'active'].includes(participant.status)) {
        return participant; // already in room
      }
      
      // Update participant status to active/joined
      participant.status = 'active';
      participant.leftAt = null;
      await participant.save();
    } else {
      // Create new participant
      participant = await StudyRoomParticipant.create({
        room: roomId,
        user: userId,
        role: 'STUDENT',
        status: 'active'
      });
    }

    // --- CONCURRENCY SAFE CAPACITY CHECK ---
    // Enforce order-based capacity checking post-save to prevent parallel race condition joins
    if (!isHost) {
      const activeParticipants = await StudyRoomParticipant.find({
        room: roomId,
        status: { $in: ['joined', 'active'] }
      }).sort({ createdAt: 1, _id: 1 });

      const myIndex = activeParticipants.findIndex(p => p.user.toString() === userId.toString());
      if (myIndex >= room.capacity) {
        // Revert participant status to left and throw conflict
        participant.status = 'left';
        participant.leftAt = new Date();
        await participant.save();
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Cannot join room: capacity exceeded');
      }
    }

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'PARTICIPANT_JOINED'
    });

    return participant;
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId, userId) {
    const participant = await StudyRoomParticipant.findOne({ room: roomId, user: userId });
    if (!participant || !['joined', 'active'].includes(participant.status)) {
      return { success: true, message: 'User is not an active participant' };
    }

    participant.status = 'left';
    participant.leftAt = new Date();
    await participant.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'PARTICIPANT_LEFT'
    });

    return participant;
  }

  /**
   * List Participants in a room
   */
  async listParticipants(roomId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    return StudyRoomParticipant.find({ room: roomId, status: { $in: ['joined', 'active'] } })
      .populate('user', 'name username email profileImage avatar role');
  }

  /**
   * Start Focus Session (Host only)
   */
  /**
   * Helper to format focus session details with dynamic time tracking
   */
  getFocusSessionDetails(session) {
    if (!session) return null;

    const startedAt = session.startedAt;
    const plannedDurationMs = session.plannedDuration * 60 * 1000;
    
    let totalPausedDuration = 0;
    for (const interval of session.pauseHistory || []) {
      const end = interval.resumedAt ? new Date(interval.resumedAt) : new Date();
      totalPausedDuration += end.getTime() - new Date(interval.pausedAt).getTime();
    }

    let remainingMs = 0;
    let endsAt = null;

    if (session.status === 'ACTIVE') {
      const elapsedMs = (Date.now() - new Date(startedAt).getTime()) - totalPausedDuration;
      remainingMs = Math.max(0, plannedDurationMs - elapsedMs);
      endsAt = new Date(Date.now() + remainingMs).toISOString();
    } else if (session.status === 'PAUSED') {
      const lastPause = session.pauseHistory[session.pauseHistory.length - 1];
      let pausedDurationBeforeLast = 0;
      for (let i = 0; i < session.pauseHistory.length - 1; i++) {
        const interval = session.pauseHistory[i];
        const end = interval.resumedAt ? new Date(interval.resumedAt) : new Date();
        pausedDurationBeforeLast += end.getTime() - new Date(interval.pausedAt).getTime();
      }
      const elapsedAtPause = (new Date(lastPause.pausedAt).getTime() - new Date(startedAt).getTime()) - pausedDurationBeforeLast;
      remainingMs = Math.max(0, plannedDurationMs - elapsedAtPause);
      endsAt = new Date(Date.now() + remainingMs).toISOString();
    }

    return {
      _id: session._id,
      room: session.room,
      host: session.host,
      status: session.status,
      startedAt: session.startedAt,
      plannedDuration: session.plannedDuration,
      endsAt,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      pauseHistory: session.pauseHistory
    };
  }

  /**
   * Start Focus Session (Host only)
   */
  async startFocusSession(roomId, userId, plannedDuration) {
    await this.verifyHost(roomId, userId);

    // Enforce single active focus session check
    const existingActive = await StudyRoomFocusSession.findOne({
      room: roomId,
      status: { $in: ['PENDING', 'ACTIVE', 'PAUSED'] }
    });
    if (existingActive) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'An active focus session is already in progress');
    }

    const focusSession = await StudyRoomFocusSession.create({
      room: roomId,
      host: userId,
      plannedDuration,
      status: 'ACTIVE',
      startedAt: new Date()
    });

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'FOCUS_STARTED',
      metadata: { focusSessionId: focusSession._id, plannedDuration }
    });

    return focusSession;
  }

  /**
   * Pause Focus Session (Host only)
   */
  async pauseFocusSession(roomId, userId) {
    await this.verifyHost(roomId, userId);

    const focusSession = await StudyRoomFocusSession.findOne({
      room: roomId,
      status: 'ACTIVE'
    });

    if (!focusSession) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'No active focus session found to pause');
    }

    focusSession.status = 'PAUSED';
    focusSession.pauseHistory.push({
      pausedAt: new Date(),
      resumedAt: null
    });
    await focusSession.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'FOCUS_PAUSED',
      metadata: { focusSessionId: focusSession._id }
    });

    return focusSession;
  }

  /**
   * Resume Focus Session (Host only)
   */
  async resumeFocusSession(roomId, userId) {
    await this.verifyHost(roomId, userId);

    const focusSession = await StudyRoomFocusSession.findOne({
      room: roomId,
      status: 'PAUSED'
    });

    if (!focusSession) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'No paused focus session found to resume');
    }

    focusSession.status = 'ACTIVE';
    if (focusSession.pauseHistory.length > 0) {
      focusSession.pauseHistory[focusSession.pauseHistory.length - 1].resumedAt = new Date();
    }
    await focusSession.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'FOCUS_RESUMED',
      metadata: { focusSessionId: focusSession._id }
    });

    return focusSession;
  }

  /**
   * End Focus Session (Host only)
   */
  async endFocusSession(roomId, userId) {
    await this.verifyHost(roomId, userId);

    const focusSession = await StudyRoomFocusSession.findOne({
      room: roomId,
      status: { $in: ['PENDING', 'ACTIVE', 'PAUSED'] }
    });

    if (!focusSession) {
      throw ApiError.notFound('No active focus session found');
    }

    focusSession.status = 'COMPLETED';
    focusSession.endedAt = new Date();
    focusSession.actualDuration = focusSession.startedAt
      ? Math.round((new Date() - focusSession.startedAt) / 60000)
      : 0;
    await focusSession.save();

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'FOCUS_ENDED',
      metadata: { focusSessionId: focusSession._id, actualDuration: focusSession.actualDuration }
    });

    return focusSession;
  }

  /**
   * Get Current Focus Session
   */
  async getCurrentFocusSession(roomId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    return StudyRoomFocusSession.findOne({
      room: roomId,
      status: { $in: ['PENDING', 'ACTIVE', 'PAUSED'] }
    }).sort({ createdAt: -1 });
  }

  /**
      * Create Personal Goal
   */
  async createGoal(roomId, userId, title, description, studyTaskId = null, progress = 0) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    const isParticipant = await StudyRoomParticipant.findOne({
      room: roomId,
      user: userId,
      status: { $in: ['joined', 'active'] }
    });
    if (!isParticipant) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Only active participants can set goals');
    }

    let studyTaskRef = null;
    if (studyTaskId) {
      const StudyTask = (await import('../../models/studyTask.model.js')).default;
      const task = await StudyTask.findOne({ _id: studyTaskId, user: userId });
      if (!task) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study task not found or unauthorized.');
      }
      if (task.status === 'COMPLETED') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Task already completed.');
      }

      // Check for duplicate link in the same room
      const existingGoal = await StudyRoomGoal.findOne({
        room: roomId,
        user: userId,
        studyTask: studyTaskId,
        status: { $ne: 'ABANDONED' }
      });
      if (existingGoal) {
        return existingGoal;
      }
      studyTaskRef = task._id;
    }

    const goal = await StudyRoomGoal.create({
      room: roomId,
      user: userId,
      title,
      description,
      progress: progress || 0,
      studyTask: studyTaskRef
    });

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'GOAL_CREATED',
      metadata: { goalId: goal._id }
    });

    return goal;
  }

  /**
   * Get Personal Goals for current user in the room
   */
  async listGoals(roomId, userId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }
    const participant = await StudyRoomParticipant.findOne({ room: roomId, user: userId });
    if (!participant) {
      throw ApiError.forbidden('You do not have access to this study room');
    }
    return StudyRoomGoal.find({ room: roomId, user: userId }).populate('studyTask');
  }

  /**
   * Update Goal Details (Owner only)
   */
  async updateGoal(roomId, userId, goalId, data) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    const goal = await StudyRoomGoal.findOne({ _id: goalId, room: roomId });
    if (!goal) {
      throw ApiError.notFound('Goal not found');
    }

    if (goal.user.toString() !== userId.toString()) {
      throw ApiError.forbidden('You can only modify your own goals');
    }

    if (goal.status === 'COMPLETED') {
      if (data.progress !== undefined && Number(data.progress) !== 100) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Cannot modify progress of a completed goal');
      }
      if (data.status !== undefined && data.status !== 'COMPLETED') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Cannot reopen a completed goal');
      }
      if (data.studyTaskId !== undefined || data.studyTask !== undefined) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Cannot modify planner link of a completed goal');
      }
    }

    if (data.progress !== undefined) {
      const prog = Number(data.progress);
      if (isNaN(prog) || prog < 0 || prog > 100) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Progress must be a number between 0 and 100');
      }
      goal.progress = prog;
    }

    if (data.studyTaskId !== undefined) {
      if (data.studyTaskId === null || data.studyTaskId === '') {
        goal.studyTask = null;
      } else {
        const StudyTask = (await import('../../models/studyTask.model.js')).default;
        const task = await StudyTask.findOne({ _id: data.studyTaskId, user: userId });
        if (!task) {
          throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study task not found or unauthorized.');
        }
        if (task.status === 'COMPLETED') {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Task already completed.');
        }
        goal.studyTask = task._id;
      }
    }

    if (data.title !== undefined) {
      const trimmedTitle = String(data.title).trim();
      if (!trimmedTitle) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Goal title cannot be empty');
      }
      goal.title = trimmedTitle;
    }

    if (data.description !== undefined) {
      goal.description = String(data.description).trim();
    }

    if (data.status !== undefined && goal.status !== 'COMPLETED') {
      goal.status = data.status;
    }

    await goal.save();
    return goal;
  }

  /**
   * Complete Personal Goal (Owner only)
   */
  async completeGoal(roomId, userId, goalId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    const goal = await StudyRoomGoal.findOne({ _id: goalId, room: roomId });
    if (!goal) {
      throw ApiError.notFound('Goal not found');
    }

    if (goal.user.toString() !== userId.toString()) {
      throw ApiError.forbidden('You can only complete your own goals');
    }

    goal.status = 'COMPLETED';
    goal.progress = 100;
    await goal.save();

    if (goal.studyTask) {
      const StudyTask = (await import('../../models/studyTask.model.js')).default;
      const task = await StudyTask.findOne({ _id: goal.studyTask, user: userId });
      if (!task) {
        // If studyTask was deleted independently, handle it gracefully
        goal.studyTask = null;
        await goal.save();
      } else {
        task.status = 'COMPLETED';
        task.completedAt = new Date();
        await task.save();
      }
    }

    await StudyRoomActivityLog.create({
      room: roomId,
      user: userId,
      eventType: 'GOAL_COMPLETED',
      metadata: { goalId }
    });

    return goal;
  }

  /**
   * Delete Personal Goal (Owner only)
   */
  async deleteGoal(roomId, userId, goalId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    const goal = await StudyRoomGoal.findOne({ _id: goalId, room: roomId });
    if (!goal) {
      throw ApiError.notFound('Goal not found');
    }

    if (goal.user.toString() !== userId.toString()) {
      throw ApiError.forbidden('You can only delete your own goals');
    }

    await StudyRoomGoal.deleteOne({ _id: goalId });
    return { success: true, message: 'Goal deleted successfully' };
  }

  /**
   * Retrieve Room Activity Timeline
   */
  async getActivityTimeline(roomId) {
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      throw ApiError.notFound('Study room not found');
    }

    return StudyRoomActivityLog.find({ room: roomId })
      .sort({ timestamp: -1 })
      .populate('user', 'name username');
  }
}

export default new StudyRoomService();
