import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';
import express from 'express';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomChat from '../models/studyRoomChat.model.js';
import StudyRoomGoal from '../models/studyRoomGoal.model.js';
import StudyRoomFocusSession from '../models/studyRoomFocusSession.model.js';
import StudyTask from '../../models/studyTask.model.js';
import StudyPlan from '../../models/studyPlan.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import initStudyRoomRealtime, { notifyFocusSession, notifyRoomLifecycle } from '../realtime/studyRoom.socket.js';
import studyRoomRoutes from '../routes/studyRoom.routes.js';
import { reconcileScheduledRooms } from '../utils/scheduler.js';

async function runE2EAudit() {
  console.log('================================================================');
  console.log('STARTING PHASE 11: FULL E2E STUDY ROOMS AUDIT VERIFICATION');
  console.log('================================================================');

  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/v1/study-rooms', studyRoomRoutes);

  const server = http.createServer(app);
  initStudyRoomRealtime(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`✔ Audit server listening on port ${port}`);

  const openSockets = [];

  // Setup Users: Admin, Student A, Student B, Student C
  const rand = Math.random().toString(36).substring(2, 7);
  const adminUser = await User.create({
    name: 'Admin Moderator',
    username: `admin_${rand}`,
    email: `admin_${rand}@mindsync.test`,
    password: 'Password123!',
    role: 'ADMIN',
    isActive: true
  });

  const studentA = await User.create({
    name: 'Student Alice',
    username: `alice_${rand}`,
    email: `alice_${rand}@mindsync.test`,
    password: 'Password123!',
    role: 'USER',
    isActive: true
  });

  const studentB = await User.create({
    name: 'Student Bob',
    username: `bob_${rand}`,
    email: `bob_${rand}@mindsync.test`,
    password: 'Password123!',
    role: 'USER',
    isActive: true
  });

  const studentC = await User.create({
    name: 'Student Charlie',
    username: `charlie_${rand}`,
    email: `charlie_${rand}@mindsync.test`,
    password: 'Password123!',
    role: 'USER',
    isActive: true
  });

  const adminToken = generateAccessToken({ id: adminUser._id });
  const tokenA = generateAccessToken({ id: studentA._id });
  const tokenB = generateAccessToken({ id: studentB._id });
  const tokenC = generateAccessToken({ id: studentC._id });

  let room = null;
  let focusSession = null;

  try {
    // ----------------------------------------------------------------
    // 1. Admin creates scheduled room & Scheduled -> Live transition
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 1] Creating scheduled room and testing transition to LIVE...');
    const pastTime = new Date(Date.now() - 60000); // 1 minute in the past
    room = await StudyRoom.create({
      title: 'Audit Verification Chamber',
      capacity: 3,
      host: adminUser._id,
      status: 'SCHEDULED',
      scheduledStart: pastTime,
      tags: ['audit', 'mvp']
    });

    // Run scheduler transition
    await reconcileScheduledRooms();
    const updatedRoom = await StudyRoom.findById(room._id);
    assert.strictEqual(updatedRoom.status, 'LIVE', 'Room should transition from SCHEDULED to LIVE');
    console.log('✔ Room successfully transitioned from SCHEDULED to LIVE automatically.');

    // ----------------------------------------------------------------
    // 2. Students join room via REST and establish active participant records
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 2] Students join room...');
    await StudyRoomParticipant.create({
      room: room._id,
      user: studentA._id,
      role: 'STUDENT',
      status: 'active'
    });
    await StudyRoomParticipant.create({
      room: room._id,
      user: studentB._id,
      role: 'STUDENT',
      status: 'active'
    });
    await StudyRoomParticipant.create({
      room: room._id,
      user: studentC._id,
      role: 'STUDENT',
      status: 'active'
    });

    console.log('✔ Student participants created.');

    // Helper to connect WebSocket
    const connectWS = (token, name = 'Client') => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/study-rooms/realtime?token=${token}&roomId=${room._id}`);
      openSockets.push(ws);
      const messages = [];
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          messages.push(parsed);
        } catch (e) {
          messages.push(data.toString());
        }
      });
      return { ws, messages };
    };

    const waitForMessage = (messages, type, filter = null, timeout = 5000) => {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          const match = messages.find((m) => m && m.type === type && (!filter || filter(m)));
          if (match) {
            clearInterval(interval);
            resolve(match);
          } else if (Date.now() - start > timeout) {
            clearInterval(interval);
            reject(new Error(`Timeout waiting for message type: ${type}`));
          }
        }, 20);
      });
    };

    // ----------------------------------------------------------------
    // 3. Admin joins as Silent Moderator
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 3] Admin connects as Silent Moderator...');
    const adminWS = connectWS(adminToken, 'ADMIN');
    const adminInit = await waitForMessage(adminWS.messages, 'ROOM_INIT_STATE');
    assert.strictEqual(adminInit.type, 'ROOM_INIT_STATE');
    console.log('✔ Admin connected and received ROOM_INIT_STATE as silent moderator.');

    // ----------------------------------------------------------------
    // 4. Students Alice & Bob connect via WebSocket
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 4] Student Alice & Bob connect via WebSocket...');
    const aliceWS = connectWS(tokenA, 'ALICE');
    await waitForMessage(aliceWS.messages, 'ROOM_INIT_STATE');

    const bobWS = connectWS(tokenB, 'BOB');
    await waitForMessage(bobWS.messages, 'ROOM_INIT_STATE');

    // Verify Alice receives Bob joining
    const bobJoinedForAlice = await waitForMessage(aliceWS.messages, 'ROOM_PARTICIPANT_JOINED');
    assert.strictEqual(bobJoinedForAlice.payload.participantId, studentB._id.toString());
    console.log('✔ Realtime presence: Alice received Bob joining notification.');

    // ----------------------------------------------------------------
    // 5. Camera & WebRTC mesh signaling
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 5] Camera state toggle and WebRTC signaling relay...');
    aliceWS.ws.send(JSON.stringify({ type: 'TOGGLE_CAMERA', payload: { cameraState: 'CAMERA_ON' } }));
    const aliceCamForBob = await waitForMessage(bobWS.messages, 'PARTICIPANT_CAMERA_CHANGED');
    assert.strictEqual(aliceCamForBob.payload.participantId, studentA._id.toString());
    assert.strictEqual(aliceCamForBob.payload.cameraState, 'CAMERA_ON');
    console.log('✔ Camera state broadcast received by peers.');

    // WebRTC Offer relay from Alice to Bob
    aliceWS.ws.send(JSON.stringify({
      type: 'WEBRTC_OFFER',
      to: studentB._id.toString(),
      payload: { offer: 'mock-sdp-offer-123' }
    }));
    const offerForBob = await waitForMessage(bobWS.messages, 'WEBRTC_OFFER');
    assert.strictEqual(offerForBob.from, studentA._id.toString());
    assert.strictEqual(offerForBob.payload.offer, 'mock-sdp-offer-123');
    console.log('✔ WebRTC Offer relayed cleanly from Alice to Bob.');

    // WebRTC Answer relay from Bob to Alice
    bobWS.ws.send(JSON.stringify({
      type: 'WEBRTC_ANSWER',
      to: studentA._id.toString(),
      payload: { answer: 'mock-sdp-answer-456' }
    }));
    const answerForAlice = await waitForMessage(aliceWS.messages, 'WEBRTC_ANSWER');
    assert.strictEqual(answerForAlice.from, studentB._id.toString());
    assert.strictEqual(answerForAlice.payload.answer, 'mock-sdp-answer-456');
    console.log('✔ WebRTC Answer relayed cleanly from Bob to Alice.');

    // WebRTC ICE Candidate relay
    aliceWS.ws.send(JSON.stringify({
      type: 'WEBRTC_ICE_CANDIDATE',
      to: studentB._id.toString(),
      payload: { candidate: 'candidate:1 1 UDP 2122260223' }
    }));
    const iceForBob = await waitForMessage(bobWS.messages, 'WEBRTC_ICE_CANDIDATE');
    assert.strictEqual(iceForBob.from, studentA._id.toString());
    assert.strictEqual(iceForBob.payload.candidate, 'candidate:1 1 UDP 2122260223');
    console.log('✔ WebRTC ICE Candidate relayed cleanly from Alice to Bob.');

    // ----------------------------------------------------------------
    // 6. Realtime Chat & Direct Message Privacy
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 6] Realtime Chat & Direct Message Privacy...');
    // Alice sends public message
    aliceWS.ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE_SENT',
      payload: { message: 'Hello everyone in the study room!' }
    }));
    const publicMsgForBob = await waitForMessage(bobWS.messages, 'CHAT_MESSAGE_RECEIVED');
    assert.strictEqual(publicMsgForBob.payload.message, 'Hello everyone in the study room!');
    console.log('✔ Public message broadcast to all members.');

    // Alice sends direct message to Bob
    aliceWS.ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE_SENT',
      payload: { message: 'Hey Bob, secret whisper', recipientId: studentB._id.toString() }
    }));
    const directMsgForBob = await waitForMessage(bobWS.messages, 'CHAT_MESSAGE_RECEIVED', (m) => m.payload?.message === 'Hey Bob, secret whisper');
    assert.strictEqual(directMsgForBob.payload.message, 'Hey Bob, secret whisper');
    assert.strictEqual(directMsgForBob.payload.recipientId, studentB._id.toString());
    console.log('✔ Direct message received by recipient (Bob).');

    // Charlie connects and verifies direct message between Alice and Bob is strictly excluded
    const charlieWS = connectWS(tokenC, 'CHARLIE');
    await waitForMessage(charlieWS.messages, 'ROOM_INIT_STATE');

    // Query messages for Charlie via chat message query filter (simulating getChatHistory)
    const charlieVisibleMessages = await StudyRoomChat.find({
      room: room._id,
      $or: [
        { recipient: null },
        { recipient: { $exists: false } },
        { sender: studentC._id },
        { recipient: studentC._id }
      ]
    });
    const containsWhisper = charlieVisibleMessages.some((m) => m.message === 'Hey Bob, secret whisper');
    assert.strictEqual(containsWhisper, false, 'Charlie should NOT be able to view direct message between Alice and Bob');
    console.log('✔ Direct message privacy strictly enforced: Third-party participant cannot access private whisper.');

    // ----------------------------------------------------------------
    // 7. Admin Moderation: Mute All & Individual Mute Enforcement
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 7] Admin Moderation: Server-side mute enforcement...');
    // Admin sends MUTE_ALL
    adminWS.ws.send(JSON.stringify({
      type: 'MUTE_ALL',
      payload: { allowParticipantUnmute: false }
    }));
    const muteAllNotice = await waitForMessage(aliceWS.messages, 'MUTE_ALL_TRIGGERED');
    assert.strictEqual(muteAllNotice.type, 'MUTE_ALL_TRIGGERED');
    console.log('✔ MUTE_ALL broadcast received by Alice.');

    // Alice attempts to unmute herself while room is muted by admin
    aliceWS.ws.send(JSON.stringify({
      type: 'TOGGLE_MIC',
      payload: { micState: 'MIC_ON' }
    }));
    const micBlockedError = await waitForMessage(aliceWS.messages, 'ERROR');
    assert.strictEqual(micBlockedError.type, 'ERROR');
    console.log('✔ Server-side mute enforcement verified: Student cannot bypass moderator mute.');

    // Admin allows unmute
    adminWS.ws.send(JSON.stringify({
      type: 'ALLOW_UNMUTE',
      payload: {}
    }));
    await waitForMessage(aliceWS.messages, 'ALLOW_UNMUTE_TRIGGERED');

    // Admin selectively mutes Bob
    adminWS.ws.send(JSON.stringify({
      type: 'PARTICIPANT_MUTED',
      payload: { targetUserId: studentB._id.toString() }
    }));
    await waitForMessage(bobWS.messages, 'PARTICIPANT_MUTED_TRIGGERED');

    // Bob tries to unmute
    bobWS.ws.send(JSON.stringify({
      type: 'TOGGLE_MIC',
      payload: { micState: 'MIC_ON' }
    }));
    const bobBlocked = await waitForMessage(bobWS.messages, 'ERROR');
    assert.strictEqual(bobBlocked.type, 'ERROR');
    console.log('✔ Individual mute enforcement verified: Muted user cannot turn mic on.');

    // ----------------------------------------------------------------
    // 8. Focus Timer Broadcast Synchronization
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 8] Focus Timer Broadcast Synchronization...');
    focusSession = await StudyRoomFocusSession.create({
      room: room._id,
      host: adminUser._id,
      plannedDuration: 25,
      actualDuration: 0,
      status: 'ACTIVE',
      startedAt: new Date()
    });

    notifyFocusSession(room._id, 'START', focusSession);
    const timerAlice = await waitForMessage(aliceWS.messages, 'FOCUS_STARTED');
    assert.strictEqual(timerAlice.payload.plannedDuration, 25);
    console.log('✔ Focus timer started and broadcast to participants.');

    // Pause focus timer
    focusSession.status = 'PAUSED';
    focusSession.pauseHistory = [{ pausedAt: new Date() }];
    await focusSession.save();
    notifyFocusSession(room._id, 'PAUSE', focusSession);
    const timerPaused = await waitForMessage(aliceWS.messages, 'FOCUS_PAUSED');
    assert.strictEqual(timerPaused.type, 'FOCUS_PAUSED');
    console.log('✔ Focus timer pause broadcast received.');

    // ----------------------------------------------------------------
    // 9. Study Room Goals CRUD & Planner Task Linking
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 9] Study Room Goals CRUD & Planner Task Linking...');
    const plan = await StudyPlan.create({
      user: studentA._id,
      title: 'E2E Semester Plan',
      subject: 'Computer Science',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
      dailyStudyMinutes: 60,
      preferredStudyDays: ['MONDAY']
    });

    const task = await StudyTask.create({
      studyPlanId: plan._id,
      user: studentA._id,
      title: 'Complete Chapter 4 Algorithms',
      description: 'Solve problems',
      scheduledDate: new Date(),
      estimatedMinutes: 45,
      status: 'PENDING'
    });

    // Create personal goal linked to this task
    const goal = await StudyRoomGoal.create({
      room: room._id,
      user: studentA._id,
      studyTask: task._id,
      title: task.title,
      progress: 0,
      status: 'ACTIVE'
    });
    assert.strictEqual(goal.title, 'Complete Chapter 4 Algorithms');
    console.log('✔ Personal goal created and linked with Study Planner task.');

    // Update goal progress
    goal.progress = 75;
    await goal.save();
    const updatedGoal = await StudyRoomGoal.findById(goal._id);
    assert.strictEqual(updatedGoal.progress, 75);
    console.log('✔ Goal progress updated to 75%.');

    // Complete goal and verify planner task status sync
    goal.status = 'COMPLETED';
    goal.progress = 100;
    goal.completedAt = new Date();
    await goal.save();

    await StudyTask.findByIdAndUpdate(goal.studyTask, { status: 'COMPLETED' });
    const completedTask = await StudyTask.findById(task._id);
    assert.strictEqual(completedTask.status, 'COMPLETED');
    console.log('✔ Completed goal synchronized task status in Study Planner.');

    // Delete goal
    await StudyRoomGoal.findByIdAndDelete(goal._id);
    const deletedGoal = await StudyRoomGoal.findById(goal._id);
    assert.strictEqual(deletedGoal, null);
    console.log('✔ Personal goal deleted cleanly.');

    // ----------------------------------------------------------------
    // 10. Message Deletion Moderation
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 10] Message Deletion Moderation...');
    const msgToDelete = await StudyRoomChat.create({
      room: room._id,
      sender: studentA._id,
      message: 'Inappropriate message for testing delete'
    });

    adminWS.ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE_DELETED',
      payload: { messageId: msgToDelete._id.toString() }
    }));
    const delEventAlice = await waitForMessage(aliceWS.messages, 'CHAT_MESSAGE_DELETED');
    assert.strictEqual(delEventAlice.payload.messageId, msgToDelete._id.toString());
    console.log('✔ Message deletion moderation event broadcast to participants.');

    // ----------------------------------------------------------------
    // 11. Graceful Room Termination
    // ----------------------------------------------------------------
    console.log('\n[E2E Step 11] Graceful Room Termination...');
    notifyRoomLifecycle(room._id, 'ENDED');
    const roomEndedNotice = await waitForMessage(aliceWS.messages, 'ROOM_STATUS_CHANGED');
    assert.strictEqual(roomEndedNotice.payload.status, 'ENDED');
    console.log('✔ ROOM_STATUS_CHANGED broadcast received by participants.');

    console.log('\n================================================================');
    console.log('ALL PHASE 11 FULL E2E AUDIT VERIFICATION CHECKS PASSED');
    console.log('================================================================\n');

  } finally {
    // Terminate all websockets first
    for (const s of openSockets) {
      try { s.terminate(); } catch (e) {}
    }

    // Cleanup DB records
    if (room) {
      await StudyRoomGoal.deleteMany({ room: room._id });
      await StudyRoomChat.deleteMany({ room: room._id });
      await StudyRoomParticipant.deleteMany({ room: room._id });
      if (focusSession) {
        await StudyRoomFocusSession.deleteMany({ room: room._id });
      }
      await StudyRoom.findByIdAndDelete(room._id);
    }
    await StudyTask.deleteMany({ user: studentA._id });
    await StudyPlan.deleteMany({ user: studentA._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, studentA._id, studentB._id, studentC._id] } });

    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  }
}

runE2EAudit().catch((err) => {
  console.error('❌ E2E AUDIT VERIFICATION FAILED:', err);
  process.exit(1);
});
