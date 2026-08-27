import React from 'react';

export default function RoomTimeline({ logs }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventDescription = (log) => {
    const userName = log.user?.name || log.user?.username || 'System';
    const metadata = log.metadata || {};

    switch (log.eventType) {
      case 'ROOM_CREATED':
        return `Room created by ${userName}`;
      case 'ROOM_STARTED':
        return `Room started live by ${userName}`;
      case 'ROOM_ENDED':
        return `Room ended by ${userName}`;
      case 'ROOM_LOCKED':
        return `Room locked by ${userName}`;
      case 'ROOM_UNLOCKED':
        return `Room unlocked by ${userName}`;
      case 'PARTICIPANT_JOINED':
        return `${userName} joined the room`;
      case 'PARTICIPANT_LEFT':
        return `${userName} left the room`;
      case 'FOCUS_STARTED':
        return `Focus timer started (${metadata.plannedDuration || 25} min) by ${userName}`;
      case 'FOCUS_ENDED':
        return `Focus timer ended or completed`;
      case 'GOAL_CREATED':
        return `Personal study goal created by ${userName}`;
      case 'GOAL_COMPLETED':
        return `Personal study goal completed by ${userName}`;
      default:
        return log.eventType.replace('_', ' ').toLowerCase();
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
        No activity logs recorded for this study room.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="admin-scrollbar">
      <div className="drawer-timeline-list">
        {logs.map((log, idx) => (
          <div key={log._id || idx} className={`timeline-row ${idx === 0 ? 'active' : ''}`}>
            <div className="timeline-indicator-dot" />
            <div className="timeline-content-card">
              <span className="timeline-content-desc">{getEventDescription(log)}</span>
              <span className="timeline-content-time">{formatTime(log.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
