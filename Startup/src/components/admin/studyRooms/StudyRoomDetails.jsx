import React, { useState, useEffect, useCallback } from 'react';
import StudyRoomStatusBadge from './StudyRoomStatusBadge';
import ParticipantList from './ParticipantList';
import RoomTimeline from './RoomTimeline';
import {
  getStudyRoomParticipants,
  getStudyRoomTimeline,
  getStudyRoomChat,
  deleteStudyRoomChatMessage
} from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useStudyRoomSocket } from '../../../hooks/studyRooms/useStudyRoomSocket';
import { showToast } from '../../../components/Toast';

export default function StudyRoomDetails({ room, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('participants');
  const [participants, setParticipants] = useState([]);
  const [logs, setLogs] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const { refreshAccessToken } = useAuth();
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (isOpen && room && room.status === 'LIVE') {
      refreshAccessToken()
        .then(t => setToken(t))
        .catch(err => console.error('Failed to get token for admin socket:', err));
    } else {
      setToken(null);
    }
  }, [isOpen, room]);

  const handleSocketMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'ROOM_INIT_STATE': {
        const { participants: wsParts } = msg.payload;
        setParticipants(prev => prev.map(p => {
          const match = wsParts.find(wp => wp.participantId === (p.user?._id || p.user));
          return {
            ...p,
            micState: match ? match.micState : 'MIC_OFF',
            cameraState: match ? match.cameraState : 'CAMERA_OFF'
          };
        }));
        break;
      }
      case 'ROOM_PARTICIPANT_JOINED': {
        const newPart = msg.payload;
        setParticipants(prev => {
          if (prev.some(p => (p.user?._id || p.user) === newPart.participantId)) {
            return prev.map(p => {
              if ((p.user?._id || p.user) === newPart.participantId) {
                return { ...p, status: 'active', micState: newPart.micState || 'MIC_OFF', cameraState: newPart.cameraState || 'CAMERA_OFF' };
              }
              return p;
            });
          }
          return [...prev, {
            user: { _id: newPart.participantId, name: 'Student' },
            role: newPart.role,
            status: 'active',
            micState: newPart.micState || 'MIC_OFF',
            cameraState: newPart.cameraState || 'CAMERA_OFF'
          }];
        });
        break;
      }
      case 'ROOM_PARTICIPANT_LEFT': {
        const { participantId } = msg.payload;
        setParticipants(prev => prev.map(p => {
          if ((p.user?._id || p.user) === participantId) {
            return { ...p, status: 'left' };
          }
          return p;
        }));
        break;
      }
      case 'PARTICIPANT_CAMERA_CHANGED': {
        const { participantId, cameraState } = msg.payload;
        setParticipants(prev => prev.map(p => {
          if ((p.user?._id || p.user) === participantId) {
            return { ...p, cameraState };
          }
          return p;
        }));
        break;
      }
      case 'PARTICIPANT_MIC_CHANGED': {
        const { participantId, micState } = msg.payload;
        setParticipants(prev => prev.map(p => {
          if ((p.user?._id || p.user) === participantId) {
            return { ...p, micState };
          }
          return p;
        }));
        break;
      }
      case 'MUTE_ALL_TRIGGERED': {
        setParticipants(prev => prev.map(p => {
          if (p.role !== 'HOST') {
            return { ...p, micState: 'MIC_OFF' };
          }
          return p;
        }));
        break;
      }
      case 'PARTICIPANT_MUTED_TRIGGERED': {
        const { targetUserId } = msg.payload;
        setParticipants(prev => prev.map(p => {
          if (String(p.user?._id || p.user) === String(targetUserId)) {
            return { ...p, micState: 'MIC_OFF' };
          }
          return p;
        }));
        break;
      }
      default:
        break;
    }
  }, [room]);

  const { sendSocketMessage } = useStudyRoomSocket(
    room && room.status === 'LIVE' && token ? room._id : null,
    handleSocketMessage,
    token
  );

  const handleMuteAll = () => {
    sendSocketMessage('MUTE_ALL', { allowParticipantUnmute: false });
    showToast('Muted all participants.', 'success');
  };

  const handleAllowEveryone = () => {
    sendSocketMessage('ALLOW_UNMUTE', {});
    showToast('Allowed all participants to speak.', 'success');
  };

  const handleMuteParticipant = (userId, currentMicState) => {
    if (currentMicState === 'MIC_ON') {
      sendSocketMessage('PARTICIPANT_MUTED', { targetUserId: userId });
      showToast('Participant muted remotely.', 'success');
    } else {
      sendSocketMessage('PARTICIPANT_UNMUTED', { targetUserId: userId });
      showToast('Participant allowed to speak.', 'success');
    }
  };

  const fetchTabDetails = () => {
    if (!isOpen || !room) return;
    setLoading(true);

    if (activeTab === 'participants') {
      getStudyRoomParticipants(room._id)
        .then((res) => {
          if (Array.isArray(res)) setParticipants(res);
        })
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    } else if (activeTab === 'timeline') {
      getStudyRoomTimeline(room._id)
        .then((res) => {
          if (Array.isArray(res)) setLogs(res);
        })
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    } else if (activeTab === 'chat') {
      getStudyRoomChat(room._id)
        .then((res) => {
          if (Array.isArray(res)) setChatMessages(res);
        })
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchTabDetails();
  }, [isOpen, room, activeTab]);

  if (!isOpen || !room) return null;

  const hostName = room.host?.name || room.host?.username || 'Unknown Host';
  const formatScheduledTime = (dateStr) => {
    if (!dateStr) return 'Flexible';
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleModerateChat = (chatId) => {
    if (!window.confirm('Are you sure you want to moderate and delete this chat message?')) return;
    deleteStudyRoomChatMessage(room._id, chatId)
      .then(() => {
        setChatMessages(prev => prev.filter(m => m._id !== chatId));
      })
      .catch(e => console.error(e));
  };

  return (
    <div className="admin-drawer-overlay">
      <div className="admin-drawer-panel">
        <div className="admin-drawer-header">
          <div>
            <h2>Study Room Details</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
              ID: {room._id}
            </span>
          </div>
          <button type="button" className="btn-close-drawer" onClick={onClose} aria-label="Close Details">
            ✕
          </button>
        </div>

        <div className="admin-drawer-content">
          {/* Metadata Section */}
          <div className="detail-grid">
            <div className="detail-item-box">
              <span className="detail-item-label">Title</span>
              <span className="detail-item-value">{room.title}</span>
            </div>
            <div className="detail-item-box">
              <span className="detail-item-label">Status</span>
              <div>
                <StudyRoomStatusBadge status={room.status} />
              </div>
            </div>
            <div className="detail-item-box" style={{ gridColumn: 'span 2' }}>
              <span className="detail-item-label">Description</span>
              <span className="detail-item-value" style={{ fontWeight: 'normal', color: 'var(--admin-text-muted)' }}>
                {room.description || 'No description provided.'}
              </span>
            </div>
            <div className="detail-item-box">
              <span className="detail-item-label">Host</span>
              <span className="detail-item-value">{hostName}</span>
            </div>
            <div className="detail-item-box">
              <span className="detail-item-label">Capacity</span>
              <span className="detail-item-value">
                {room.participantsCount || 0} / {room.capacity} seats
              </span>
            </div>
            <div className="detail-item-box">
              <span className="detail-item-label">Scheduled Start</span>
              <span className="detail-item-value">{formatScheduledTime(room.scheduledStart)}</span>
            </div>
            <div className="detail-item-box">
              <span className="detail-item-label">Topic / Subject</span>
              <span className="detail-item-value">{room.workshopId?.title || 'General Focus'}</span>
            </div>
          </div>

          {/* Room Controls (Only if room is LIVE) */}
          {room.status === 'LIVE' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--admin-primary)', letterSpacing: '0.05em' }}>ROOM CONTROLS</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleMuteAll}
                  style={{
                    flex: 1,
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🎙 Mute All
                </button>
                <button
                  type="button"
                  onClick={handleAllowEveryone}
                  style={{
                    flex: 1,
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔊 Allow Everyone to Speak
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="admin-drawer-tabs">
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              Participants ({room.participantsCount || 0})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Activity Timeline
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat History
            </button>
          </div>

          {/* Loading Shimmer */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--admin-text-muted)' }}>
              Loading data stream...
            </div>
          ) : activeTab === 'participants' ? (
            <ParticipantList
              participants={participants}
              isLive={room.status === 'LIVE'}
              onMuteParticipant={handleMuteParticipant}
            />
          ) : activeTab === 'timeline' ? (
            <RoomTimeline logs={logs} />
          ) : (
            <div className="admin-chat-moderation-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
                  No study chat messages logged.
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg._id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '85%' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                        <strong>{msg.sender?.name || msg.sender?.username || 'User'}</strong> • {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <p style={{ fontSize: '0.8rem', margin: 0, color: 'rgba(255, 255, 255, 0.87)', wordBreak: 'break-word' }}>
                        {msg.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleModerateChat(msg._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--admin-danger)',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
