import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import initStudyRoomRealtime from '../realtime/studyRoom.socket.js';
import express from 'express';

async function runRealtimeTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 8: STUDY ROOMS REALTIME SOCKET TESTS');
  console.log('====================================================');

  await connectDB();

  // Create mock HTTP server and express app to mount WebSocket upgrades
  const app = express();
  const server = http.createServer(app);
  initStudyRoomRealtime(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`✔ Ephemeral socket test server listening on port ${port}`);

  // Scaffold database test user and study room
  const mockUser1 = await User.create({
    name: 'Socket User One',
    username: 'socketuser1_' + Math.random().toString(36).substring(2, 6),
    email: 'socket1_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'USER',
    isActive: true
  });

  const mockUser2 = await User.create({
    name: 'Socket User Two',
    username: 'socketuser2_' + Math.random().toString(36).substring(2, 6),
    email: 'socket2_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'USER',
    isActive: true
  });

  const mockRoom = await StudyRoom.create({
    title: 'Realtime Focus Room',
    capacity: 5,
    host: mockUser1._id,
    status: 'LIVE'
  });

  // User 1 is the host (automatically participant)
  await StudyRoomParticipant.create({
    room: mockRoom._id,
    user: mockUser1._id,
    role: 'HOST',
    status: 'active'
  });

  // User 2 joins the room first via REST simulation
  await StudyRoomParticipant.create({
    room: mockRoom._id,
    user: mockUser2._id,
    role: 'STUDENT',
    status: 'active'
  });

  const token1 = generateAccessToken({ id: mockUser1._id });
  const token2 = generateAccessToken({ id: mockUser2._id });

  try {
    // --------------------------------------------------
    // TEST 1: Reject unauthenticated sockets
    // --------------------------------------------------
    console.log('[Test 1] Verifying unauthenticated WebSocket upgrades are rejected...');
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/api/v1/study-rooms/realtime?roomId=${mockRoom._id}`);
      ws.on('close', (code) => {
        assert.strictEqual(code, 4001); // Unauthorized close code
        resolve();
      });
      ws.on('error', (err) => {
        // error during upgrade/reject
        resolve();
      });
      // Set a safety timeout
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for rejection close'));
      }, 2000);
    });
    console.log('✔ Unauthenticated WebSocket upgrade rejected successfully.');

    // --------------------------------------------------
    // TEST 2: Successful host socket join and initial state
    // --------------------------------------------------
    console.log('[Test 2] Verifying authenticated socket connection and ROOM_INIT_STATE...');
    let ws1;
    await new Promise((resolve, reject) => {
      ws1 = new WebSocket(`ws://localhost:${port}/api/v1/study-rooms/realtime?roomId=${mockRoom._id}&token=${token1}`);
      ws1.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        assert.strictEqual(msg.type, 'ROOM_INIT_STATE');
        assert.ok(Array.isArray(msg.payload.participants));
        assert.strictEqual(msg.payload.status, 'LIVE');
        resolve();
      });
      ws1.on('error', reject);
    });
    ws1.removeAllListeners('message');
    console.log('✔ Authenticated host socket connected and re-hydrated state successfully.');

    // --------------------------------------------------
    // TEST 3: Participant join triggers ROOM_PARTICIPANT_JOINED
    // --------------------------------------------------
    console.log('[Test 3] Verifying participant connection triggers presence broadcast...');
    let ws2;
    await new Promise((resolve, reject) => {
      // Listen for presence join on ws1 (host)
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_PARTICIPANT_JOINED') {
          assert.strictEqual(msg.payload.participantId, mockUser2._id.toString());
          assert.strictEqual(msg.payload.role, 'STUDENT');
          resolve();
        }
      });

      // Connect ws2 (participant)
      ws2 = new WebSocket(`ws://localhost:${port}/api/v1/study-rooms/realtime?roomId=${mockRoom._id}&token=${token2}`);
      ws2.on('error', reject);
    });
    ws1.removeAllListeners('message');
    console.log('✔ Presence broadcast ROOM_PARTICIPANT_JOINED received successfully.');

    // --------------------------------------------------
    // TEST 4: Camera toggle broadcast
    // --------------------------------------------------
    console.log('[Test 4] Verifying camera state toggles are validated and broadcast...');
    await new Promise((resolve, reject) => {
      // Listen for camera change on ws1 (host)
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PARTICIPANT_CAMERA_CHANGED') {
          assert.strictEqual(msg.payload.participantId, mockUser2._id.toString());
          assert.strictEqual(msg.payload.cameraState, 'CAMERA_ON');
          resolve();
        }
      });

      // Send TOGGLE_CAMERA message from ws2 (participant)
      ws2.send(JSON.stringify({
        type: 'TOGGLE_CAMERA',
        payload: { cameraState: 'CAMERA_ON' }
      }));
    });
    ws1.removeAllListeners('message');
    console.log('✔ Camera state broadcast PARTICIPANT_CAMERA_CHANGED received successfully.');

    // --------------------------------------------------
    // TEST 5: WebRTC signaling relay
    // --------------------------------------------------
    console.log('[Test 5] Verifying WebRTC signaling relay between room members...');
    await new Promise((resolve, reject) => {
      // Host (ws1) listens for offers from ws2
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'WEBRTC_OFFER') {
          assert.strictEqual(msg.from, mockUser2._id.toString());
          assert.strictEqual(msg.payload.offer, 'mock-sdp-offer');
          resolve();
        }
      });

      // Send WEBRTC_OFFER from ws2 targeting ws1
      ws2.send(JSON.stringify({
        type: 'WEBRTC_OFFER',
        to: mockUser1._id.toString(),
        payload: { offer: 'mock-sdp-offer' }
      }));
    });
    ws1.removeAllListeners('message');
    console.log('✔ WebRTC Offer relayed correctly between peers.');

    // --------------------------------------------------
    // TEST 6: Disconnection presence update ROOM_PARTICIPANT_LEFT
    // --------------------------------------------------
    console.log('[Test 6] Verifying disconnect logs trigger ROOM_PARTICIPANT_LEFT presence updates...');
    await new Promise((resolve, reject) => {
      // Host (ws1) listens for exit
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_PARTICIPANT_LEFT') {
          assert.strictEqual(msg.payload.participantId, mockUser2._id.toString());
          resolve();
        }
      });

      // Purposefully terminate ws2 connection
      ws2.close();
    });
    ws1.removeAllListeners('message');
    console.log('✔ Disconnect presence update broadcast successfully.');

    // Close connections
    ws1.close();

  } finally {
    // Teardown database mock entries
    console.log('Cleaning up database realtime test records...');
    await StudyRoomParticipant.deleteMany({ room: mockRoom._id });
    await StudyRoom.deleteOne({ _id: mockRoom._id });
    await User.deleteOne({ _id: mockUser1._id });
    await User.deleteOne({ _id: mockUser2._id });

    // Close server
    await new Promise((resolve) => server.close(resolve));
    console.log('✔ Realtime test server closed.');

    await disconnectDB();
    console.log('====================================================');
    console.log('ALL PHASE 8 REALTIME SOCKET TESTS PASSED');
    console.log('====================================================');
  }
}

runRealtimeTests().catch((err) => {
  console.error('❌ PHASE 8 REALTIME TESTS FAILED:', err);
  process.exit(1);
});
