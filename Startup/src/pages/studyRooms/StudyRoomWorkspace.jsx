import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  joinStudyRoom,
  leaveStudyRoom,
  getStudyRoom,
  getStudyRoomParticipants,
  getCurrentFocusSession,
  getRoomGoals,
  getStudyRoomTimeline
} from '../../services/api';

// Sockets and WebRTC Hooks
import { useStudyRoomSocket } from '../../hooks/studyRooms/useStudyRoomSocket';
import { useStudyRoomWebRTC } from '../../hooks/studyRooms/useStudyRoomWebRTC';

// Components
import StudyRoomHeader from '../../components/studyRooms/StudyRoomHeader';
import StudyRoomParticipantGrid from '../../components/studyRooms/StudyRoomParticipantGrid';
import StudyRoomFocusPanel from '../../components/studyRooms/StudyRoomFocusPanel';
import StudyRoomGoalPanel from '../../components/studyRooms/StudyRoomGoalPanel';
import StudyRoomInfoPanel from '../../components/studyRooms/StudyRoomInfoPanel';
import StudyRoomTimeline from '../../components/studyRooms/StudyRoomTimeline';
import StudyRoomChat from '../../components/studyRooms/StudyRoomChat';
import StudyRoomHostControls from '../../components/studyRooms/StudyRoomHostControls';
import LeaveRoomDialog from '../../components/studyRooms/LeaveRoomDialog';
import StudyRoomLoading from '../../components/studyRooms/StudyRoomLoading';
import StudyRoomError from '../../components/studyRooms/StudyRoomError';
import { showToast } from '../../components/Toast';

import './StudyRoomWorkspace.css';

export default function StudyRoomWorkspace() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <StudyRoomLoading message="Verifying credentials..." />;
  }

  if (!user) {
    return <StudyRoomError message="Please log in to join the study room." />;
  }

  return <StudyRoomWorkspaceContent user={user} />;
}

