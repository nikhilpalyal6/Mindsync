import { useEffect, useRef, useState, useCallback } from 'react';
import { showToast } from '../../components/Toast';

/**
 * WebRTC Mesh video/audio signaling manager for Study Rooms
 */
export default function useStudyRoomWebRTC(roomId, currentUserId, sendSocketMessage, isAdmin = false) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // userId -> RTCPeerConnection

  const isSupported = typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices;

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Close peer connection for a single user
  const closePeerConnection = useCallback((userId) => {
    const pc = peersRef.current.get(userId);
    if (pc) {
      pc.close();
      peersRef.current.delete(userId);
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  // Cleanup all connections
  const cleanupAll = useCallback(() => {
    peersRef.current.forEach((pc) => {
      pc.close();
    });
    peersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStreams({});
    setCameraActive(false);
    setMicActive(false);
  }, []);

  // Initialize a peer connection
  const getOrCreatePeerConnection = useCallback((targetUserId, isCaller) => {
    if (!isSupported) return null;
    if (peersRef.current.has(targetUserId)) {
      return peersRef.current.get(targetUserId);
    }

    console.log(`[WEBRTC CLIENT] Creating RTCPeerConnection for target user: ${targetUserId}. IsCaller: ${isCaller}`);
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSocketMessage('WEBRTC_ICE_CANDIDATE', { candidate: event.candidate }, targetUserId);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WEBRTC CLIENT] Received remote video/audio track from: ${targetUserId}`);
      const remoteStream = event.streams[0] || new MediaStream();
      setRemoteStreams((prev) => ({
        ...prev,
        [targetUserId]: remoteStream
      }));
    };

    // Add local tracks if stream is loaded
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peersRef.current.set(targetUserId, pc);
    return pc;
  }, [isSupported, sendSocketMessage]);

  const initiateCall = useCallback(async (targetUserId) => {
    if (isAdmin) return;
    const pc = getOrCreatePeerConnection(targetUserId, true);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSocketMessage('WEBRTC_OFFER', { offer }, targetUserId);
    } catch (err) {
      console.error(`[WEBRTC CLIENT] Failed to create offer for ${targetUserId}:`, err);
    }
  }, [getOrCreatePeerConnection, sendSocketMessage, isAdmin]);

  // Request media access (helper)
  const ensureMediaAccess = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    
    try {
      setPermissionError(false);
      console.log('[WEBRTC CLIENT] Requesting camera and microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Default to track disabled (off) state initially until toggled
      stream.getVideoTracks().forEach(t => { t.enabled = false; });
      stream.getAudioTracks().forEach(t => { t.enabled = false; });

      // Add local tracks to any already-created peer connections
      peersRef.current.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (err) {
      console.error('[WEBRTC CLIENT] getUserMedia permission denied:', err);
      setPermissionError(true);
      showToast('Camera and microphone permission denied.', 'error');
      throw err;
    }
  };

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (isAdmin) return;
    try {
      const stream = await ensureMediaAccess();
      const newCameraState = !cameraActive;
      
      stream.getVideoTracks().forEach(track => {
        track.enabled = newCameraState;
      });
      
      setCameraActive(newCameraState);
      sendSocketMessage('TOGGLE_CAMERA', { cameraState: newCameraState ? 'CAMERA_ON' : 'CAMERA_OFF' });

      // Trigger renegotiation on state change to caller
      peersRef.current.forEach(async (pc, targetUserId) => {
        if (String(currentUserId) > String(targetUserId)) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSocketMessage('WEBRTC_OFFER', { offer }, targetUserId);
          } catch (e) {
            console.error(e);
          }
        }
      });
    } catch (e) {
      console.error(e);
    }
  }, [cameraActive, currentUserId, sendSocketMessage, isAdmin]);

  // Toggle Microphone
  const toggleMic = useCallback(async () => {
    if (isAdmin) return;
    try {
      const stream = await ensureMediaAccess();
      const newMicState = !micActive;
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = newMicState;
      });
      
      setMicActive(newMicState);
      sendSocketMessage('TOGGLE_MIC', { micState: newMicState ? 'MIC_ON' : 'MIC_OFF' });
    } catch (e) {
      console.error(e);
    }
  }, [micActive, sendSocketMessage, isAdmin]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (msg) => {
    if (!isSupported) return;

    const fromUserId = msg.from;
    const type = msg.type;

    switch (type) {
      case 'WEBRTC_OFFER': {
        const pc = getOrCreatePeerConnection(fromUserId, false);
        if (!pc) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.offer));
          if (pc._pendingCandidates && pc._pendingCandidates.length > 0) {
            for (const cand of pc._pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.error(e));
            }
            pc._pendingCandidates = [];
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSocketMessage('WEBRTC_ANSWER', { answer }, fromUserId);
        } catch (err) {
          console.error('[WEBRTC CLIENT] Error handling offer:', err);
        }
        break;
      }

      case 'WEBRTC_ANSWER': {
        const pc = peersRef.current.get(fromUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
            if (pc._pendingCandidates && pc._pendingCandidates.length > 0) {
              for (const cand of pc._pendingCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.error(e));
              }
              pc._pendingCandidates = [];
            }
          } catch (err) {
            console.error('[WEBRTC CLIENT] Error handling answer:', err);
          }
        }
        break;
      }

      case 'WEBRTC_ICE_CANDIDATE': {
        const pc = peersRef.current.get(fromUserId);
        if (pc && msg.payload.candidate) {
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
            } else {
              if (!pc._pendingCandidates) pc._pendingCandidates = [];
              pc._pendingCandidates.push(msg.payload.candidate);
            }
          } catch (err) {
            console.error('[WEBRTC CLIENT] Error adding ICE candidate:', err);
          }
        }
        break;
      }

      default:
        break;
    }
  }, [isSupported, getOrCreatePeerConnection, sendSocketMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  return {
    localStream,
    remoteStreams,
    cameraActive,
    micActive,
    permissionError,
    toggleCamera,
    toggleMic,
    initiateCall,
    closePeerConnection,
    handleSignalingMessage,
    isSupported
  };
}
export { useStudyRoomWebRTC };
