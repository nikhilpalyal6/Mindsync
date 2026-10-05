import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import studyRoomService from '../services/studyRoom.service.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import { validationResult } from 'express-validator';
import ApiError from '../../utils/ApiError.js';

class StudyRoomController {
  // Helper to validate express-validator results
  validateRequest(req) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((err) => ({
        field: err.path,
        message: err.msg
      }));
      throw new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Validation failed', formattedErrors);
    }
  }

  createRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.createRoom(req.user._id, req.body);
    return res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.created(room, 'Study room created successfully')
    );
  });

  listRooms = asyncHandler(async (req, res) => {
    const rooms = await studyRoomService.listRooms(req.query, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(rooms, 'Study rooms retrieved successfully')
    );
  });

  getRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.getRoom(req.params.roomId, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room retrieved successfully')
    );
  });

  updateRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.updateRoom(req.params.roomId, req.user._id, req.body);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room updated successfully')
    );
  });

  deleteRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const result = await studyRoomService.deleteRoom(req.params.roomId, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Study room deleted successfully')
    );
  });

  startRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.startRoom(req.params.roomId, req.user._id);
    const { notifyRoomLifecycle } = await import('../realtime/studyRoom.socket.js');
    notifyRoomLifecycle(req.params.roomId, 'LIVE');
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room started (is now live)')
    );
  });

  endRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.endRoom(req.params.roomId, req.user._id);
    const { notifyRoomLifecycle } = await import('../realtime/studyRoom.socket.js');
    notifyRoomLifecycle(req.params.roomId, 'ENDED');
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room ended successfully')
    );
  });

  cancelRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.cancelRoom(req.params.roomId, req.user._id);
    const { notifyRoomLifecycle } = await import('../realtime/studyRoom.socket.js');
    notifyRoomLifecycle(req.params.roomId, 'CANCELLED');
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room cancelled successfully')
    );
  });

  lockRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.lockRoom(req.params.roomId, req.user._id);
    const { notifyRoomLock } = await import('../realtime/studyRoom.socket.js');
    notifyRoomLock(req.params.roomId, true);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room locked successfully')
    );
  });

  unlockRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const room = await studyRoomService.unlockRoom(req.params.roomId, req.user._id);
    const { notifyRoomLock } = await import('../realtime/studyRoom.socket.js');
    notifyRoomLock(req.params.roomId, false);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(room, 'Study room unlocked successfully')
    );
  });

  joinRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const participant = await studyRoomService.joinRoom(req.params.roomId, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(participant, 'Joined study room successfully')
    );
  });

  leaveRoom = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const participant = await studyRoomService.leaveRoom(req.params.roomId, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(participant, 'Left study room successfully')
    );
  });

  listParticipants = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const participants = await studyRoomService.listParticipants(req.params.roomId);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(participants, 'Participants retrieved successfully')
    );
  });

  startFocusSession = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const { plannedDuration } = req.body;
    const focusSession = await studyRoomService.startFocusSession(req.params.roomId, req.user._id, plannedDuration);
    const details = studyRoomService.getFocusSessionDetails(focusSession);
    const { notifyFocusSession } = await import('../realtime/studyRoom.socket.js');
    notifyFocusSession(req.params.roomId, 'START', focusSession);
    return res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.created(details, 'Focus session started successfully')
    );
  });

  endFocusSession = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const focusSession = await studyRoomService.endFocusSession(req.params.roomId, req.user._id);
    const details = studyRoomService.getFocusSessionDetails(focusSession);
    const { notifyFocusSession } = await import('../realtime/studyRoom.socket.js');
    notifyFocusSession(req.params.roomId, 'END', focusSession);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(details, 'Focus session ended successfully')
    );
  });

  pauseFocusSession = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const focusSession = await studyRoomService.pauseFocusSession(req.params.roomId, req.user._id);
    const details = studyRoomService.getFocusSessionDetails(focusSession);
    const { notifyFocusSession } = await import('../realtime/studyRoom.socket.js');
    notifyFocusSession(req.params.roomId, 'PAUSE', focusSession);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(details, 'Focus session paused successfully')
    );
  });

  resumeFocusSession = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const focusSession = await studyRoomService.resumeFocusSession(req.params.roomId, req.user._id);
    const details = studyRoomService.getFocusSessionDetails(focusSession);
    const { notifyFocusSession } = await import('../realtime/studyRoom.socket.js');
    notifyFocusSession(req.params.roomId, 'RESUME', focusSession);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(details, 'Focus session resumed successfully')
    );
  });

  getCurrentFocusSession = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const focusSession = await studyRoomService.getCurrentFocusSession(req.params.roomId);
    const details = studyRoomService.getFocusSessionDetails(focusSession);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(details, 'Current focus session retrieved successfully')
    );
  });

  createGoal = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const { title, description, studyTaskId } = req.body;
    const goal = await studyRoomService.createGoal(req.params.roomId, req.user._id, title, description, studyTaskId);
    return res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.created(goal, 'Goal created successfully')
    );
  });

  listGoals = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const goals = await studyRoomService.listGoals(req.params.roomId, req.user._id);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(goals, 'Personal goals retrieved successfully')
    );
  });

  updateGoal = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const goal = await studyRoomService.updateGoal(req.params.roomId, req.user._id, req.params.goalId, req.body);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(goal, 'Personal goal updated successfully')
    );
  });

  completeGoal = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const goal = await studyRoomService.completeGoal(req.params.roomId, req.user._id, req.params.goalId);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(goal, 'Personal goal marked completed successfully')
    );
  });

  deleteGoal = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    await studyRoomService.deleteGoal(req.params.roomId, req.user._id, req.params.goalId);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Personal goal deleted successfully')
    );
  });

  getActivityTimeline = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const timeline = await studyRoomService.getActivityTimeline(req.params.roomId);
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(timeline, 'Activity timeline retrieved successfully')
    );
  });

  getChatHistory = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const { roomId } = req.params;
    const userId = req.user._id;

    const room = await studyRoomService.getRoom(roomId, userId);
    const isHost = String(room.host._id || room.host) === String(userId);
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isHost && !isAdmin) {
      const StudyRoomParticipant = (await import('../models/studyRoomParticipant.model.js')).default;
      const isParticipant = await StudyRoomParticipant.findOne({
        room: roomId,
        user: userId,
        status: { $in: ['joined', 'active'] }
      });
      if (!isParticipant) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized: You are not an active participant of this study room');
      }
    }

    const StudyRoomChat = (await import('../models/studyRoomChat.model.js')).default;
    const query = {
      room: roomId,
      isDeleted: false
    };

    if (!isHost && !isAdmin) {
      query.$or = [
        { recipient: null },
        { recipient: { $exists: false } },
        { sender: userId },
        { recipient: userId }
      ];
    }

    const messages = await StudyRoomChat.find(query)
      .sort({ timestamp: 1 })
      .populate('sender', 'name username profileImage avatar role');

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(messages, 'Chat history retrieved successfully')
    );
  });

  deleteChatMessage = asyncHandler(async (req, res) => {
    this.validateRequest(req);
    const { roomId, chatId } = req.params;
    const userId = req.user._id;

    const room = await studyRoomService.getRoom(roomId, userId);
    const isHost = String(room.host._id || room.host) === String(userId);
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isHost && !isAdmin) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized: Only Host/Admin can delete messages');
    }

    const StudyRoomChat = (await import('../models/studyRoomChat.model.js')).default;
    const message = await StudyRoomChat.findByIdAndUpdate(chatId, { isDeleted: true }, { new: true });

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(message, 'Chat message deleted successfully')
    );
  });
}

export default new StudyRoomController();
