import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook to manage the real-time WebSocket connection to a Study Room.
 * Connects with states: CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED, AUTH_ERROR.
 */
export default function useStudyRoomSocket(roomId, onMessageCallback, token) {
  const [connectionState, setConnectionState] = useState('CONNECTING');
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onMessageCallbackRef = useRef(onMessageCallback);
  useEffect(() => {
    onMessageCallbackRef.current = onMessageCallback;
  }, [onMessageCallback]);

  const connect = useCallback(() => {
    if (!roomId || !token) {
      setConnectionState('CONNECTING');
      return;
    }

    if (socketRef.current) {
      isIntentionalCloseRef.current = true;
      socketRef.current.close();
    }

    isIntentionalCloseRef.current = false;
    setConnectionState('CONNECTING');

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
    let host = window.location.host;
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const url = new URL(apiBase);
      host = url.host;
    }

    const wsUrl = `${wsProtocol}//${host}/api/v1/study-rooms/realtime?roomId=${roomId}&token=${token}`;
    
    console.log(`[SOCKET CLIENT] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[SOCKET CLIENT] WebSocket connection established successfully.');
      console.log('[STUDY ROOM] WebSocket connected');
      setConnectionState('CONNECTED');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (onMessageCallbackRef.current) {
          onMessageCallbackRef.current(msg);
        }
      } catch (err) {
        console.error('[SOCKET CLIENT] Failed to parse message frame:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[SOCKET CLIENT] WebSocket closed. Code: ${event.code}. Reason: ${event.reason}`);
      
      if (isIntentionalCloseRef.current) {
        setConnectionState('DISCONNECTED');
        return;
      }

      // Differentiate close codes for state machine robustness
      if (event.code === 4001) {
        setConnectionState('AUTH_ERROR');
        console.error(`[SOCKET CLIENT] Fatal auth error: ${event.reason}`);
        return;
      }
      if (event.code === 4003) {
        setConnectionState('JOIN_ERROR');
        console.error(`[SOCKET CLIENT] Join validation failed: ${event.reason}`);
        return;
      }
      if (event.code === 4004) {
        setConnectionState('ROOM_ERROR');
        console.error(`[SOCKET CLIENT] Room error: ${event.reason}`);
        return;
      }

      setConnectionState('RECONNECTING');
      
      // Auto reconnect on unexpected close (excluding purposeful user closure codes like 1000/1001)
      if (event.code !== 1000 && event.code !== 1001) {
        console.log('[SOCKET CLIENT] Connection lost. Attempting reconnection in 5s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      } else {
        setConnectionState('DISCONNECTED');
      }
    };

    ws.onerror = (err) => {
      console.error('[SOCKET CLIENT] WebSocket error observed:', err);
    };
  }, [roomId, token]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        isIntentionalCloseRef.current = true;
        socketRef.current.close(1000, 'Component unmounted');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [roomId, token, connect]);

  const sendSocketMessage = useCallback((type, payload = {}, to = null) => {
    if (!socketRef.current || socketRef.current.readyState !== 1) {
      console.warn('[SOCKET CLIENT] Cannot send message: Socket is not open.');
      return false;
    }
    const message = { type, payload, to };
    socketRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  return {
    connectionState,
    connected: connectionState === 'CONNECTED',
    sendSocketMessage
  };
}
export { useStudyRoomSocket };
