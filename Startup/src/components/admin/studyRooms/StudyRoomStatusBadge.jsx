import React from 'react';

export default function StudyRoomStatusBadge({ status }) {
  const label = status || 'DRAFT';
  const lowercase = label.toLowerCase();
  
  return (
    <span className={`admin-badge ${lowercase}`}>
      {label}
    </span>
  );
}
