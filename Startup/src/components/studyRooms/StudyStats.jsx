import React from 'react';
import { Clock, Users, CheckSquare, Flame, ChevronDown } from 'lucide-react';

export default function StudyStats({ rooms = [] }) {
  const userRooms = rooms.filter((r) => r.isCurrentUserParticipant);
  const totalSessions = userRooms.length;

  let totalMinutes = 0;
  for (const r of userRooms) {
    if (r.actualStart && r.actualEnd) {
      const diff = Math.max(0, Math.round((new Date(r.actualEnd) - new Date(r.actualStart)) / 60000));
      totalMinutes += diff;
    } else if (r.status === 'LIVE' && r.actualStart) {
      const diff = Math.max(0, Math.round((Date.now() - new Date(r.actualStart)) / 60000));
      totalMinutes += diff;
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeFormatted = totalMinutes > 0 ? `${hours > 0 ? `${hours}h ` : ''}${mins}m` : '0m';
  const liveCount = userRooms.filter((r) => r.status === 'LIVE').length;
  const streak = totalSessions > 0 ? 1 : 0;

  return (
    <div className="sidebar-stats-panel">
      <div className="stats-panel-header">
        <span>Your Study</span>
        <select aria-label="Select timeframe" disabled>
          <option value="all">All Time</option>
        </select>
      </div>

      <div className="stats-sparkline-box">
        <svg className="sparkline-svg" viewBox="0 0 100 30" aria-label="Study progress chart">
          <path
            className="sparkline-path"
            d={totalSessions > 0 ? "M0,25 Q15,5 30,20 T60,8 T90,18 T100,10" : "M0,25 L100,25"}
          />
        </svg>
      </div>

      <div className="stats-rows">
        <div className="stat-row-item">
          <div className="stat-row-icon purple">
            <Clock size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">{timeFormatted}</span>
            <span className="stat-row-lbl">Focused Time</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon green">
            <Users size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">{totalSessions}</span>
            <span className="stat-row-lbl">Sessions</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon white">
            <CheckSquare size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">{liveCount}</span>
            <span className="stat-row-lbl">Active Now</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon orange">
            <Flame size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">{streak}</span>
            <span className="stat-row-lbl">Day Streak</span>
          </div>
        </div>
      </div>
    </div>
  );
}
