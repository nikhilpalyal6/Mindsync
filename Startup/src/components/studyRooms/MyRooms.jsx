import React from 'react';
import { Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyRooms({ rooms = [], currentUser, onStateChanged, onExploreClick, onViewAllClick }) {
  const navigate = useNavigate();

  // Filters rooms joined or hosted by the current user
  const myRoomsList = rooms.filter(
    (r) =>
      r.isCurrentUserParticipant ||
      (r.host && (r.host._id || r.host) === currentUser?._id)
  );

  const formatRoomSchedule = (room) => {
    if (room.scheduledStart) {
      return new Date(room.scheduledStart).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'Flexible study session';
  };

  return (
    <div className="column-section" data-testid="my-rooms-column">
      <div className="column-header">
        <h2>My Rooms</h2>
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
        {myRoomsList.length === 0 ? (
          <div className="my-rooms-empty-container" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
              You haven't joined any rooms yet
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onExploreClick}
              style={{ width: '100%' }}
            >
              Explore Rooms
            </button>
          </div>
        ) : (
          <>
            {myRoomsList.slice(0, 2).map((room) => (
              <div
                key={room._id}
                className="my-row-card"
                style={{ cursor: room.status === 'LIVE' ? 'pointer' : 'default' }}
                onClick={() => {
                  if (room.status === 'LIVE') {
                    navigate(`/study-rooms/${room._id}`);
                  }
                }}
              >
                <div className="my-row-left">
                  <div className="my-row-icon-circle orange">
                    <Target size={16} />
                  </div>
                  <div className="my-row-info">
                    <h3>{room.title}</h3>
                    <div className="my-row-schedule">{formatRoomSchedule(room)}</div>
                    <span className="my-row-seats">{room.capacity} seats</span>
                  </div>
                </div>

                <span className="my-row-badge-joined" style={{ background: room.status === 'LIVE' ? 'var(--admin-success)' : 'rgba(255,255,255,0.06)' }}>
                  {room.status === 'LIVE' ? 'Enter' : 'Joined'}
                </span>
              </div>
            ))}

            {/* Explore/No more rooms prompt at the bottom of the list */}
            {myRoomsList.length > 2 && (
              <div className="my-rooms-empty-container">
                <p>No more rooms yet. Explore and join study sessions.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onExploreClick}
                  style={{ width: '100%' }}
                >
                  Explore Rooms
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
