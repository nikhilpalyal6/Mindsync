import React from 'react';
import { Info, Calendar, Shield, Clock, BookOpen } from 'lucide-react';

export default function StudyRoomInfoPanel({ room }) {
  if (!room) return null;

  const hostName = room.host?.name || room.host?.username || 'Unknown';
  const topicName = room.workshopId?.title || 'General Focus';
  const visibility = room.visibility || 'PUBLIC';

  const formatScheduledTime = (dateStr) => {
    if (!dateStr) return 'Flexible study session';
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = () => {
    if (room.scheduledStart && room.scheduledEnd) {
      const diff = Math.round((new Date(room.scheduledEnd) - new Date(room.scheduledStart)) / 60000);
      return `${diff} minutes`;
    }
    return 'Self-paced session';
  };

  return (
    <div className="workspace-info-card">
      <div className="info-card-header">
        <Info size={15} />
        <span>ROOM INFORMATION</span>
      </div>

      <div className="info-grid-list">
        <div className="info-grid-row">
          <BookOpen size={14} className="info-row-icon" />
          <div className="info-row-data">
            <span className="info-data-label">Topic / Subject</span>
            <span className="info-data-value">{topicName}</span>
          </div>
        </div>

        <div className="info-grid-row">
          <Calendar size={14} className="info-row-icon" />
          <div className="info-row-data">
            <span className="info-data-label">Scheduled Time</span>
            <span className="info-data-value">{formatScheduledTime(room.scheduledStart)}</span>
          </div>
        </div>

        <div className="info-grid-row">
          <Clock size={14} className="info-row-icon" />
          <div className="info-row-data">
            <span className="info-data-label">Planned Duration</span>
            <span className="info-data-value">{calculateDuration()}</span>
          </div>
        </div>

        <div className="info-grid-row">
          <Shield size={14} className="info-row-icon" />
          <div className="info-row-data">
            <span className="info-data-label">Room Moderator/Admin</span>
            <span className="info-data-value">{hostName}</span>
          </div>
        </div>

        <div className="info-grid-row">
          <div className="info-row-icon" style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚿</div>
          <div className="info-row-data">
            <span className="info-data-label">Privacy Lock</span>
            <span className="info-data-value">{visibility}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
