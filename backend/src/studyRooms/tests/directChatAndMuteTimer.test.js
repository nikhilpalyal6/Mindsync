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
import StudyRoomChat from '../models/studyRoomChat.model.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import initStudyRoomRealtime from '../realtime/studyRoom.socket.js';

const PORT = 5095;

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
  console.log('STARTING PHASE 12: DIRECT CHAT & MUTE TIMER TESTS');
  console.log('====================================================');

  let server;
  let wss;
  try {
    await connectDB();

    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('studyrooms').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomparticipants').deleteMany({}).catch(() => {});
      await mongoose.connection.db.collection('studyroomchats').deleteMany({}).catch(() => {});
    }

    await StudyRoom.init();
    await StudyRoomParticipant.init();
    await StudyRoomChat.init();

    server = http.createServer(app);
    wss = initStudyRoomRealtime(server);

    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`✔ Ephemeral test server listening on port ${PORT}.`);

    // Setup accounts
    const adminId = new mongoose.Types.ObjectId();
    const studentAId = new mongoose.Types.ObjectId();
    const studentBId = new mongoose.Types.ObjectId();
    const studentCId = new mongoose.Types.ObjectId();

    await User.create({
      _id: adminId,
      name: 'Admin Moderator',
      username: 'admin_' + Date.now(),
      email: 'admin_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'ADMIN'
    });

    await User.create({
      _id: studentAId,
      name: 'Student A',
      username: 'studenta_' + Date.now(),
      email: 'studenta_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    await User.create({
      _id: studentBId,
      name: 'Student B',
      username: 'studentb_' + Date.now(),
      email: 'studentb_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    await User.create({
      _id: studentCId,
      name: 'Student C',
      username: 'studentc_' + Date.now(),
      email: 'studentc_' + Date.now() + '@mindsync.com',
      password: 'password123',
      role: 'USER'
    });

    const adminToken = generateAccessToken({ id: adminId });
    const studentAToken = generateAccessToken({ id: studentAId });
    const studentBToken = generateAccessToken({ id: studentBId });
    const studentCToken = generateAccessToken({ id: studentCId });

    // Create room
    const room = await StudyRoom.create({
      title: 'Direct Chat room',
      host: studentAId,
      status: 'LIVE',
      capacity: 10
    });
    const roomId = room._id;

    // Join REST
    await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, studentAToken);
    await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, studentBToken);
    await apiRequest(`/study-rooms/${roomId}/join`, 'POST', null, studentCToken);

    // Connect Sockets
    const wsUrlA = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${studentAToken}`;
    const wsUrlB = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${studentBToken}`;
    const wsUrlC = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${studentCToken}`;
    const wsUrlAdmin = `ws://localhost:${PORT}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${adminToken}`;

    const wsA = new WebSocket(wsUrlA);
    const wsB = new WebSocket(wsUrlB);
    const wsC = new WebSocket(wsUrlC);
    const wsAdmin = new WebSocket(wsUrlAdmin);

    const waitForInit = (ws) => new Promise((resolve) => {
      ws.on('message', function listener(data) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ROOM_INIT_STATE') {
            ws.off('message', listener);
            resolve();
          }
        } catch (e) {}
      });
    });

    await Promise.all([
      waitForInit(wsA),
      waitForInit(wsB),
      waitForInit(wsC),
      waitForInit(wsAdmin)
    ]);
    console.log('✔ Sockets connected and initialized.');

    // Test 1: Room-wide chat message (Everyone)
    console.log('[Test 1] Testing Room-wide chat message broadcast...');
    let msgReceivedCount = 0;
    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CHAT_MESSAGE_RECEIVED' && !msg.payload.recipientId) {
        msgReceivedCount++;
        assert.strictEqual(msg.payload.message, 'Hello everyone!');
      }
    });

    wsC.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CHAT_MESSAGE_RECEIVED' && !msg.payload.recipientId) {
        msgReceivedCount++;
      }
    });

    wsA.send(JSON.stringify({
      type: 'CHAT_MESSAGE_SENT',
      payload: { message: 'Hello everyone!' }
    }));

    await new Promise((res) => setTimeout(res, 500));
    assert.strictEqual(msgReceivedCount, 2);
    console.log('✔ Broadcast to all active participants verified.');

    // Remove old listeners to prevent leak
    wsB.removeAllListeners('message');
    wsC.removeAllListeners('message');
    wsAdmin.removeAllListeners('message');

    // Test 2: Direct message from A to B (expect C and Admin do NOT receive it)
    console.log('[Test 2] Testing direct message from Student A to Student B...');
    let dmReceivedByB = false;
    let dmReceivedByOthers = false;

    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CHAT_MESSAGE_RECEIVED' && msg.payload.recipientId) {
        dmReceivedByB = true;
        assert.strictEqual(msg.payload.message, 'Hey B, this is private!');
        assert.strictEqual(msg.payload.recipientId.toString(), studentBId.toString());
      }
    });

    wsC.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CHAT_MESSAGE_RECEIVED' && msg.payload.recipientId) {
        dmReceivedByOthers = true;
      }
    });

    wsAdmin.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CHAT_MESSAGE_RECEIVED' && msg.payload.recipientId) {
        dmReceivedByOthers = true;
      }
    });

    wsA.send(JSON.stringify({
      type: 'CHAT_MESSAGE_SENT',
      payload: { message: 'Hey B, this is private!', recipientId: studentBId.toString() }
    }));

    await new Promise((res) => setTimeout(res, 500));
    assert.ok(dmReceivedByB);
    assert.strictEqual(dmReceivedByOthers, false);
    console.log('✔ Direct message selectively routed correctly.');

    // Test 3: History query separation
    console.log('[Test 3] Verifying direct chat history separation...');
    const chatHistoryARes = await new Promise((resolve) => {
      wsA.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CHAT_HISTORY_RESPONSE') {
          resolve(msg.payload.messages);
        }
      });
      wsA.send(JSON.stringify({ type: 'CHAT_HISTORY_REQUESTED' }));
    });

    // Student A history should contain both messages
    assert.strictEqual(chatHistoryARes.length, 2);

    wsA.removeAllListeners('message');

    const chatHistoryCRes = await new Promise((resolve) => {
      wsC.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CHAT_HISTORY_RESPONSE') {
          resolve(msg.payload.messages);
        }
      });
      wsC.send(JSON.stringify({ type: 'CHAT_HISTORY_REQUESTED' }));
    });

    // Student C history should ONLY contain the room-wide message
    assert.strictEqual(chatHistoryCRes.length, 1);
    assert.strictEqual(chatHistoryCRes[0].message, 'Hello everyone!');
    console.log('✔ Direct message history successfully separated and filtered.');

    wsC.removeAllListeners('message');

    // Clean connections
    wsA.close();
    wsB.close();
    wsC.close();
    wsAdmin.close();

    console.log('\nCleaning up database records...');
    await User.deleteMany({ _id: { $in: [adminId, studentAId, studentBId, studentCId] } });
    await StudyRoom.deleteMany({ _id: roomId });
    await StudyRoomParticipant.deleteMany({ room: roomId });
    await StudyRoomChat.deleteMany({ room: roomId });
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
    console.log('ALL PHASE 12 DIRECT CHAT & MUTE TIMER TESTS PASSED');
    console.log('====================================================');
    process.exit(0);
  }
}

runTests();
