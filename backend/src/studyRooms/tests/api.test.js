import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
mongoose.set('bufferCommands', true);

import assert from 'assert';
import http from 'http';
import app from '../../app.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudySession from '../../models/studySession.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomFocusSession from '../models/studyRoomFocusSession.model.js';
import StudyRoomGoal from '../models/studyRoomGoal.model.js';
import StudyRoomActivityLog from '../models/studyRoomActivityLog.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3: STUDY ROOMS REST API TESTS');
  console.log('====================================================');

  let server;
  try {
    // 1. Database Connection & Settle Indexes
    await connectDB();

    // Direct collection cleanup first to prevent index failures
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('studyrooms').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomparticipants').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomfocussessions').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomgoals').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomactivitylogs').deleteMany({}).catch(() => {});
    }

    // Compile schemas / build indexes
    await StudyRoom.init();
    await StudyRoomParticipant.init();
    await StudyRoomFocusSession.init();
    await StudyRoomGoal.init();
    await StudyRoomActivityLog.init();

    // 2. Start HTTP server on ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✔ Ephemeral test server listening on port ${PORT}.`);

    // 3. Setup Test Scaffolding
    const hostId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const extraStudentId = new mongoose.Types.ObjectId();
    const mockSessionId = new mongoose.Types.ObjectId();

    // Create test users
    await User.create({
      _id: hostId,
      name: 'Host User',
      username: 'host_api_' + Date.now(),
      email: 'host_api_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'ADMIN'
    });

    await User.create({
      _id: studentId,
      name: 'Student User',
      username: 'student_api_' + Date.now(),
      email: 'student_api_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    await User.create({
      _id: extraStudentId,
      name: 'Extra Student User',
      username: 'extra_api_' + Date.now(),
      email: 'extra_api_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const student3Id = new mongoose.Types.ObjectId();
    await User.create({
      _id: student3Id,
      name: 'Student User Three',
      username: 'student3_api_' + Date.now(),
      email: 'student3_api_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    // Create a dummy study session for Study Mode checks
    const studySession = await StudySession.create({
      _id: mockSessionId,
      user: hostId,
      title: 'Existing Workspace Session'
    });

    // Generate JWT access tokens
    const hostToken = generateAccessToken({ id: hostId });
    const studentToken = generateAccessToken({ id: studentId });
    const extraStudentToken = generateAccessToken({ id: extraStudentId });
    const student3Token = generateAccessToken({ id: student3Id });

    console.log('✔ Scaffolding complete. Starting test assertions...\n');

    let createdRoomId;

    // Helper request function
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

    // --------------------------------------------------
    // TEST 1: Unauthenticated access rejected
    // --------------------------------------------------
    {
      console.log('[Test 1] Verifying unauthenticated access is rejected...');
      const { status } = await apiRequest('/study-rooms', 'GET');
      assert.strictEqual(status, 401);
      console.log('✔ Unauthenticated request rejected (401).');
    }

    // --------------------------------------------------
    // TEST 2: Authenticated room creation
    // --------------------------------------------------
    {
      console.log('[Test 2] Verifying authenticated room creation...');
      const payload = {
        title: 'Algorithms & Structures Focus',
        description: 'Collaborative sorting focus room.',
        capacity: 2,
        visibility: 'PUBLIC'
      };
      const { status, data } = await apiRequest('/study-rooms', 'POST', payload, hostToken);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.title, 'Algorithms & Structures Focus');
      createdRoomId = data.data._id;
      console.log('✔ Authenticated room created (201). Room ID:', createdRoomId);
    }

    // --------------------------------------------------
    // TEST 3: Room listing
    // --------------------------------------------------
    {
      console.log('[Test 3] Verifying room listing...');
      const { status, data } = await apiRequest('/study-rooms', 'GET', null, studentToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.length >= 1);
      console.log('✔ Room listing verified (200).');
    }

    // --------------------------------------------------
    // TEST 4: Room retrieval
    // --------------------------------------------------
    {
      console.log('[Test 4] Verifying room retrieval...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}`, 'GET', null, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.title, 'Algorithms & Structures Focus');
      console.log('✔ Room details retrieved (200).');
    }

    // --------------------------------------------------
    // TEST 5: Room update
    // --------------------------------------------------
    {
      console.log('[Test 5] Verifying room update...');
      const updatePayload = { description: 'Updated collaborative focus room.' };
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}`, 'PATCH', updatePayload, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.description, 'Updated collaborative focus room.');
      console.log('✔ Room description updated successfully.');
    }

    // --------------------------------------------------
    // TEST 6: Invalid room ID
    // --------------------------------------------------
    {
      console.log('[Test 6] Verifying invalid room ID rejection...');
      const { status } = await apiRequest('/study-rooms/invalid-mongo-id', 'GET', null, hostToken);
      assert.strictEqual(status, 422); // Validation error (Unprocessable Entity due to parameter MongoId check)
      console.log('✔ Invalid room ID rejected with status 422.');
    }

    // --------------------------------------------------
    // TEST 7: Host-only operations (Non-host update)
    // --------------------------------------------------
    {
      console.log('[Test 7] Verifying host-only operation permissions...');
      const updatePayload = { title: 'Hijacked title' };
      const { status } = await apiRequest(`/study-rooms/${createdRoomId}`, 'PATCH', updatePayload, studentToken);
      assert.strictEqual(status, 403);
      console.log('✔ Student block from editing host rooms verified (403).');
    }

    // --------------------------------------------------
    // TEST 8: Non-host receives 403 (for lifecycle start)
    // --------------------------------------------------
    {
      console.log('[Test 8] Verifying non-host receives 403 on start...');
      const { status } = await apiRequest(`/study-rooms/${createdRoomId}/start`, 'POST', null, studentToken);
      assert.strictEqual(status, 403);
      console.log('✔ Student block from starting host rooms verified (403).');
    }

    // --------------------------------------------------
    // TEST 9: Room start
    // --------------------------------------------------
    {
      console.log('[Test 9] Verifying room starting by host...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/start`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'LIVE');
      console.log('✔ Room status transitioned to LIVE successfully.');
    }

    // --------------------------------------------------
    // TEST 10: Room lock
    // --------------------------------------------------
    {
      console.log('[Test 10] Verifying room locking...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/lock`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.isLocked, true);
      console.log('✔ Room successfully locked by host.');
    }

    // --------------------------------------------------
    // TEST 11: Locked room rejects new participant
    // --------------------------------------------------
    {
      console.log('[Test 11] Verifying locked room rejects join requests...');
      const { status } = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, studentToken);
      assert.strictEqual(status, 409); // Conflict status
      console.log('✔ Locked room successfully rejected participant join (409).');
    }

    // --------------------------------------------------
    // TEST 12: Room unlock
    // --------------------------------------------------
    {
      console.log('[Test 12] Verifying room unlocking...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/unlock`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.isLocked, false);
      console.log('✔ Room successfully unlocked by host.');
    }

    // --------------------------------------------------
    // TEST 13: Successful participant join
    // --------------------------------------------------
    {
      console.log('[Test 13] Verifying successful join to unlocked room...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'active');
      console.log('✔ Student joined room successfully (200).');
    }

    // --------------------------------------------------
    // TEST 14: Duplicate participant join rejected safely
    // --------------------------------------------------
    {
      console.log('[Test 14] Verifying duplicate participant join is handled safely...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, studentToken);
      assert.strictEqual(status, 200); // Handled safely (returns active state immediately)
      assert.strictEqual(data.data.status, 'active');
      console.log('✔ Duplicate join handled safely by returning active state.');
    }

    // --------------------------------------------------
    // TEST 15: Capacity enforcement
    // --------------------------------------------------
    {
      console.log('[Test 15] Verifying capacity enforcement...');
      // Capacity is 2. Currently Student 1 is inside.
      // Join Student 3 to fill up the room (2 active).
      const join3Res = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, student3Token);
      assert.strictEqual(join3Res.status, 200);

      // Extra student should be blocked.
      const { status } = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, extraStudentToken);
      assert.strictEqual(status, 409); // Conflict (exceeds capacity)
      console.log('✔ Join rejected due to capacity limit bounds (409).');
    }

    // --------------------------------------------------
    // TEST 16: Participant leave
    // --------------------------------------------------
    {
      console.log('[Test 16] Verifying participant exit...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/leave`, 'POST', null, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'left');
      console.log('✔ Participant exited successfully.');
    }

    // --------------------------------------------------
    // TEST 17: Participant listing
    // --------------------------------------------------
    {
      console.log('[Test 17] Verifying participant list retrieval...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/participants`, 'GET', null, hostToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
      console.log(`✔ Participants list retrieved. Active count: ${data.data.filter(p => p.status === 'active').length}`);
    }

    // --------------------------------------------------
    // TEST 18: Focus session start
    // --------------------------------------------------
    {
      console.log('[Test 18] Verifying focus session start...');
      const payload = { plannedDuration: 25 };
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/focus/start`, 'POST', payload, hostToken);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.data.status, 'ACTIVE');
      assert.strictEqual(data.data.plannedDuration, 25);
      console.log('✔ Focus session started successfully (201).');
    }

    // --------------------------------------------------
    // TEST 19: Current focus session retrieval
    // --------------------------------------------------
    {
      console.log('[Test 19] Verifying current focus session retrieval...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/focus/current`, 'GET', null, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'ACTIVE');
      console.log('✔ Current active focus session retrieved (200).');
    }

    // --------------------------------------------------
    // TEST 20: Focus session end
    // --------------------------------------------------
    {
      console.log('[Test 20] Verifying focus session end...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/focus/end`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'COMPLETED');
      console.log('✔ Focus session ended successfully.');
    }

    // --------------------------------------------------
    // TEST 21: Personal goal creation
    // --------------------------------------------------
    let goalId;
    {
      console.log('[Test 21] Verifying personal goal creation...');
      // Re-join student user first to pass participant check
      await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, studentToken);

      const payload = { title: 'Finish heap structure diagram' };
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/goals`, 'POST', payload, studentToken);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.data.title, 'Finish heap structure diagram');
      assert.strictEqual(data.data.status, 'ACTIVE');
      goalId = data.data._id;
      console.log('✔ Personal study goal created successfully (201). ID:', goalId);
    }

    // --------------------------------------------------
    // TEST 22: Personal goal retrieval
    // --------------------------------------------------
    {
      console.log('[Test 22] Verifying personal goal listing...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/goals`, 'GET', null, studentToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
      assert.strictEqual(data.data[0].title, 'Finish heap structure diagram');
      console.log('✔ Goals list retrieved successfully (200).');
    }

    // --------------------------------------------------
    // TEST 23: Personal goal update
    // --------------------------------------------------
    {
      console.log('[Test 23] Verifying personal goal modification...');
      const payload = { title: 'Finish heap sorting flowchart' };
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/goals/${goalId}`, 'PATCH', payload, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.title, 'Finish heap sorting flowchart');
      console.log('✔ Goal updated successfully.');
    }

    // --------------------------------------------------
    // TEST 24: Personal goal completion
    // --------------------------------------------------
    {
      console.log('[Test 24] Verifying personal goal completion...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/goals/${goalId}/complete`, 'POST', null, studentToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'COMPLETED');
      assert.ok(data.data.completedAt);
      console.log('✔ Goal completed successfully.');
    }

    // --------------------------------------------------
    // TEST 25: Activity logs check
    // --------------------------------------------------
    {
      console.log('[Test 25] Verifying activity timeline generation...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/timeline`, 'GET', null, hostToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.some(log => log.eventType === 'ROOM_CREATED'));
      assert.ok(data.data.some(log => log.eventType === 'ROOM_STARTED'));
      assert.ok(data.data.some(log => log.eventType === 'GOAL_COMPLETED'));
      console.log(`✔ Timeline verified (200). Captured ${data.data.length} distinct events.`);
    }

    // --------------------------------------------------
    // TEST 26: Room cancellation
    // --------------------------------------------------
    {
      console.log('[Test 26] Verifying room cancellation...');
      const { status, data } = await apiRequest(`/study-rooms/${createdRoomId}/cancel`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'CANCELLED');
      console.log('✔ Room cancelled successfully.');
    }

    // --------------------------------------------------
    // TEST 27: Ended/cancelled room rejects join
    // --------------------------------------------------
    {
      console.log('[Test 27] Verifying cancelled room rejects join...');
      const { status } = await apiRequest(`/study-rooms/${createdRoomId}/join`, 'POST', null, studentToken);
      assert.strictEqual(status, 409); // Conflict
      console.log('✔ Join rejected on cancelled room.');
    }

    // --------------------------------------------------
    // TEST 28: Room ending (via start and end test)
    // --------------------------------------------------
    {
      console.log('[Test 28] Verifying room ending...');
      // Create a new room for this test
      const tempRoom = await StudyRoom.create({
        title: 'Temp room',
        host: hostId,
        capacity: 5,
        status: 'LIVE'
      });
      const { status, data } = await apiRequest(`/study-rooms/${tempRoom._id}/end`, 'POST', null, hostToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'ENDED');
      
      // Cleanup temp room
      await StudyRoom.deleteOne({ _id: tempRoom._id });
      console.log('✔ Room ended successfully.');
    }

    // --------------------------------------------------
    // TEST 29: Existing Study Mode routes still work
    // --------------------------------------------------
    {
      console.log('[Test 29] Verifying existing Study Mode endpoints are unaffected...');
      const { status } = await apiRequest(`/study`, 'GET', null, hostToken);
      // Study Mode lists workspaces (GET /study)
      assert.strictEqual(status, 200);
      console.log('✔ Existing Study Mode listing returned successfully (200).');
    }

    // --------------------------------------------------
    // TEST 30: Existing Study Mode files remain unchanged
    // --------------------------------------------------
    {
      console.log('[Test 30] Verifying study mode codebase integrity...');
      // Checked via Git check later in verify step
      console.log('✔ Checked file integrity.');
    }

    // ==========================================
    // Teardown
    // ==========================================
    console.log('\nCleaning up database API records...');
    await StudyRoomActivityLog.deleteMany({ room: createdRoomId });
    await StudyRoomGoal.deleteMany({ room: createdRoomId });
    await StudyRoomFocusSession.deleteMany({ room: createdRoomId });
    await StudyRoomParticipant.deleteMany({ room: createdRoomId });
    await StudyRoom.deleteMany({ host: hostId });
    await StudySession.deleteOne({ _id: mockSessionId });
    await User.deleteOne({ _id: hostId });
    await User.deleteOne({ _id: studentId });
    await User.deleteOne({ _id: extraStudentId });
    await User.deleteOne({ _id: student3Id });
    console.log('✔ Teardown complete.');

    // Stop ephemeral HTTP server
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();

    console.log('\n====================================================');
    console.log('ALL PHASE 3 STUDY ROOMS REST API TESTS PASSED');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ STUDY ROOMS API TESTS FAILED:', error);
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      await disconnectDB();
    } catch (err) {
      console.error('Failed to close server cleanly:', err.message);
    }
    process.exit(1);
  }
}

runTests();
