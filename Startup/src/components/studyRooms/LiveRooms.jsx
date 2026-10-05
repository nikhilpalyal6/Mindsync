import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { joinStudyRoom } from '../../services/api';
import { showToast } from '../Toast';

export default function LiveRooms({ rooms = [], currentUser, onStateChanged, onViewAllClick }) {
  const navigate = useNavigate();
  const [loadingRoomId, setLoadingRoomId] = useState(null);

  const liveRooms = rooms.filter((r) => r.status === 'LIVE');

  const getElapsedString = (startStr) => {
    if (!startStr) return 'Live study';
    const elapsedMs = Date.now() - new Date(startStr).getTime();
    const elapsedMins = Math.max(0, Math.floor(elapsedMs / (60 * 1000)));
    if (elapsedMins < 60) return `${elapsedMins}m elapsed`;
    return `${Math.floor(elapsedMins / 60)}h elapsed`;
  };

  const handleJoin = async (roomId) => {
    setLoadingRoomId(roomId);
    console.log(`JOIN REQUEST\nroomId: ${roomId}\nuserId: ${currentUser?._id}`);
    try {
      const res = await joinStudyRoom(roomId);
      console.log(`JOIN RESPONSE\nstatus: success\nresponse:`, res);
      if (res) {
        showToast('Joined live study room successfully!', 'success');
        onStateChanged();
        navigate(`/study-rooms/${roomId}`);
      } else {
        showToast('Failed to join room', 'error');
      }
    } catch (err) {
      console.error(err);
      console.log(`JOIN RESPONSE\nstatus: error\nresponse:`, err.message);
      showToast(err.message || 'Error joining study room', 'error');
    } finally {
      setLoadingRoomId(null);
    }
  };

  return (
    <div className="column-section">
      <div className="column-header">
        <h2>
          <span style={{ color: '#ef4444' }}>●</span> Live Now
        </h2>
        <button
          type="button"
          className="column-header-link"
          onClick={onViewAllClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View all
        </button>
      </div>

      <div className="column-rows-list">
        {liveRooms.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px', margin: 0 }}>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              No live study rooms
            </p>
          </div>
        ) : (
          liveRooms.slice(0, 3).map((room) => {
            const isJoined = room.isCurrentUserParticipant;
            return (
              <div key={room._id} className="live-row-card">
                <div className="live-row-top">
                  <div className="live-row-info">
                    <h3>{room.title}</h3>
                    <p>{room.description || 'General study and focus session.'}</p>
                  </div>
                  <span className="live-badge-glow">LIVE</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
                  <div className="live-row-avatars-bar">
                    <div className="avatar-stack">
                      {Array.from({ length: Math.min(room.participantsCount || 0, 4) }).map((_, idx) => (
                        <div
                          key={idx}
                          className="stack-img"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#1e293b',
                            border: '2px solid #0f172a',
                            color: '#60a5fa',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px'
                          }}
                        >
                          👤
                        </div>
                      ))}
                    </div>
                    {room.participantsCount > 4 && (
                      <span className="stack-more-badge">+{room.participantsCount - 4}</span>
                    )}
                  </div>

                  <span className="live-row-duration">
                    <Clock size={12} />
                    <span>{getElapsedString(room.actualStart || room.createdAt)}</span>
                  </span>
                </div>

                <div className="live-row-bottom">
                  <span className="live-row-seats">
                    {room.participantsCount} / {room.capacity}
                    <span>studying</span>
                  </span>

                  {isJoined ? (
                    <button
                      type="button"
                      className="btn-live-join"
                      onClick={() => navigate(`/study-rooms/${room._id}`)}
                      style={{ background: 'var(--admin-success)', color: '#fff' }}
                    >
                      Enter
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-live-join"
                      onClick={() => handleJoin(room._id)}
                      disabled={loadingRoomId === room._id}
                    >
                      {loadingRoomId === room._id ? 'Joining...' : 'Join Room'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
