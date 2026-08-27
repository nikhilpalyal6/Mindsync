import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomActivityLog from '../models/studyRoomActivityLog.model.js';
import { notifyRoomLifecycle } from '../realtime/studyRoom.socket.js';
import logger from '../../config/logger.js';

let intervalId = null;

export const reconcileScheduledRooms = async () => {
  try {
    const now = new Date();
    // Query scheduled rooms whose start time has reached or passed
    const overdueRooms = await StudyRoom.find({
      status: 'SCHEDULED',
      scheduledStart: { $lte: now }
    });

    if (overdueRooms.length > 0) {
      logger.info(`[SCHEDULER] Found ${overdueRooms.length} scheduled rooms overdue for auto-start.`);
      
      for (const room of overdueRooms) {
        room.status = 'LIVE';
        room.actualStart = now;
        await room.save();

        // Create starting activity log mapped to room host
        await StudyRoomActivityLog.create({
          room: room._id,
          user: room.host,
          eventType: 'ROOM_STARTED'
        });

        // Broadcast to clients
        notifyRoomLifecycle(room._id, 'LIVE');

        logger.info(`[SCHEDULER] Auto-started room "${room.title}" (${room._id}) successfully.`);
      }
    }
  } catch (err) {
    logger.error('[SCHEDULER] Error reconciling scheduled rooms:', err);
  }
};

export const reconcileActiveFocusSessions = async () => {
  try {
    const StudyRoomFocusSession = (await import('../models/studyRoomFocusSession.model.js')).default;
    const activeSessions = await StudyRoomFocusSession.find({ status: 'ACTIVE' });

    for (const session of activeSessions) {
      const startedAt = session.startedAt;
      const plannedDurationMs = session.plannedDuration * 60 * 1000;
      
      let totalPausedDuration = 0;
      for (const interval of session.pauseHistory || []) {
        const end = interval.resumedAt ? new Date(interval.resumedAt) : new Date();
        totalPausedDuration += end.getTime() - new Date(interval.pausedAt).getTime();
      }

      const elapsedMs = (Date.now() - new Date(startedAt).getTime()) - totalPausedDuration;
      if (elapsedMs >= plannedDurationMs) {
        session.status = 'COMPLETED';
        session.endedAt = new Date();
        session.actualDuration = session.plannedDuration;
        await session.save();

        const StudyRoomActivityLog = (await import('../models/studyRoomActivityLog.model.js')).default;
        await StudyRoomActivityLog.create({
          room: session.room,
          user: session.host,
          eventType: 'FOCUS_ENDED',
          metadata: { focusSessionId: session._id, actualDuration: session.actualDuration }
        });

        const { notifyFocusSession } = await import('../realtime/studyRoom.socket.js');
        notifyFocusSession(session.room, 'END', session);

        logger.info(`[SCHEDULER] Auto-ended expired focus session ${session._id} for room ${session.room}.`);
      }
    }
  } catch (err) {
    logger.error('[SCHEDULER] Error reconciling active focus sessions:', err);
  }
};

export const startRoomScheduler = () => {
  if (intervalId) {
    logger.warn('[SCHEDULER] Scheduler is already active.');
    return;
  }

  logger.info('[SCHEDULER] Initializing study rooms scheduled start reconciliation checker.');
  
  // Run immediate check for server restart recovery
  reconcileScheduledRooms();
  reconcileActiveFocusSessions();

  // Run periodic checks every 10 seconds
  intervalId = setInterval(async () => {
    await reconcileScheduledRooms();
    await reconcileActiveFocusSessions();
  }, 10000);
};

export const stopRoomScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[SCHEDULER] Scheduler stopped.');
  }
};