function StudyRoomWorkspaceContent({ user }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { refreshAccessToken } = useAuth();

  const [token, setToken] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState('everyone');
  const [showMuteNotification, setShowMuteNotification] = useState(false);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [focusSession, setFocusSession] = useState(null);
  const [goals, setGoals] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [allowParticipantUnmute, setAllowParticipantUnmute] = useState(true);
  const [isMuteLocked, setIsMuteLocked] = useState(false);

  const muteNotificationTimeoutRef = React.useRef(null);

  const triggerMuteNotification = useCallback(() => {
    if (muteNotificationTimeoutRef.current) {
      clearTimeout(muteNotificationTimeoutRef.current);
    }
    setShowMuteNotification(true);
    muteNotificationTimeoutRef.current = setTimeout(() => {
      setShowMuteNotification(false);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (muteNotificationTimeoutRef.current) {
        clearTimeout(muteNotificationTimeoutRef.current);
      }
    };
  }, []);

  // Sync selectedChatUser with active participant list changes
  useEffect(() => {
    if (selectedChatUser !== 'everyone') {
      const isStillActive = participants.some((p) => {
        if (p.status !== 'active' && p.status !== 'joined') return false;
        const pUserId = p.user?._id || p.user;
        return String(pUserId) === String(selectedChatUser);
      });
      if (!isStillActive) {
        setSelectedChatUser('everyone');
      }
    }
  }, [participants, selectedChatUser]);



  // Authoritative Host evaluation
  const hostId = room && (typeof room.host === 'object' ? room.host._id : room.host);
  const isHost = !!(room && user && user._id && hostId && String(user._id) === String(hostId));
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

  // Forward declarations for socket messaging reference
  const socketRef = React.useRef(null);

  // Stable wrapper to send socket messages
  const sendSocketMessageWrapper = useCallback((type, payload = {}, to = null) => {
    if (socketRef.current) {
      return socketRef.current(type, payload, to);
    }
    return false;
  }, []);

  // Hook 1: WebRTC media streams layer
  const {
    localStream,
    remoteStreams,
    cameraActive,
    micActive,
    toggleCamera,
    toggleMic,
    initiateCall,
    closePeerConnection,
    handleSignalingMessage
  } = useStudyRoomWebRTC(roomId, user?._id, sendSocketMessageWrapper, isAdmin);

  const handleSocketMessage = useCallback(async (msg) => {
    switch (msg.type) {
      case 'ROOM_INIT_STATE': {
        const { participants: initParticipants, status, isLocked, isMutedAll, allowParticipantUnmute: initAllow, focusSession: initFocus } = msg.payload;
        if (isMutedAll !== undefined) setIsMutedByHost(isMutedAll);
        if (initAllow !== undefined) setAllowParticipantUnmute(initAllow);
        if (isMutedAll && !initAllow) {
          setIsMuteLocked(true);
        } else {
          setIsMuteLocked(false);
        }
        if (initFocus) {
          setFocusSession({
            _id: initFocus.focusSessionId || initFocus._id,
            status: initFocus.status,
            startedAt: initFocus.startedAt,
            plannedDuration: initFocus.plannedDuration,
            endsAt: initFocus.endsAt,
            remainingSeconds: initFocus.remainingSeconds
          });
        } else {
          setFocusSession(null);
        }
        
        // Re-hydrate full participant detail lists from DB but merge camera/mic state
        getStudyRoomParticipants(roomId)
          .then((res) => {
            if (Array.isArray(res)) {
              const fullDetails = res.map((p) => {
                const wsMatch = initParticipants.find(ip => String(ip.participantId) === String(p.user?._id || p.user));
                return {
                  ...p,
                  cameraState: wsMatch ? wsMatch.cameraState : 'CAMERA_OFF',
                  micState: wsMatch ? wsMatch.micState : 'MIC_OFF'
                };
              });
              setParticipants(fullDetails);
            }
          })
          .catch((e) => console.error(e));

        setRoom(prev => prev ? { ...prev, status, isLocked } : null);
        break;
      }

      case 'ROOM_PARTICIPANT_JOINED': {
        const newPart = msg.payload;
        getStudyRoomParticipants(roomId)
          .then((res) => {
            if (Array.isArray(res)) {
              const match = res.find(p => String(p.user?._id || p.user) === String(newPart.participantId));
              if (match) {
                setParticipants(prev => {
                  if (prev.some(p => String(p.user?._id || p.user) === String(newPart.participantId))) return prev;
                  return [...prev, { ...match, cameraState: newPart.cameraState || 'CAMERA_OFF', micState: newPart.micState || 'MIC_OFF' }];
                });
              }
            }
          })
          .catch((e) => console.error(e));

        if (cameraActive) {
          initiateCall(newPart.participantId);
        }
        break;
      }

      case 'ROOM_PARTICIPANT_LEFT': {
        const { participantId } = msg.payload;
        setParticipants(prev => prev.filter(p => String(p.user?._id || p.user) !== String(participantId)));
        closePeerConnection(participantId);
        break;
      }

      case 'PARTICIPANT_CAMERA_CHANGED': {
        const { participantId, cameraState } = msg.payload;
        setParticipants(prev => prev.map((p) => {
          if (String(p.user?._id || p.user) === String(participantId)) {
            return { ...p, cameraState };
          }
          return p;
        }));
        break;
      }

      case 'PARTICIPANT_MIC_CHANGED': {
        const { participantId, micState } = msg.payload;
        setParticipants(prev => prev.map((p) => {
          if (String(p.user?._id || p.user) === String(participantId)) {
            return { ...p, micState };
          }
          return p;
        }));
        break;
      }

      case 'CHAT_MESSAGE_RECEIVED': {
        const newMsg = msg.payload;
        setChatMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        break;
      }

      case 'CHAT_MESSAGE_REJECTED': {
        showToast(msg.payload.message || 'This room is limited to study-related discussion.', 'error');
        break;
      }

      case 'CHAT_MESSAGE_DELETED': {
        const { messageId } = msg.payload;
        setChatMessages(prev => prev.filter(m => m._id !== messageId));
        break;
      }

      case 'CHAT_HISTORY_RESPONSE': {
        const { messages } = msg.payload;
        setChatMessages(messages || []);
        break;
      }

      case 'ROOM_LOCKED':
        setRoom(prev => prev ? { ...prev, isLocked: true } : null);
        break;

      case 'ROOM_UNLOCKED':
        setRoom(prev => prev ? { ...prev, isLocked: false } : null);
        break;

      case 'ROOM_STATUS_CHANGED': {
        const { status } = msg.payload;
        setRoom(prev => prev ? { ...prev, status } : null);
        if (status === 'ENDED') {
          showToast('The host has ended this study session.', 'info');
          navigate('/study-rooms');
        }
        break;
      }

      case 'MUTE_ALL_TRIGGERED': {
        const { allowParticipantUnmute: canUnmute } = msg.payload;
        setAllowParticipantUnmute(canUnmute);
        if (!isHost && !isAdmin) {
          setIsMutedByHost(true);
          setIsMuteLocked(!canUnmute);
          if (micActive) {
            toggleMic();
          }
          showToast('You have been muted by the host.', 'info');
          triggerMuteNotification();
        } else {
          showToast('Mute All has been triggered.', 'info');
        }
        break;
      }

      case 'ALLOW_UNMUTE_TRIGGERED': {
        setAllowParticipantUnmute(true);
        setIsMutedByHost(false);
        setIsMuteLocked(false);
        showToast('Host is now allowing participants to unmute.', 'info');
        break;
      }

      case 'PARTICIPANT_MUTED_TRIGGERED': {
        const { targetUserId } = msg.payload;
        if (user?._id && targetUserId && String(user._id) === String(targetUserId)) {
          setIsMutedByHost(true);
          setIsMuteLocked(true);
          if (micActive) {
            toggleMic();
          }
          showToast('You have been muted by the host.', 'info');
          triggerMuteNotification();
        }
        break;
      }

      case 'PARTICIPANT_UNMUTED_TRIGGERED': {
        const { targetUserId } = msg.payload;
        if (user?._id && targetUserId && String(user._id) === String(targetUserId)) {
          setIsMutedByHost(false);
          setIsMuteLocked(false);
          showToast('Host has allowed you to speak. You can now unmute.', 'info');
        }
        break;
      }

      case 'FOCUS_STARTED':
      case 'FOCUS_PAUSED':
      case 'FOCUS_RESUMED': {
        const sessionPayload = msg.payload;
        setFocusSession(sessionPayload ? {
          _id: sessionPayload.focusSessionId || sessionPayload._id,
          status: sessionPayload.status,
          startedAt: sessionPayload.startedAt,
          plannedDuration: sessionPayload.plannedDuration,
          endsAt: sessionPayload.endsAt,
          remainingSeconds: sessionPayload.remainingSeconds
        } : null);
        break;
      }

      case 'FOCUS_ENDED':
        setFocusSession(null);
        break;

      case 'WEBRTC_OFFER':
      case 'WEBRTC_ANSWER':
      case 'WEBRTC_ICE_CANDIDATE':
        handleSignalingMessage(msg);
        break;

      default:
        break;
    }
  }, [roomId, isHost, isAdmin, micActive, toggleMic, cameraActive, initiateCall, closePeerConnection, handleSignalingMessage, user]);

  // Hook 2: Sockets layer
  const socketToken = isJoined ? token : null;
  const { connectionState, connected, sendSocketMessage } = useStudyRoomSocket(roomId, handleSocketMessage, socketToken);
  
  useEffect(() => {
    socketRef.current = sendSocketMessage;
  }, [sendSocketMessage]);

  useEffect(() => {
    if (connectionState === 'AUTH_ERROR') {
      setError('Your session has expired. Please sign in again.');
    } else if (connectionState === 'JOIN_ERROR') {
      setError('Could not join study room. Please verify your join status.');
    } else if (connectionState === 'ROOM_ERROR') {
      setError('This study room is unavailable.');
    }
  }, [connectionState]);

  // Auto request history for Host / Admin
  useEffect(() => {
    if (connected) {
      console.log('[ROOM SOCKET] authenticated');
    }
  }, [connected]);

  useEffect(() => {
    if (connected && (isHost || isAdmin)) {
      sendSocketMessage('CHAT_HISTORY_REQUESTED');
    }
  }, [connected, isHost, isAdmin, sendSocketMessage]);

  // Auto-start camera for student participants once socket is connected
  useEffect(() => {
    if (connected && !isAdmin && !cameraActive) {
      console.log('[STUDY ROOM] WebRTC initialization starting');
      console.log('[STUDY ROOM] Requesting camera/microphone');
      toggleCamera()
        .then(() => {
          console.log('[STUDY ROOM] Local media acquired');
          console.log('[STUDY ROOM] Local participant rendered');
        })
        .catch((err) => console.error('[WORKSPACE] Auto camera startup failed:', err));
    }
  }, [connected, isAdmin, cameraActive, toggleCamera]);

  // --------------------------------------------------
  // REST LOAD & ACTION HANDLERS
  // --------------------------------------------------

  const loadDataStream = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const [roomRes, participantsRes, focusRes, goalsRes, timelineRes] = await Promise.all([
        getStudyRoom(roomId),
        getStudyRoomParticipants(roomId),
        getCurrentFocusSession(roomId),
        getRoomGoals(roomId),
        getStudyRoomTimeline(roomId)
      ]);

      if (roomRes) setRoom(roomRes);
      if (Array.isArray(participantsRes)) setParticipants(participantsRes);
      if (focusRes) setFocusSession(focusRes);
      else setFocusSession(null);
      if (Array.isArray(goalsRes)) setGoals(goalsRes);
      if (Array.isArray(timelineRes)) setTimeline(timelineRes);
    } catch (err) {
      console.error('Failed to load room workspace stream:', err);
      if (showLoadingState) {
        setError(err.message || 'Failed to fetch room workspace resources.');
      }
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    setIsJoined(false);
  }, [roomId]);

  useEffect(() => {
    const initWorkspace = async () => {
      setLoading(true);
      setError(null);
      setIsJoined(false);
      try {
        console.log('[ROOM AUTH] userId:', user?._id?.toString());
        if (!isAdmin) {
          console.log('[STUDY ROOM] Student join requested');
          console.log('[ROOM JOIN] started');
          console.log('[STUDY ROOM] REST join started');
          const joinRes = await joinStudyRoom(roomId);
          if (!joinRes) {
            setError('Failed to join study room.');
            setLoading(false);
            return;
          }
          console.log('[ROOM JOIN] success');
          console.log('[STUDY ROOM] REST join successful');
          console.log('[STUDY ROOM] Participant ID:', joinRes._id || joinRes.user?._id || joinRes.user);
        } else {
          console.log('[STUDY ROOM] Admin entering room, skipping REST participant creation');
        }

        const t = await refreshAccessToken();
        console.log('[ROOM AUTH] token present:', !!t);
        console.log('[ROOM AUTH] token length:', t ? t.length : 0);
        setToken(t);
        setIsJoined(true);
        console.log('[ROOM SOCKET] connecting');
        console.log('[STUDY ROOM] WebSocket connection starting');

        await loadDataStream(false);
      } catch (err) {
        console.error('Error joining workspace:', err);
        setError(err.message || 'Could not connect to the study room.');
      } finally {
        setLoading(false);
      }
    };

    initWorkspace();

    const pollingInterval = setInterval(() => {
      getStudyRoomTimeline(roomId)
        .then(res => { if (Array.isArray(res)) setTimeline(res); });
      getRoomGoals(roomId)
        .then(res => { if (Array.isArray(res)) setGoals(res); });
    }, 12000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [roomId, refreshAccessToken]);

  const handleLeaveConfirm = async () => {
    setLeaveDialogOpen(false);
    setLoading(true);
    try {
      const res = await leaveStudyRoom(roomId);
      if (res) {
        navigate('/study-rooms');
      } else {
        setError('Failed to safely exit room.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to leave room:', err);
      navigate('/study-rooms');
    }
  };

  const handleSendChat = (text) => {
    const payload = { message: text };
    if (selectedChatUser !== 'everyone') {
      payload.recipientId = selectedChatUser;
    }
    sendSocketMessage('CHAT_MESSAGE_SENT', payload);
  };

  const handleDeleteChat = (msgId) => {
    sendSocketMessage('CHAT_MESSAGE_DELETED', { messageId: msgId });
  };

  if (loading) {
    return <StudyRoomLoading />;
  }

  if (error) {
    return <StudyRoomError errorText={error} />;
  }

  const handleToggleMic = () => {
    if (isMuteLocked && !isHost && !isAdmin) {
      showToast('You cannot unmute: Muted by host.', 'error');
      return;
    }
    toggleMic();
  };

  const handleMuteParticipant = (userId, currentMuteState) => {
    if (currentMuteState) {
      sendSocketMessage('PARTICIPANT_MUTED', { targetUserId: userId });
    } else {
      sendSocketMessage('PARTICIPANT_UNMUTED', { targetUserId: userId });
    }
  };

  return (
    <div className="study-room-workspace-wrapper" data-testid="workspace-container" style={{
      backgroundColor: '#070b16',
      color: '#fff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {showMuteNotification && !isHost && !isAdmin && (
        <div style={{
          backgroundColor: '#9a3412',
          color: '#fff',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '0.82rem',
          fontWeight: 700,
          boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.05)'
        }}>
          You have been muted by the host and cannot unmute yourself.
        </div>
      )}

      {/* Redesigned Workspace Header */}
      <StudyRoomHeader
        room={room}
        isHost={isHost}
        cameraActive={cameraActive}
        onToggleCamera={toggleCamera}
        micActive={micActive}
        onToggleMic={handleToggleMic}
        onLeave={() => setLeaveDialogOpen(true)}
        activeCount={participants.length}
      />

      {/* Offline/Reconnecting banner status */}
      {connectionState === 'RECONNECTING' && (
        <div className="socket-reconnecting-banner" style={{
          backgroundColor: '#991b1b',
          color: '#fff',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '0.82rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.05)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#ef4444',
            borderRadius: '50%',
            animation: 'pulse 1.5s infinite'
          }} />
          <span>Reconnecting...</span>
        </div>
      )}

      {/* Main Content Layout Grid */}
      <main className="study-room-workspace-content" style={{
        flex: 1,
        display: 'flex',
        padding: '20px',
        gap: '20px',
        boxSizing: 'border-box'
      }}>
        {/* LEFT COLUMN: Dominant Video Grid and Compact Panels at bottom */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Grid Area */}
          <div style={{ flex: 1 }}>
            <StudyRoomParticipantGrid
              participants={participants}
              capacity={room?.capacity || 8}
              currentUserId={user?._id}
              localStream={localStream}
              remoteStreams={remoteStreams}
              localCameraActive={cameraActive}
              localMicActive={micActive}
              roomHostId={hostId}
              currentUserIsHostOrAdmin={isAdmin}
              onMuteParticipant={handleMuteParticipant}
            />
          </div>

          {/* Bottom compact panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <StudyRoomFocusPanel
              roomId={roomId}
              focusSession={focusSession}
              isHost={isAdmin}
              onRefresh={() => loadDataStream(false)}
            />

            <StudyRoomGoalPanel
              roomId={roomId}
              goals={goals}
              onRefresh={() => loadDataStream(false)}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar holding Info, Host Controls, Chat and Timeline */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
          <StudyRoomInfoPanel room={room} />
          
          {isAdmin && (
            <StudyRoomHostControls
              roomId={roomId}
              room={room}
              onRefresh={() => loadDataStream(false)}
              sendSocketMessage={sendSocketMessage}
            />
          )}

          <StudyRoomChat
            messages={chatMessages}
            onSendMessage={handleSendChat}
            onDeleteMessage={handleDeleteChat}
            currentUserId={user?._id}
            isHost={false}
            isAdmin={isAdmin}
            participants={participants}
            selectedChatUser={selectedChatUser}
            onSelectChatUser={setSelectedChatUser}
          />

          <StudyRoomTimeline logs={timeline} />
        </div>
      </main>

      {/* Dialog Confirmations */}
      <LeaveRoomDialog
        isOpen={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        onConfirm={handleLeaveConfirm}
      />
    </div>
  );
}
export { StudyRoomWorkspace };
