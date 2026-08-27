import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { showToast } from '../Toast';

export default function StudyRoomFilters({
  searchQuery,
  onSearchChange,
  subjectFilter,
  onSubjectChange,
  statusFilter,
  onStatusChange,
  durationFilter,
  onDurationChange
}) {
  const subjects = ['DSA', 'Java', 'Python', 'DBMS', 'Operating Systems', 'GATE', 'Web Dev', 'Mathematics'];

  return (
    <div className="toolbar-pill-section">
      <div className="search-pill-wrapper">
        <Search size={18} className="search-pill-icon" />
        <input
          type="text"
          className="search-pill-input"
          placeholder="Search rooms, topics, or subjects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filters-pill-group">
        <select
          className="select-pill"
          value={subjectFilter}
          onChange={(e) => onSubjectChange(e.target.value)}
          aria-label="Filter by Subject"
        >
          <option value="">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        <select
          className="select-pill"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by Status"
        >
          <option value="">Live / Upcoming</option>
          <option value="LIVE">Live Now</option>
          <option value="SCHEDULED">Upcoming Sessions</option>
        </select>

        <select
          className="select-pill"
          value={durationFilter}
          onChange={(e) => onDurationChange(e.target.value)}
          aria-label="Filter by Duration"
        >
          <option value="">Duration</option>
          <option value="short">Short (&lt; 30 min)</option>
          <option value="medium">Medium (30 - 60 min)</option>
          <option value="long">Long (&gt; 60 min)</option>
        </select>

        <button
          type="button"
          className="settings-pill-btn"
          onClick={() => showToast('Advanced filtering configuration opened.', 'info')}
          aria-label="Advanced Filters"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
