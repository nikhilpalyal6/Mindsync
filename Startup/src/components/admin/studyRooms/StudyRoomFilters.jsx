import React from 'react';
import { Search } from 'lucide-react';

export default function StudyRoomFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  subjectFilter,
  onSubjectChange
}) {
  const subjects = ['DSA', 'Java', 'Python', 'DBMS', 'Operating Systems', 'GATE', 'Web Dev', 'Mathematics'];
  const statuses = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'];

  return (
    <div className="admin-filters-bar">
      <div className="admin-search-box">
        <Search size={16} className="admin-search-icon" />
        <input
          type="text"
          placeholder="Search by title, description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <select
        className="admin-select-filter"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filter by Status"
      >
        <option value="">All Statuses</option>
        {statuses.map((st) => (
          <option key={st} value={st}>
            {st}
          </option>
        ))}
      </select>

      <select
        className="admin-select-filter"
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
    </div>
  );
}
