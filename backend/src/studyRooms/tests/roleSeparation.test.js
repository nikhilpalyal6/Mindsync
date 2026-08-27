import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
mongoose.set('bufferCommands', true);

import assert from 'assert';
import http from 'http';
import app from '../../app.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';

const PORT = 5098;

async function apiRequest(path, method = 'GET', body = null, token = null) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${PORT}/api/v1${path}`,
      { method, headers },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const data = rawData ? JSON.parse(rawData) : null;
            resolve({ status: res.statusCode, data });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${rawData}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 11: STUDY ROOMS ROLE SEPARATION TESTS');
  console.log('====================================================');

  let server;
  try {
    await connectDB();

    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('studyrooms').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomparticipants').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomfocussessions').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomgoals').deleteMany({}).catch(() => {});
    }

    await StudyRoom.init();
    await StudyRoomParticipant.init();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✔ Ephemeral role separation test server listening on port ${PORT}.`);

    // Scaffolding users
    const adminId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();

    await User.create({
      _id: adminId,
      name: 'Admin Moderator',
      username: 'admin_role_' + Date.now(),
      email: 'admin_role_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'ADMIN'
    });

    await User.create({
      _id: studentId,
      name: 'Student Participant',
      username: 'student_role_' + Date.now(),
      email: 'student_role_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const adminToken = generateAccessToken({ id: adminId });
    const studentToken = generateAccessToken({ id: studentId });

    // Create a live study room
    const room = await StudyRoom.create({
      title: 'DSA Live Study Group',
      host: adminId,
      status: 'LIVE',
      capacity: 10
    });

    const roomId = room._id;

    // Test 1: Student joins (API check)
    console.log('[Test 1] Student joins study room...');
    const joinStudentRes = await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, studentToken);
    assert.strictEqual(joinStudentRes.status, 200);
    
    // Test 2: Check database seat record for student
    console.log('[Test 2] Verifying database seat record for Student...');
    const studentSeat = await StudyRoomParticipant.findOne({ room: roomId, user: studentId });
    assert.ok(studentSeat);
    assert.strictEqual(studentSeat.role, 'STUDENT');
    assert.strictEqual(studentSeat.status, 'active');
    console.log('✔ Student record successfully verified.');

    // Test 3: Admin joins (API check)
    console.log('[Test 3] Admin joins study room...');
    const joinAdminRes = await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, adminToken);
    assert.strictEqual(joinAdminRes.status, 200);
    assert.strictEqual(joinAdminRes.data.data.role, 'ADMIN');

    // Test 4: Check database seat record for Admin (Admin must NOT create database seat record)
    console.log('[Test 4] Verifying database seat exclusion for Admin...');
    const adminSeat = await StudyRoomParticipant.findOne({ room: roomId, user: adminId });
    assert.strictEqual(adminSeat, null);
    console.log('✔ Admin correctly has NO database seat record.');

    // Test 5: Fetch participants list (listParticipants)
    console.log('[Test 5] Fetching participants list...');
    const listRes = await apiRequest(`/study-rooms/${roomId}/participants`, 'GET', null, studentToken);
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.data));
    const activeSeats = listRes.data.data;
    assert.strictEqual(activeSeats.length, 1);
    assert.strictEqual(activeSeats[0].user._id.toString(), studentId.toString());
    console.log('✔ Participants list correctly excludes Admin moderator.');

    // Test 6: Student tries to lock room (expect 403 Forbidden)
    console.log('[Test 6] Student tries to lock room (expect 403)...');
    const studentLockRes = await apiRequest(`/study-rooms/${roomId}/lock`, 'POST', null, studentToken);
    assert.strictEqual(studentLockRes.status, 403);
    console.log('✔ Blocked non-moderator lock action successfully.');

    // Test 7: Student tries to start focus (expect 403 Forbidden)
    console.log('[Test 7] Student tries to start focus session (expect 403)...');
    const studentFocusRes = await apiRequest(`/study-rooms/${roomId}/focus/start`, 'POST', { plannedDuration: 25 }, studentToken);
    assert.strictEqual(studentFocusRes.status, 403);
    console.log('✔ Blocked non-moderator focus action successfully.');

    // Test 8: Admin locks room (expect 200 OK)
    console.log('[Test 8] Admin locks room (expect 200)...');
    const adminLockRes = await apiRequest(`/study-rooms/${roomId}/lock`, 'POST', null, adminToken);
    assert.strictEqual(adminLockRes.status, 200);
    console.log('✔ Admin lock request succeeded.');

    // Test 9: Admin starts focus session (expect 201 Created)
    console.log('[Test 9] Admin starts focus session (expect 201)...');
    const adminFocusRes = await apiRequest(`/study-rooms/${roomId}/focus/start`, 'POST', { plannedDuration: 25 }, adminToken);
    assert.strictEqual(adminFocusRes.status, 201);
    console.log('✔ Admin focus session start succeeded.');

    console.log('\nCleaning up role separation database test records...');
    await User.deleteMany({ _id: { $in: [adminId, studentId] } });
    await StudyRoom.deleteMany({ _id: roomId });
    await StudyRoomParticipant.deleteMany({ room: roomId });

    console.log('✔ Cleanup complete.');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
    console.log('====================================================');
    console.log('ALL PHASE 11 ROLE SEPARATION TESTS PASSED');
    console.log('====================================================');
    process.exit(0);
  }
}

runTests();
