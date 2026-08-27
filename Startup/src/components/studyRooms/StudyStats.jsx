import React from 'react';
import { Clock, Users, CheckSquare, Flame, ChevronDown } from 'lucide-react';

export default function StudyStats() {
  return (
    <div className="sidebar-stats-panel">
      <div className="stats-panel-header">
        <span>Your Study</span>
        <select aria-label="Select timeframe">
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="stats-sparkline-box">
        <svg className="sparkline-svg" viewBox="0 0 100 30" aria-label="Study progress chart">
          <path className="sparkline-path" d="M0,25 Q15,5 30,20 T60,8 T90,18 T100,10" />
        </svg>
      </div>

      <div className="stats-rows">
        <div className="stat-row-item">
          <div className="stat-row-icon purple">
            <Clock size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">4h 32m</span>
            <span className="stat-row-lbl">Focused Time</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon green">
            <Users size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">7</span>
            <span className="stat-row-lbl">Sessions</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon white">
            <CheckSquare size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">12 / 14</span>
            <span className="stat-row-lbl">Goals Completed</span>
          </div>
        </div>

        <div className="stat-row-item">
          <div className="stat-row-icon orange">
            <Flame size={16} />
          </div>
          <div className="stat-row-info">
            <span className="stat-row-val">8</span>
            <span className="stat-row-lbl">Day Streak</span>
          </div>
        </div>
      </div>
    </div>
  );
}
