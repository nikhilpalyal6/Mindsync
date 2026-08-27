import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';
import mongoose from 'mongoose';
import app from '../../app.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomFocusSession from '../models/studyRoomFocusSession.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import initStudyRoomRealtime from '../realtime/studyRoom.socket.js';
import { reconcileActiveFocusSessions } from '../utils/scheduler.js';

const PORT = 6098;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runFocusSyncTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 9: STUDY ROOMS FOCUS SYNC TESTS');
  console.log('====================================================');

  await connectDB();

  // Create mock HTTP server and mount WebSocket upgrades
  const server = http.createServer(app);
  initStudyRoomRealtime(server);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`✔ Focus test server listening on port ${PORT}`);

  // Create mock database users
  const hostUser = await User.create({
    name: 'Focus Host User',
    username: 'fhost_' + Math.random().toString(36).substring(2, 6),
    email: 'fhost_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'ADMIN',
    isActive: true
  });

  const studentUser = await User.create({
    name: 'Focus Student User',
    username: 'fstudent_' + Math.random().toString(36).substring(2, 6),
    email: 'fstudent_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'USER',
    isActive: true
  });

  const mockRoom = await StudyRoom.create({
    title: 'Focus Sync Test Room',
    capacity: 5,
    host: hostUser._id,
    status: 'LIVE'
  });

  await StudyRoomParticipant.create({
    room: mockRoom._id,
    user: hostUser._id,
    role: 'HOST',
    status: 'active'
  });

  await StudyRoomParticipant.create({
    room: mockRoom._id,
    user: studentUser._id,
    role: 'STUDENT',
    status: 'active'
  });

  const hostToken = generateAccessToken({ id: hostUser._id });
  const studentToken = generateAccessToken({ id: studentUser._id });

  async function apiRequest(path, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const data = await res.json();
    return { status: res.status, data };
  }

  try {
    // 1. Student attempts to start focus -> 403 Forbidden
    console.log('\n[Test 1] Student attempts to start focus...');
    const { status: s1 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/start`, 'POST', { plannedDuration: 25 }, studentToken);
    assert.strictEqual(s1, 403);
    console.log('✔ Correctly returned 403 Forbidden.');

    // 2. Host starts focus session -> 201 Created
    console.log('\n[Test 2] Host starts focus session...');
    const { status: s2, data: d2 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/start`, 'POST', { plannedDuration: 25 }, hostToken);
    assert.strictEqual(s2, 201);
    assert.strictEqual(d2.data.status, 'ACTIVE');
    assert.ok(d2.data.endsAt);
    assert.strictEqual(d2.data.plannedDuration, 25);
    console.log('✔ Focus session started successfully: status=ACTIVE, endsAt=' + d2.data.endsAt);

    // 3. Host starts duplicate focus session -> 409 Conflict
    console.log('\n[Test 3] Duplicate active focus session prevention...');
    const { status: s3 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/start`, 'POST', { plannedDuration: 15 }, hostToken);
    assert.strictEqual(s3, 409);
    console.log('✔ Correctly blocked duplicate session with 409 Conflict.');

    // 4. Student attempts to pause -> 403 Forbidden
    console.log('\n[Test 4] Student attempts to pause...');
    const { status: s4 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/pause`, 'POST', {}, studentToken);
    assert.strictEqual(s4, 403);
    console.log('✔ Correctly returned 403 Forbidden.');

    // 5. Host pauses active session -> 200 OK
    console.log('\n[Test 5] Host pauses focus session...');
    const { status: s5, data: d5 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/pause`, 'POST', {}, hostToken);
    assert.strictEqual(s5, 200);
    assert.strictEqual(d5.data.status, 'PAUSED');
    console.log('✔ Focus session paused successfully: status=PAUSED.');

    // 6. Student attempts to resume -> 403 Forbidden
    console.log('\n[Test 6] Student attempts to resume...');
    const { status: s6 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/resume`, 'POST', {}, studentToken);
    assert.strictEqual(s6, 403);
    console.log('✔ Correctly returned 403 Forbidden.');

    // 7. Host resumes focus session -> 200 OK
    console.log('\n[Test 7] Host resumes focus session...');
    const { status: s7, data: d7 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/resume`, 'POST', {}, hostToken);
    assert.strictEqual(s7, 200);
    assert.strictEqual(d7.data.status, 'ACTIVE');
    console.log('✔ Focus session resumed successfully: status=ACTIVE.');

    // 8. WebSocket late-join & ROOM_INIT_STATE rehydration
    console.log('\n[Test 8] WebSocket join state rehydration...');
    const ws = new WebSocket(`ws://localhost:${PORT}/api/v1/study-rooms/realtime?token=${studentToken}&roomId=${mockRoom._id}`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✔ WebSocket client connected.');
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_INIT_STATE') {
          assert.ok(msg.payload.focusSession);
          assert.strictEqual(msg.payload.focusSession.status, 'ACTIVE');
          assert.strictEqual(msg.payload.focusSession.plannedDuration, 25);
          console.log('✔ Rehydrated focus session status=ACTIVE on client connection.');
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });

    // 9. Host ends active session early -> 200 OK
    console.log('\n[Test 9] Host ends focus session...');
    const { status: s9, data: d9 } = await apiRequest(`/study-rooms/${mockRoom._id}/focus/end`, 'POST', {}, hostToken);
    assert.strictEqual(s9, 200);
    assert.strictEqual(d9.data.status, 'COMPLETED');
    console.log('✔ Focus session completed successfully.');

    // 10. Scheduler Expiry Check
    console.log('\n[Test 10] Scheduler expiry check...');
    const expiredSession = await StudyRoomFocusSession.create({
      room: mockRoom._id,
      host: hostUser._id,
      plannedDuration: 1,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 70 * 1000)
    });
    
    await reconcileActiveFocusSessions();

    const updatedSession = await StudyRoomFocusSession.findById(expiredSession._id);
    assert.strictEqual(updatedSession.status, 'COMPLETED');
    console.log('✔ Expired focus session automatically completed by scheduler.');

  } finally {
    server.close();
    await User.deleteMany({ _id: { $in: [hostUser._id, studentUser._id] } });
    await StudyRoom.deleteMany({ _id: mockRoom._id });
    await StudyRoomParticipant.deleteMany({ room: mockRoom._id });
    await StudyRoomFocusSession.deleteMany({ room: mockRoom._id });
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 9 FOCUS SYNC TESTS PASSED');
  console.log('====================================================');
}

runFocusSyncTests().catch(console.error);
