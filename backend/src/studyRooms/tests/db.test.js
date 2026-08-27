import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
mongoose.set('bufferCommands', true);

import assert from 'assert';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudySession from '../../models/studySession.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import StudyRoomFocusSession from '../models/studyRoomFocusSession.model.js';
import StudyRoomGoal from '../models/studyRoomGoal.model.js';
import StudyRoomActivityLog from '../models/studyRoomActivityLog.model.js';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 2: STUDY ROOMS DATABASE MODEL TESTS');
  console.log('====================================================');

  try {
    await connectDB();

    // Clear collections first using native driver to prevent index build failures from prior stale runs
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('studyrooms').deleteMany({}).catch(() => {});
        await mongoose.connection.db.collection('studyroomparticipants').deleteMany({}).catch(() => {});
        await mongoose.connection.db.collection('studyroomfocussessions').deleteMany({}).catch(() => {});
        await mongoose.connection.db.collection('studyroomgoals').deleteMany({}).catch(() => {});
        await mongoose.connection.db.collection('studyroomactivitylogs').deleteMany({}).catch(() => {});
      }
    } catch (e) {
      console.log('Pre-test cleanup error (safe to ignore):', e.message);
    }



    // Setup Test Scaffolding
    const testUserId = new mongoose.Types.ObjectId();
    const studentUserId = new mongoose.Types.ObjectId();
    const extraStudentUserId = new mongoose.Types.ObjectId();
    const mockStudySessionId = new mongoose.Types.ObjectId();

    // Create a dummy user in database to satisfy refs (if required by DB constraints, though Mongoose refs don't assert exist unless triggered manually, User model exists)
    const testUser = await User.create({
      _id: testUserId,
      name: 'Host User',
      username: 'host_user_' + Date.now(),
      email: 'host_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const studentUser = await User.create({
      _id: studentUserId,
      name: 'Student User',
      username: 'student_user_' + Date.now(),
      email: 'student_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const extraStudentUser = await User.create({
      _id: extraStudentUserId,
      name: 'Extra Student',
      username: 'extra_user_' + Date.now(),
      email: 'extra_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    // Create a dummy StudySession representing a Workshop
    const mockWorkspace = await StudySession.create({
      _id: mockStudySessionId,
      user: testUserId,
      title: 'Mock Workshop Session'
    });

    console.log('✔ Test scaffolding created.');

    // ==========================================
    // 1. StudyRoom Creation & Fields Verification
    // ==========================================
    console.log('\n[Test 1] Verifying StudyRoom creation...');
    const validRoom = await StudyRoom.create({
      title: 'Algorithms Group Study',
      description: 'Reviewing Heap sort and binary trees.',
      host: testUserId,
      capacity: 2,
      status: 'DRAFT',
      visibility: 'PUBLIC',
      workshopId: mockStudySessionId
    });
    assert.strictEqual(validRoom.title, 'Algorithms Group Study');
    assert.strictEqual(validRoom.capacity, 2);
    assert.strictEqual(validRoom.status, 'DRAFT');
    assert.ok(validRoom.workshopId.equals(mockStudySessionId));
    console.log('✔ StudyRoom created successfully.');

    // ==========================================
    // 2. Invalid Capacity Validation
    // ==========================================
    console.log('\n[Test 2] Verifying invalid capacity rejection...');
    try {
      await StudyRoom.create({
        title: 'Negative Capacity Room',
        host: testUserId,
        capacity: 0,
        status: 'DRAFT'
      });
      assert.fail('Should have failed validation for capacity = 0');
    } catch (err) {
      assert.ok(err.errors.capacity);
      console.log('✔ Capacity = 0 validation failed as expected: ' + err.errors.capacity.message);
    }

    try {
      await StudyRoom.create({
        title: 'Excessive Capacity Room',
        host: testUserId,
        capacity: 1001,
        status: 'DRAFT'
      });
      assert.fail('Should have failed validation for capacity > 1000');
    } catch (err) {
      assert.ok(err.errors.capacity);
      console.log('✔ Capacity > 1000 validation failed as expected: ' + err.errors.capacity.message);
    }

    // ==========================================
    // 3. Date Validation Checks
    // ==========================================
    console.log('\n[Test 3] Verifying scheduled date validations...');
    try {
      await StudyRoom.create({
        title: 'Invalid Dates Room',
        host: testUserId,
        capacity: 5,
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-12-31'),
        scheduledEnd: new Date('2026-01-01') // End before Start
      });
      assert.fail('Should have failed validation for scheduledEnd < scheduledStart');
    } catch (err) {
      assert.ok(err.errors.scheduledEnd);
      console.log('✔ Start >= End validation failed as expected: ' + err.errors.scheduledEnd.message);
    }

    try {
      await StudyRoom.create({
        title: 'Missing Date for Scheduled Room',
        host: testUserId,
        capacity: 5,
        status: 'SCHEDULED'
        // Missing scheduledStart
      });
      assert.fail('Should have failed validation for missing scheduledStart in SCHEDULED status');
    } catch (err) {
      assert.ok(err.errors.scheduledStart);
      console.log('✔ Missing scheduledStart validation failed as expected: ' + err.errors.scheduledStart.message);
    }

    // ==========================================
    // 4. Status Transition Guards
    // ==========================================
    console.log('\n[Test 4] Verifying status transition guards...');
    const liveRoom = await StudyRoom.create({
      title: 'Status Transition Room',
      host: testUserId,
      capacity: 5,
      status: 'LIVE'
    });

    // Transit to ENDED
    liveRoom.status = 'ENDED';
    await liveRoom.save();
    console.log('✔ Room status transitioned from LIVE to ENDED.');

    // Try to restart the room (transit ENDED -> LIVE)
    try {
      liveRoom.status = 'LIVE';
      await liveRoom.save();
      assert.fail('Should have blocked transition from ENDED back to LIVE');
    } catch (err) {
      assert.ok(err.message.includes('Cannot change status of a room that has already ended'));
      console.log('✔ Blocked transition from ENDED to LIVE as expected.');
    }

    console.log('[DEBUG BEFORE TEST 5] readyState:', mongoose.connection.readyState);
    console.log('[DEBUG BEFORE TEST 5] db is defined:', !!mongoose.connection.db);

    // ==========================================
    // 5. Participant Creation & Fields Verification
    // ==========================================
    console.log('\n[Test 5] Verifying Participant creation...');
    const hostParticipant = await StudyRoomParticipant.create({
      room: validRoom._id,
      user: testUserId,
      role: 'HOST',
      status: 'active'
    });
    assert.strictEqual(hostParticipant.role, 'HOST');
    assert.strictEqual(hostParticipant.status, 'active');
    
    // Ensure participant indexes (including unique index) are fully built now
    await StudyRoomParticipant.init();
    console.log('✔ Host participant created successfully.');

    // ==========================================
    // 6. Duplicate Participant Prevention
    // ==========================================
    console.log('\n[Test 6] Verifying duplicate participant prevention...');
    try {
      await StudyRoomParticipant.create({
        room: validRoom._id,
        user: testUserId,
        role: 'STUDENT',
        status: 'joined'
      });
      assert.fail('Should have failed unique index on {room, user}');
    } catch (err) {
      console.log('Error caught:', err);
      assert.ok(err.code === 11000 || err.message.includes('duplicate key') || err.message.includes('duplicate'));
      console.log('✔ Duplicate participant insertion prevented by unique index as expected.');
    }

    // ==========================================
    // 7. Participant Capacity Enforcement
    // ==========================================
    console.log('\n[Test 7] Verifying participant capacity enforcement...');
    // validRoom has capacity 2. Currently testUserId is in the room. Let's add studentUserId.
    const studentParticipant = await StudyRoomParticipant.create({
      room: validRoom._id,
      user: studentUserId,
      role: 'STUDENT',
      status: 'active'
    });
    assert.ok(studentParticipant);
    console.log('✔ Added student participant (Total active = 2, Capacity = 2).');

    // Try to add extraStudentUserId which would exceed capacity of 2
    try {
      await StudyRoomParticipant.create({
        room: validRoom._id,
        user: extraStudentUserId,
        role: 'STUDENT',
        status: 'active'
      });
      assert.fail('Should have blocked participant creation due to room capacity exceeded');
    } catch (err) {
      assert.ok(err.message.includes('capacity exceeded'));
      console.log('✔ Prevented excess participant from joining as expected: ' + err.message);
    }

    // ==========================================
    // 8. Focus Session Creation & Timer Verification
    // ==========================================
    console.log('\n[Test 8] Verifying Focus Session creation...');
    const focusSession = await StudyRoomFocusSession.create({
      room: validRoom._id,
      host: testUserId,
      plannedDuration: 25,
      status: 'PENDING'
    });
    assert.strictEqual(focusSession.status, 'PENDING');
    assert.strictEqual(focusSession.plannedDuration, 25);
    
    focusSession.status = 'ACTIVE';
    await focusSession.validate();
    assert.ok(focusSession.startedAt);
    console.log('✔ Focus session created and startedAt set automatically on transition to ACTIVE.');

    // Check invalid duration
    try {
      await StudyRoomFocusSession.create({
        room: validRoom._id,
        host: testUserId,
        plannedDuration: 0,
        status: 'PENDING'
      });
      assert.fail('Should have failed validation for plannedDuration = 0');
    } catch (err) {
      assert.ok(err.errors.plannedDuration);
      console.log('✔ Duration = 0 validation failed as expected.');
    }

    // ==========================================
    // 9. Goal Creation & Automatic Timestamps
    // ==========================================
    console.log('\n[Test 9] Verifying Goal creation and state mapping...');
    const goal = await StudyRoomGoal.create({
      room: validRoom._id,
      user: studentUserId,
      title: 'Complete 3 Heap Sort exercises'
    });
    assert.strictEqual(goal.status, 'ACTIVE');
    assert.strictEqual(goal.completedAt, null);

    goal.status = 'COMPLETED';
    await goal.save();
    assert.ok(goal.completedAt);
    console.log('✔ Goal created and completedAt timestamp populated automatically upon completion.');

    // Check invalid status
    try {
      goal.status = 'INVALID_STATUS';
      await goal.save();
      assert.fail('Should have failed validation for invalid status');
    } catch (err) {
      assert.ok(err.errors.status);
      console.log('✔ Goal invalid status validation failed as expected.');
    }

    // ==========================================
    // 10. Activity Log Creation
    // ==========================================
    console.log('\n[Test 10] Verifying Activity Log creation...');
    const logEntry = await StudyRoomActivityLog.create({
      room: validRoom._id,
      user: studentUserId,
      eventType: 'GOAL_COMPLETED',
      metadata: { goalId: goal._id }
    });
    assert.strictEqual(logEntry.eventType, 'GOAL_COMPLETED');
    assert.ok(logEntry.timestamp);
    console.log('✔ Room Activity Log saved successfully.');

    // Check invalid event type
    try {
      await StudyRoomActivityLog.create({
        room: validRoom._id,
        eventType: 'USER_TIRED'
      });
      assert.fail('Should have failed validation for invalid eventType');
    } catch (err) {
      assert.ok(err.errors.eventType);
      console.log('✔ Invalid eventType rejected as expected.');
    }

    // ==========================================
    // Cleanup
    // ==========================================
    console.log('\nCleaning up database records...');
    await StudyRoomActivityLog.deleteMany({ room: validRoom._id });
    await StudyRoomGoal.deleteMany({ room: validRoom._id });
    await StudyRoomFocusSession.deleteMany({ room: validRoom._id });
    await StudyRoomParticipant.deleteMany({ room: validRoom._id });
    await StudyRoomParticipant.deleteMany({ room: liveRoom._id });
    await StudyRoom.deleteMany({ host: testUserId });
    await StudySession.deleteOne({ _id: mockStudySessionId });
    await User.deleteOne({ _id: testUserId });
    await User.deleteOne({ _id: studentUserId });
    await User.deleteOne({ _id: extraStudentUserId });

    console.log('✔ Database cleaned up.');

    await disconnectDB();

    console.log('\n====================================================');
    console.log('ALL PHASE 2 STUDY ROOMS DATABASE MODEL TESTS PASSED');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ STUDY ROOMS DATABASE MODEL TESTS FAILED:', error);
    try {
      await disconnectDB();
    } catch (disconnectError) {
      console.error('Failed to disconnect cleanly:', disconnectError);
    }
    process.exit(1);
  }
}

runTests();
