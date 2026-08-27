import assert from 'assert';
import mongoose from 'mongoose';
import app from '../../app.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyPlan from '../../models/studyPlan.model.js';
import StudyTask from '../../models/studyTask.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomGoal from '../models/studyRoomGoal.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';

const PORT = 6099;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runPlannerIntegrationTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 10: STUDY PLANNER INTEGRATION TESTS');
  console.log('====================================================');

  await connectDB();

  const server = app.listen(PORT);
  console.log(`✔ Test server listening on port ${PORT}`);

  // Create mock DB documents
  const studentUser1 = await User.create({
    name: 'Student User One',
    username: 'suser1_' + Math.random().toString(36).substring(2, 6),
    email: 'suser1_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'USER',
    isActive: true
  });

  const studentUser2 = await User.create({
    name: 'Student User Two',
    username: 'suser2_' + Math.random().toString(36).substring(2, 6),
    email: 'suser2_' + Math.random().toString(36).substring(2, 6) + '@mindsync.test',
    password: 'password123',
    role: 'USER',
    isActive: true
  });

  const mockRoom = await StudyRoom.create({
    title: 'Integration Test Room',
    capacity: 5,
    host: studentUser1._id,
    status: 'LIVE'
  });

  await StudyRoomParticipant.create({
    room: mockRoom._id,
    user: studentUser1._id,
    role: 'HOST',
    status: 'active'
  });

  // Create Study Plan for User 1
  const mockPlan1 = await StudyPlan.create({
    user: studentUser1._id,
    title: 'DSA Study Plan',
    subject: 'DSA',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 7),
    dailyStudyMinutes: 60,
    preferredStudyDays: ['MONDAY']
  });

  // Create Study Tasks for User 1
  const pendingTask = await StudyTask.create({
    user: studentUser1._id,
    studyPlanId: mockPlan1._id,
    title: 'Leetcode Binary Tree Problems',
    description: 'Solve Leetcode 94 & 102',
    scheduledDate: new Date(),
    estimatedMinutes: 45,
    status: 'PENDING'
  });

  const completedTask = await StudyTask.create({
    user: studentUser1._id,
    studyPlanId: mockPlan1._id,
    title: 'Arrays revision',
    description: 'Revise two-pointer technique',
    scheduledDate: new Date(),
    estimatedMinutes: 30,
    status: 'COMPLETED',
    completedAt: new Date()
  });

  // Create Study Task for User 2
  const mockPlan2 = await StudyPlan.create({
    user: studentUser2._id,
    title: 'DBMS Study Plan',
    subject: 'DBMS',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 7),
    dailyStudyMinutes: 60,
    preferredStudyDays: ['MONDAY']
  });

  const user2Task = await StudyTask.create({
    user: studentUser2._id,
    studyPlanId: mockPlan2._id,
    title: 'SQL Normalization problems',
    scheduledDate: new Date(),
    estimatedMinutes: 60,
    status: 'PENDING'
  });

  const token1 = generateAccessToken({ id: studentUser1._id });
  const token2 = generateAccessToken({ id: studentUser2._id });

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
    // 1. Fetch pending tasks -> Returns only pending tasks
    console.log('\n[Test 1] Fetching pending study tasks...');
    const { status: s1, data: d1 } = await apiRequest('/study-tasks/pending', 'GET', null, token1);
    assert.strictEqual(s1, 200);
    assert.ok(d1.data.tasks);
    assert.ok(d1.data.tasks.some(t => t._id === pendingTask._id.toString()));
    assert.ok(!d1.data.tasks.some(t => t._id === completedTask._id.toString()));
    console.log('✔ Correctly returned only pending/in-progress tasks.');

    // 2. Link a task to a room goal -> 201 Created
    console.log('\n[Test 2] Creating personal goal linked to own task...');
    const { status: s2, data: d2 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'POST', {
      title: pendingTask.title,
      description: pendingTask.description,
      studyTaskId: pendingTask._id
    }, token1);
    assert.strictEqual(s2, 201);
    assert.strictEqual(d2.data.studyTask, pendingTask._id.toString());
    console.log('✔ Linked studyTask reference correctly established.');

    // 3. Link another user's task -> 404 Not Found (or Forbidden)
    console.log('\n[Test 3] Attempting to link unauthorized task...');
    const { status: s3 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'POST', {
      title: 'Hacked task',
      studyTaskId: user2Task._id
    }, token1);
    assert.strictEqual(s3, 404);
    console.log('✔ Successfully blocked unauthorized task linking.');

    // 4. Link an already completed task -> 409 Conflict
    console.log('\n[Test 4] Attempting to link already completed task...');
    const { status: s4 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'POST', {
      title: completedTask.title,
      studyTaskId: completedTask._id
    }, token1);
    assert.strictEqual(s4, 409);
    console.log('✔ Correctly blocked completed task linking.');

    // 5. Prevent duplicate links in same room -> Returns existing goal
    console.log('\n[Test 5] Checking duplicate linking prevention...');
    const { status: s5, data: d5 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'POST', {
      title: pendingTask.title,
      studyTaskId: pendingTask._id
    }, token1);
    assert.strictEqual(s5, 201); // Or 200/201 depending on reuse response
    assert.strictEqual(d5.data._id, d2.data._id);
    console.log('✔ Duplicate prevention checks passed (returned existing goal record).');

    // 6. Complete personal goal -> Auto-completes originating planner task
    console.log('\n[Test 6] Completing goal & checking planner synchronization...');
    const { status: s6 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals/${d2.data._id}/complete`, 'POST', {}, token1);
    assert.strictEqual(s6, 200);

    const updatedTask = await StudyTask.findById(pendingTask._id);
    assert.strictEqual(updatedTask.status, 'COMPLETED');
    assert.ok(updatedTask.completedAt);
    console.log('✔ Planner task status updated automatically to COMPLETED.');

    // 7. Deleted task resilience
    console.log('\n[Test 7] Verifying deleted task resilience...');
    // Create new goal with a task reference
    const tempTask = await StudyTask.create({
      user: studentUser1._id,
      studyPlanId: mockPlan1._id,
      title: 'Temp Task',
      scheduledDate: new Date(),
      estimatedMinutes: 10,
      status: 'PENDING'
    });
    const { data: d7 } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'POST', {
      title: tempTask.title,
      studyTaskId: tempTask._id
    }, token1);

    // Delete task directly
    await StudyTask.deleteOne({ _id: tempTask._id });

    // Retrieve goals list -> should not crash
    const { status: s7_retrieve, data: d7_retrieve } = await apiRequest(`/study-rooms/${mockRoom._id}/goals`, 'GET', null, token1);
    assert.strictEqual(s7_retrieve, 200);
    // Find our goal; studyTask should be null or missing
    const goalToCheck = d7_retrieve.data.find(g => g._id === d7.data._id);
    assert.ok(goalToCheck);
    assert.strictEqual(goalToCheck.studyTask, null);
    console.log('✔ Goal query succeeded without crashing after task deletion.');

  } finally {
    server.close();
    await User.deleteMany({ _id: { $in: [studentUser1._id, studentUser2._id] } });
    await StudyPlan.deleteMany({ _id: { $in: [mockPlan1._id, mockPlan2._id] } });
    await StudyTask.deleteMany({ user: { $in: [studentUser1._id, studentUser2._id] } });
    await StudyRoom.deleteMany({ _id: mockRoom._id });
    await StudyRoomParticipant.deleteMany({ room: mockRoom._id });
    await StudyRoomGoal.deleteMany({ room: mockRoom._id });
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 10 PLANNER INTEGRATION TESTS PASSED');
  console.log('====================================================');
}

runPlannerIntegrationTests().catch(console.error);
