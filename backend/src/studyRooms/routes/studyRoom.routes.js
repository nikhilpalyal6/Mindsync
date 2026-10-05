import { Router } from 'express';
import protect from '../../middleware/auth.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import studyRoomController from '../controllers/studyRoom.controller.js';
import { authorize } from '../../middleware/role.middleware.js';
import { ROLES } from '../../constants/index.js';
import {
  roomIdParamValidator,
  createRoomValidator,
  updateRoomValidator,
  focusStartValidator,
  goalCreateValidator,
  goalUpdateValidator
} from '../validators/studyRoom.validators.js';

const router = Router();

// Require authentication for all Study Room endpoints
router.use(protect);

router.route('/')
  .post(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate(createRoomValidator), studyRoomController.createRoom)
  .get(studyRoomController.listRooms);

router.route('/:roomId')
  .get(validate(roomIdParamValidator), studyRoomController.getRoom)
  .patch(validate(updateRoomValidator), studyRoomController.updateRoom)
  .delete(validate(roomIdParamValidator), studyRoomController.deleteRoom);

// Lifecycle endpoints
router.route('/:roomId/start')
  .post(validate(roomIdParamValidator), studyRoomController.startRoom);

router.route('/:roomId/end')
  .post(validate(roomIdParamValidator), studyRoomController.endRoom);

router.route('/:roomId/cancel')
  .post(validate(roomIdParamValidator), studyRoomController.cancelRoom);

router.route('/:roomId/lock')
  .post(validate(roomIdParamValidator), studyRoomController.lockRoom);

router.route('/:roomId/unlock')
  .post(validate(roomIdParamValidator), studyRoomController.unlockRoom);

// Participant endpoints
router.route('/:roomId/join')
  .post(validate(roomIdParamValidator), studyRoomController.joinRoom);

router.route('/:roomId/leave')
  .post(validate(roomIdParamValidator), studyRoomController.leaveRoom);

router.route('/:roomId/participants')
  .get(validate(roomIdParamValidator), studyRoomController.listParticipants);

// Focus Session endpoints
router.route('/:roomId/focus/start')
  .post(validate(focusStartValidator), studyRoomController.startFocusSession);

router.route('/:roomId/focus/end')
  .post(validate(roomIdParamValidator), studyRoomController.endFocusSession);

router.route('/:roomId/focus/pause')
  .post(validate(roomIdParamValidator), studyRoomController.pauseFocusSession);

router.route('/:roomId/focus/resume')
  .post(validate(roomIdParamValidator), studyRoomController.resumeFocusSession);

router.route('/:roomId/focus/current')
  .get(validate(roomIdParamValidator), studyRoomController.getCurrentFocusSession);

// Goal endpoints
router.route('/:roomId/goals')
  .post(validate(goalCreateValidator), studyRoomController.createGoal)
  .get(validate(roomIdParamValidator), studyRoomController.listGoals);

router.route('/:roomId/goals/:goalId')
  .patch(validate(goalUpdateValidator), studyRoomController.updateGoal)
  .delete(validate(goalUpdateValidator), studyRoomController.deleteGoal);

router.route('/:roomId/goals/:goalId/complete')
  .post(validate(goalUpdateValidator), studyRoomController.completeGoal);

// Activity Timeline
router.route('/:roomId/timeline')
  .get(validate(roomIdParamValidator), studyRoomController.getActivityTimeline);

// Chat History & Moderation
router.route('/:roomId/chat')
  .get(validate(roomIdParamValidator), studyRoomController.getChatHistory);

router.route('/:roomId/chat/:chatId')
  .delete(validate(roomIdParamValidator), studyRoomController.deleteChatMessage);

export default router;
