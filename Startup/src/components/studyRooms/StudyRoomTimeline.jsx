import React from 'react';
import { Activity } from 'lucide-react';

export default function StudyRoomTimeline({ logs = [] }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEventDescription = (log) => {
    const userName = log.user?.name || log.user?.username || 'Someone';
    switch (log.eventType) {
      case 'ROOM_CREATED':
        return `Room created by ${userName}`;
      case 'ROOM_STARTED':
        return `Room is now Live!`;
      case 'ROOM_ENDED':
        return `Focus room ended`;
      case 'ROOM_LOCKED':
        return `Room locked by host`;
      case 'ROOM_UNLOCKED':
        return `Room unlocked by host`;
      case 'PARTICIPANT_JOINED':
        return `${userName} joined the room`;
      case 'PARTICIPANT_LEFT':
        return `${userName} left the room`;
      case 'FOCUS_STARTED':
        return `Focus timer started`;
      case 'FOCUS_ENDED':
        return `Focus timer ended`;
      case 'GOAL_CREATED':
        return `${userName} set a focus goal`;
      case 'GOAL_COMPLETED':
        return `${userName} completed a goal! 🎉`;
      default:
        return log.eventType.replace('_', ' ').toLowerCase();
    }
  };

  return (
    <div className="workspace-timeline-card">
      <div className="timeline-card-header">
        <Activity size={15} />
        <span>ACTIVITY FEED</span>
      </div>

      <div className="timeline-activity-list admin-scrollbar">
        {logs.length === 0 ? (
          <div className="timeline-empty-state">
            Activity feed is silent.
          </div>
        ) : (
          logs.slice(0, 12).map((log, idx) => (
            <div key={log._id || idx} className="workspace-timeline-row">
              <span className="timeline-row-bullet" />
              <div className="timeline-row-content">
                <span className="timeline-row-text">{getEventDescription(log)}</span>
                <span className="timeline-row-time">{formatTime(log.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
