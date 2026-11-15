import { WebSocketServer } from 'ws';
import { verifyAccessToken } from '../../utils/token.utils.js';

// Map: roomId -> Map(connectionId -> ConnectionInfo)
const activeRooms = new Map();

/**
 * Broadcast message to all connected clients in a specific room
 */
export const broadcastToRoom = (roomId, message, skipConnectionId = null) => {
  const roomConns = activeRooms.get(String(roomId));
  if (!roomConns) return;

  const dataStr = JSON.stringify(message);
  for (const [connId, conn] of roomConns.entries()) {
    if (skipConnectionId && connId === skipConnectionId) continue;
    if (conn.ws.readyState === 1) { // OPEN
      conn.ws.send(dataStr);
    }
  }
};

/**
 * Send direct message to the sender and recipient connections only
 */
export const sendDirectMessage = (roomId, senderId, recipientId, message) => {
  const roomConns = activeRooms.get(String(roomId));
  if (!roomConns) return;

  const dataStr = JSON.stringify(message);
  for (const conn of roomConns.values()) {
    const isSender = String(conn.userId) === String(senderId);
    const isRecipient = String(conn.userId) === String(recipientId);
    if ((isSender || isRecipient) && conn.ws.readyState === 1) {
      conn.ws.send(dataStr);
    }
  }
};

/**
 * Triggered by REST controllers to sync state updates
 */
export const notifyRoomLock = (roomId, isLocked) => {
  broadcastToRoom(roomId, {
    type: isLocked ? 'ROOM_LOCKED' : 'ROOM_UNLOCKED',
    payload: { roomId }
  });
};

export const notifyRoomLifecycle = (roomId, status) => {
  broadcastToRoom(roomId, {
    type: 'ROOM_STATUS_CHANGED',
    payload: { roomId, status }
  });
};

export const notifyFocusSession = (roomId, eventType, session) => {
  (async () => {
    try {
      const studyRoomService = (await import('../services/studyRoom.service.js')).default;
      const details = session ? studyRoomService.getFocusSessionDetails(session) : null;
      
      broadcastToRoom(roomId, {
        type: eventType === 'START' ? 'FOCUS_STARTED' :
              eventType === 'PAUSE' ? 'FOCUS_PAUSED' :
              eventType === 'RESUME' ? 'FOCUS_RESUMED' : 'FOCUS_ENDED',
        payload: details
      });
    } catch (err) {
      console.error('[SOCKET SERVER] Failed to broadcast focus session details:', err);
    }
  })();
};

/**
 * Initialize WebSockets for Study Rooms
 */
