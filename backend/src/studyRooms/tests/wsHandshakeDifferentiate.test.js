import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
mongoose.set('bufferCommands', true);

import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';
import app from '../../app.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import User from '../../models/user.model.js';
import StudyRoom from '../models/studyRoom.model.js';
import StudyRoomParticipant from '../models/studyRoomParticipant.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import initStudyRoomRealtime from '../realtime/studyRoom.socket.js';

const PORT = 5096;

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
  console.log('STARTING PHASE 12: WS HANDSHAKE DIFFERENTIATE TESTS');
  console.log('====================================================');

  let server;
  let wss;
  try {
    await connectDB();

    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('studyrooms').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomparticipants').deleteMany({}).catch(() => {});
    }

    await StudyRoom.init();
    await StudyRoomParticipant.init();

    server = http.createServer(app);
    wss = initStudyRoomRealtime(server);

    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✔ Ephemeral test server listening on port ${PORT}.`);

    // Scaffolding
    const studentId = new mongoose.Types.ObjectId();
    const student2Id = new mongoose.Types.ObjectId();

    await User.create({
      _id: studentId,
      name: 'Nikhil Palyal',
      username: 'nikhil_' + Date.now(),
      email: 'nikhil_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    await User.create({
      _id: student2Id,
      name: 'Second Student',
      username: 'student2_' + Date.now(),
      email: 'student2_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const studentToken = generateAccessToken({ id: studentId });
    const student2Token = generateAccessToken({ id: student2Id });

    const room = await StudyRoom.create({
      title: 'Phase 12 Verification Room',
      host: studentId,
      status: 'LIVE',
      capacity: 10
    });

    const roomId = room._id;

    // Test 1: Connect to WebSocket with invalid token (expect 4001)
    console.log('[Test 1] Socket connection with invalid token (expect 4001)...');
    const wsUrlInvalid = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=invalid-token`;
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrlInvalid);
      ws.on('close', (code, reason) => {
        try {
          assert.strictEqual(code, 4001);
          console.log('✔ Correctly closed with 4001:', reason.toString());
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      ws.on('error', () => {}); // Safe catch
    });

    // Test 2: Connect to WebSocket BEFORE REST join (expect 4003)
    console.log('[Test 2] Socket connection BEFORE REST join (expect 4003)...');
    const wsUrlNoJoin = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${student2Token}`;
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrlNoJoin);
      ws.on('close', (code, reason) => {
        try {
          assert.strictEqual(code, 4003);
          console.log('✔ Correctly closed with 4003:', reason.toString());
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      ws.on('error', () => {}); // Safe catch
    });

    // Test 3: REST Join for Student 2
    console.log('[Test 3] REST Join for Student 2...');
    const joinRes = await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, student2Token);
    assert.strictEqual(joinRes.status, 200);
    console.log('✔ Student 2 joined via REST API.');

    // Test 4: Connect to WebSocket AFTER REST join (expect success)
    console.log('[Test 4] Socket connection AFTER REST join (expect success)...');
    const wsUrlJoined = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${student2Token}`;
    const wsClient = await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrlJoined);
      ws.on('open', () => {
        console.log('✔ Socket successfully opened.');
        resolve(ws);
      });
      ws.on('error', reject);
    });

    // Test 5: Reconnection/Graceful status auto-reactivation
    console.log('[Test 5] Simulating connection drop (setting status to left)...');
    await StudyRoomParticipant.updateOne({ room: roomId, user: student2Id }, { status: 'left' });
    wsClient.close(); // Close old client

    console.log('[Test 5] Connecting new socket after simulation...');
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrlJoined);
      ws.on('open', () => {
        console.log('✔ Socket successfully reconnected.');
        setTimeout(async () => {
          try {
            const checkPart = await StudyRoomParticipant.findOne({ room: roomId, user: student2Id });
            assert.strictEqual(checkPart.status, 'active');
            console.log('✔ Database status automatically reactivated to active.');
            ws.close();
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 200);
      });
      ws.on('close', (code, reason) => {
        if (code !== 1000 && code !== 1005) {
          reject(new Error(`Connection failed with code ${code}: ${reason.toString()}`));
        }
      });
      ws.on('error', reject);
    });

    console.log('\nCleaning up phase 12 database records...');
    await User.deleteMany({ _id: { $in: [studentId, student2Id] } });
    await StudyRoom.deleteMany({ _id: roomId });
    await StudyRoomParticipant.deleteMany({ room: roomId });
    console.log('✔ Cleanup complete.');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    if (wss) {
      wss.close();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
    console.log('====================================================');
    console.log('ALL PHASE 12 WS HANDSHAKE DIFFERENTIATE TESTS PASSED');
    console.log('====================================================');
    process.exit(0);
  }
}

runTests();