export const initStudyRoomRealtime = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const urlParams = new URL(request.url, 'http://localhost');
    if (
      urlParams.pathname.startsWith('/api/v1/study-rooms/realtime') ||
      urlParams.pathname.startsWith('/study-rooms/realtime') ||
      urlParams.pathname.startsWith('/api/study-rooms/realtime')
    ) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws, request) => {
    const urlParams = new URL(request.url, 'http://localhost');
    const roomId = urlParams.searchParams.get('roomId');
    const token = urlParams.searchParams.get('token');

    console.log('[ROOM SOCKET AUTH] token received:', !!token);
    if (!token || !roomId) {
      ws.close(4001, 'Unauthorized: Token and Room ID required');
      return;
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
      console.log('[ROOM SOCKET AUTH] token valid: true');
    } catch (e) {
      console.log('[ROOM SOCKET AUTH] token valid: false');
      ws.close(4001, 'Unauthorized: Invalid token');
      return;
    }

    // Dynamic loading to prevent database preloading circular deps
    const User = (await import('../../models/user.model.js')).default;
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      ws.close(4001, 'Unauthorized: Inactive user');
      return;
    }

    console.log('[ROOM SOCKET AUTH] userId:', user._id.toString());
    console.log('[ROOM SOCKET AUTH] roomId:', roomId);

    const StudyRoom = (await import('../models/studyRoom.model.js')).default;
    const StudyRoomParticipant = (await import('../models/studyRoomParticipant.model.js')).default;

    const room = await StudyRoom.findById(roomId);
    if (!room) {
      ws.close(4004, 'Room not found');
      return;
    }

    if (['ENDED', 'CANCELLED'].includes(room.status)) {
      ws.close(4003, 'Room has already ended');
      return;
    }

    const isHost = room.host.toString() === user._id.toString();
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const isWebRTCParticipant = !isAdmin;
    let participant = null;

    if (isWebRTCParticipant) {
      participant = await StudyRoomParticipant.findOne({
        room: roomId,
        user: user._id
      });
      if (!participant) {
        console.log('[ROOM SOCKET AUTH] participant verified: false');
        ws.close(4003, 'User must join the study room via REST API first');
        return;
      }

      // Auto-reactivate status if it was left or inactive
      if (participant.status !== 'active') {
        participant.status = 'active';
        participant.leftAt = null;
        await participant.save();
      }
      console.log('[ROOM SOCKET AUTH] participant verified: true');
    } else {
      console.log('[ROOM SOCKET AUTH] participant verified: true (Admin bypass)');
    }

    const connectionId = Math.random().toString(36).substring(2, 10);
    const role = isAdmin ? user.role : (isHost ? 'HOST' : (participant?.role || 'PARTICIPANT'));

    const connInfo = {
      id: connectionId,
      ws,
      userId: user._id.toString(),
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        profileImage: user.profileImage || user.avatar
      },
      roomId,
      role,
      cameraState: 'CAMERA_OFF',
      micState: 'MIC_OFF',
      joinedAt: new Date()
    };

    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Map());
    }
    const roomConns = activeRooms.get(roomId);

    // Check duplicate logins (tab check)
    const isAlreadyPresent = Array.from(roomConns.values()).some((c) => c.userId === connInfo.userId);
    roomConns.set(connectionId, connInfo);

    // 1. Broadcast join presence update to all other room sockets
    if (!isAlreadyPresent && isWebRTCParticipant) {
      broadcastToRoom(roomId, {
        type: 'ROOM_PARTICIPANT_JOINED',
        payload: {
          participantId: connInfo.userId,
          name: connInfo.user.name,
          username: connInfo.user.username,
          avatar: connInfo.user.profileImage,
          role: connInfo.role,
          cameraState: connInfo.cameraState,
          joinedAt: connInfo.joinedAt
        }
      }, connectionId);
    }

    // 2. Transmit current room state (participants, lock, focus session) to the connecting client
    const uniqueParticipants = [];
    const seenUserIds = new Set();
    for (const [_, c] of roomConns.entries()) {
      if (c.role === 'ADMIN' || c.role === 'SUPER_ADMIN') continue;
      if (!seenUserIds.has(c.userId)) {
        seenUserIds.add(c.userId);
        uniqueParticipants.push({
          participantId: c.userId,
          name: c.user.name,
          username: c.user.username,
          avatar: c.user.profileImage,
          role: c.role,
          cameraState: c.cameraState,
          micState: c.micState || 'MIC_OFF',
          joinedAt: c.joinedAt
        });
      }
    }

    const roomMeta = activeRooms.get(roomId);
    const isMutedAll = roomMeta ? !!roomMeta.isMutedAll : false;
    const allowParticipantUnmute = roomMeta ? roomMeta.allowParticipantUnmute !== false : true;

    // Fetch active focus session and send ROOM_INIT_STATE asynchronously to avoid blocking the synchronous listener registration flow
    (async () => {
      try {
        const StudyRoomFocusSession = (await import('../models/studyRoomFocusSession.model.js')).default;
        const studyRoomService = (await import('../services/studyRoom.service.js')).default;
        const rawFocus = await StudyRoomFocusSession.findOne({
          room: roomId,
          status: { $in: ['PENDING', 'ACTIVE', 'PAUSED'] }
        }).sort({ createdAt: -1 });
        const focusSessionPayload = rawFocus ? studyRoomService.getFocusSessionDetails(rawFocus) : null;

        ws.send(JSON.stringify({
          type: 'ROOM_INIT_STATE',
          payload: {
            participants: uniqueParticipants,
            status: room.status,
            isLocked: room.isLocked,
            isMutedAll,
            allowParticipantUnmute,
            focusSession: focusSessionPayload
          }
        }));
      } catch (err) {
        console.error('[SOCKET] Error in ROOM_INIT_STATE lookup:', err);
        ws.send(JSON.stringify({
          type: 'ROOM_INIT_STATE',
          payload: {
            participants: uniqueParticipants,
            status: room.status,
            isLocked: room.isLocked,
            isMutedAll,
            allowParticipantUnmute,
            focusSession: null
          }
        }));
      }
    })();

    // Heartbeat check setup
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    // Chat Moderation Classifier
    const classifyChatMessage = (text) => {
      if (!text) return { allowed: true };
      const lower = text.toLowerCase();
      const offTopicRegexes = [
        /watch\s+(movie|film|tv|show|netflix)/i,
        /play\s+(game|pubg|cod|fortnite|minecraft|fifa|gta|valorant)/i,
        /crypto|bitcoin|dogecoin|ethereum/i,
        /wanna\s+hang\s*out\s+at\s+the\s+(mall|club|party)/i,
        /chat\s+about\s+(fashion|gossip|celeb|movies)/i
      ];
      for (const regex of offTopicRegexes) {
        if (regex.test(lower)) {
          return { allowed: false, reason: 'This room is limited to study-related discussion.' };
        }
      }
      return { allowed: true };
    };

    // Message receiver
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'TOGGLE_CAMERA': {
            const cameraState = message.payload?.cameraState || 'CAMERA_OFF';
            connInfo.cameraState = cameraState;
            broadcastToRoom(roomId, {
              type: 'PARTICIPANT_CAMERA_CHANGED',
              payload: {
                participantId: connInfo.userId,
                cameraState
              }
            });
            break;
          }

          case 'TOGGLE_MIC': {
            const micState = message.payload?.micState || 'MIC_OFF';
            const roomMeta = activeRooms.get(roomId);
            const isUserMutedByPolicy = roomMeta && roomMeta.isMutedAll && !roomMeta.allowParticipantUnmute;
            const isUserIndividuallyMuted = roomMeta && roomMeta.mutedUserIds && roomMeta.mutedUserIds.has(String(connInfo.userId));

            if (!isAdmin && !isHost && micState === 'MIC_ON' && (isUserMutedByPolicy || isUserIndividuallyMuted)) {
              connInfo.micState = 'MIC_OFF';
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: 'You have been muted by the host and cannot unmute yourself.' }
              }));
              broadcastToRoom(roomId, {
                type: 'PARTICIPANT_MIC_CHANGED',
                payload: {
                  participantId: connInfo.userId,
                  micState: 'MIC_OFF'
                }
              });
              break;
            }

            connInfo.micState = micState;
            broadcastToRoom(roomId, {
              type: 'PARTICIPANT_MIC_CHANGED',
              payload: {
                participantId: connInfo.userId,
                micState
              }
            });
            break;
          }

          case 'CHAT_MESSAGE_SENT': {
            const msgText = (message.payload?.message || '').trim();
            const recipientId = message.payload?.recipientId || null;
            if (!msgText) break;

            const classification = classifyChatMessage(msgText);
            if (!classification.allowed) {
              ws.send(JSON.stringify({
                type: 'CHAT_MESSAGE_REJECTED',
                payload: {
                  message: classification.reason
                }
              }));
              break;
            }

            (async () => {
              try {
                if (recipientId) {
                  if (isAdmin) {
                    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Admins cannot send private messages' } }));
                    return;
                  }
                  // Verify recipient belongs to the same room and is active
                  const StudyRoomParticipant = (await import('../models/studyRoomParticipant.model.js')).default;
                  const [senderParticipant, recipientParticipant] = await Promise.all([
                    StudyRoomParticipant.findOne({ room: roomId, user: connInfo.userId, status: { $in: ['joined', 'active'] } }),
                    StudyRoomParticipant.findOne({ room: roomId, user: recipientId, status: { $in: ['joined', 'active'] } })
                  ]);
                  if (!senderParticipant || !recipientParticipant) {
                    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Recipient is not an active participant in this room' } }));
                    return;
                  }
                }

                const StudyRoomChat = (await import('../models/studyRoomChat.model.js')).default;
                const chatDoc = await StudyRoomChat.create({
                  room: roomId,
                  sender: connInfo.userId,
                  recipient: recipientId || null,
                  message: msgText
                });

                const payload = {
                  _id: chatDoc._id,
                  room: roomId,
                  sender: connInfo.user,
                  recipientId: recipientId || null,
                  message: msgText,
                  timestamp: chatDoc.timestamp
                };

                if (recipientId) {
                  sendDirectMessage(roomId, connInfo.userId, recipientId, {
                    type: 'CHAT_MESSAGE_RECEIVED',
                    payload
                  });
                } else {
                  broadcastToRoom(roomId, {
                    type: 'CHAT_MESSAGE_RECEIVED',
                    payload
                  });
                }
              } catch (dbErr) {
                console.error('[SOCKET SERVER] Chat message save failed:', dbErr);
              }
            })();
            break;
          }

          case 'CHAT_MESSAGE_DELETED': {
            const messageId = message.payload?.messageId;
            if (!messageId) break;

            if (!isAdmin) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Only admins can moderate messages' } }));
              break;
            }

            (async () => {
              try {
                const StudyRoomChat = (await import('../models/studyRoomChat.model.js')).default;
                await StudyRoomChat.findByIdAndUpdate(messageId, { isDeleted: true });

                broadcastToRoom(roomId, {
                  type: 'CHAT_MESSAGE_DELETED',
                  payload: { messageId }
                });
              } catch (dbErr) {
                console.error('[SOCKET SERVER] Chat delete failed:', dbErr);
              }
            })();
            break;
          }

          case 'CHAT_HISTORY_REQUESTED': {
            (async () => {
              try {
                if (!isHost && !isAdmin) {
                  const StudyRoomParticipant = (await import('../models/studyRoomParticipant.model.js')).default;
                  const isParticipant = await StudyRoomParticipant.findOne({
                    room: roomId,
                    user: connInfo.userId,
                    status: { $in: ['joined', 'active'] }
                  });
                  if (!isParticipant) {
                    ws.send(JSON.stringify({
                      type: 'ERROR',
                      payload: { message: 'Unauthorized: Chat history access restricted to room participants' }
                    }));
                    return;
                  }
                }

                const StudyRoomChat = (await import('../models/studyRoomChat.model.js')).default;
                const query = {
                  room: roomId,
                  isDeleted: false,
                  $or: [
                    { recipient: null }, // room-wide messages
                    { sender: connInfo.userId }, // direct messages sent by current user
                    { recipient: connInfo.userId } // direct messages received by current user
                  ]
                };

                const messages = await StudyRoomChat.find(query)
                  .sort({ timestamp: 1 })
                  .populate('sender', 'name username profileImage avatar');

                ws.send(JSON.stringify({
                  type: 'CHAT_HISTORY_RESPONSE',
                  payload: { messages }
                }));
              } catch (dbErr) {
                console.error('[SOCKET SERVER] Chat history fetch failed:', dbErr);
              }
            })();
            break;
          }

          case 'MUTE_ALL': {
            if (!isAdmin) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized: Only admin can mute all' } }));
              break;
            }
            const allowUnmute = message.payload?.allowParticipantUnmute !== false;
            const roomMeta = activeRooms.get(roomId);
            if (roomMeta) {
              roomMeta.allowParticipantUnmute = allowUnmute;
              roomMeta.isMutedAll = true;
              for (const c of roomMeta.values()) {
                if (c.role !== 'ADMIN' && c.role !== 'SUPER_ADMIN') {
                  c.micState = 'MIC_OFF';
                }
              }
            }
            broadcastToRoom(roomId, {
              type: 'MUTE_ALL_TRIGGERED',
              payload: {
                allowParticipantUnmute: allowUnmute
              }
            });
            break;
          }

          case 'ALLOW_UNMUTE': {
            if (!isAdmin) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized: Only admin can allow unmute' } }));
              break;
            }
            const roomMeta = activeRooms.get(roomId);
            if (roomMeta) {
              roomMeta.allowParticipantUnmute = true;
              roomMeta.isMutedAll = false;
              if (roomMeta.mutedUserIds) {
                roomMeta.mutedUserIds.clear();
              }
            }
            broadcastToRoom(roomId, {
              type: 'ALLOW_UNMUTE_TRIGGERED',
              payload: {}
            });
            break;
          }

          case 'PARTICIPANT_MUTED': {
            if (!isAdmin) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized: Only admin can mute individual participants' } }));
              break;
            }
            const targetUserId = message.payload?.targetUserId;
            if (!targetUserId) break;

            const roomMeta = activeRooms.get(roomId);
            if (roomMeta) {
              if (!roomMeta.mutedUserIds) roomMeta.mutedUserIds = new Set();
              roomMeta.mutedUserIds.add(String(targetUserId));
              for (const c of roomMeta.values()) {
                if (String(c.userId) === String(targetUserId)) {
                  c.micState = 'MIC_OFF';
                }
              }
            }

            broadcastToRoom(roomId, {
              type: 'PARTICIPANT_MUTED_TRIGGERED',
              payload: {
                targetUserId
              }
            });
            break;
          }

          case 'PARTICIPANT_UNMUTED': {
            if (!isAdmin) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized: Only admin can unmute individual participants' } }));
              break;
            }
            const targetUserId = message.payload?.targetUserId;
            if (!targetUserId) break;

            const roomMeta = activeRooms.get(roomId);
            if (roomMeta && roomMeta.mutedUserIds) {
              roomMeta.mutedUserIds.delete(String(targetUserId));
            }

            broadcastToRoom(roomId, {
              type: 'PARTICIPANT_UNMUTED_TRIGGERED',
              payload: {
                targetUserId
              }
            });
            break;
          }

          case 'WEBRTC_OFFER':
          case 'WEBRTC_ANSWER':
          case 'WEBRTC_ICE_CANDIDATE': {
            const targetUserId = message.to;
            const signalData = message.payload;
            const targetConns = Array.from(roomConns.values()).filter(c => c.userId === targetUserId);
            
            targetConns.forEach((tc) => {
              if (tc.ws.readyState === 1) {
                tc.ws.send(JSON.stringify({
                  type: message.type,
                  from: connInfo.userId,
                  payload: signalData
                }));
              }
            });
            break;
          }

          default:
            console.warn(`Unrecognized socket message type: ${message.type}`);
        }
      } catch (err) {
        console.error('Failed to process websocket frame message', err);
      }
    });

    // Cleanup connection
    ws.on('close', () => {
      clearInterval(pingInterval);
      const conns = activeRooms.get(roomId);
      if (conns) {
        conns.delete(connectionId);
        const stillPresent = Array.from(conns.values()).some((c) => c.userId === connInfo.userId);
        
        if (!stillPresent && isWebRTCParticipant) {
          (async () => {
            try {
              const mongoose = (await import('mongoose')).default;
              if (mongoose.connection && mongoose.connection.readyState === 1) {
                const StudyRoomParticipant = (await import('../models/studyRoomParticipant.model.js')).default;
                await StudyRoomParticipant.findOneAndUpdate(
                  { room: roomId, user: connInfo.userId, status: { $in: ['joined', 'active'] } },
                  { status: 'left', leftAt: new Date() }
                );
              }
            } catch (dbErr) {
              console.error('[SOCKET SERVER] Failed to clean up participant on disconnect:', dbErr);
            }
          })();

          broadcastToRoom(roomId, {
            type: 'ROOM_PARTICIPANT_LEFT',
            payload: {
              participantId: connInfo.userId
            }
          });
        }
        
        if (conns.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`Socket connection error for user ${connInfo.userId}`, err);
    });
  });
};
export default initStudyRoomRealtime;
