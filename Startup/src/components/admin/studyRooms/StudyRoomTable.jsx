import React from 'react';
import StudyRoomStatusBadge from './StudyRoomStatusBadge';
import { Lock, Unlock, Play, Power, CalendarOff, Edit3, Trash2, Eye } from 'lucide-react';

export default function StudyRoomTable({
  rooms,
  onViewDetails,
  onEdit,
  onDelete,
  onStart,
  onEnd,
  onCancel,
  onLock,
  onUnlock
}) {
  const formatScheduledTime = (dateStr) => {
    if (!dateStr) return 'Flexible';
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (room) => {
    if (room.actualStart && room.actualEnd) {
      const diff = Math.round((new Date(room.actualEnd) - new Date(room.actualStart)) / 60000);
      return `${diff} min`;
    }
    if (room.scheduledStart && room.scheduledEnd) {
      const diff = Math.round((new Date(room.scheduledEnd) - new Date(room.scheduledStart)) / 60000);
      return `${diff} min (sched)`;
    }
    return '—';
  };

  return (
    <div className="admin-table-container">
      <table className="admin-rooms-table" data-testid="admin-rooms-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Room</th>
            <th>Host</th>
            <th>Topic</th>
            <th>Schedule</th>
            <th>Duration</th>
            <th>Participants</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--admin-text-muted)' }}>
                No study rooms found. Create a room to get started!
              </td>
            </tr>
          ) : (
            rooms.map((room) => {
              const hostName = room.host?.name || room.host?.username || 'Unknown';
              const topicName = room.workshopId?.title || 'General Focus';
              const isLocked = room.isLocked;

              return (
                <tr key={room._id}>
                  <td>
                    <StudyRoomStatusBadge status={room.status} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{room.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }} title={room.description}>
                      {room.description ? room.description.substring(0, 40) + (room.description.length > 40 ? '...' : '') : 'No description'}
                    </div>
                  </td>
                  <td>{hostName}</td>
                  <td>{topicName}</td>
                  <td>{formatScheduledTime(room.scheduledStart)}</td>
                  <td>{calculateDuration(room)}</td>
                  <td>
                    {room.participantsCount || 0} / {room.capacity}
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      {/* VIEW button - available for all rooms */}
                      <button
                        type="button"
                        className="btn-admin-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => onViewDetails(room)}
                        title="View Details"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>

                      {/* START button - for DRAFT or SCHEDULED */}
                      {['DRAFT', 'SCHEDULED'].includes(room.status) && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--admin-success)', color: 'var(--admin-success)' }}
                          onClick={() => {
                            if (window.confirm(`Start study room "${room.title}" now?`)) {
                              onStart(room._id);
                            }
                          }}
                          title="Start Room"
                        >
                          <Play size={12} fill="var(--admin-success)" />
                          <span>Start</span>
                        </button>
                      )}

                      {/* EDIT button - for DRAFT, SCHEDULED, LIVE */}
                      {['DRAFT', 'SCHEDULED', 'LIVE'].includes(room.status) && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => onEdit(room)}
                          title="Edit Room"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                      )}

                      {/* LOCK / UNLOCK button - for LIVE */}
                      {room.status === 'LIVE' && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            if (isLocked) {
                              if (window.confirm(`Unlock study room "${room.title}"?`)) onUnlock(room._id);
                            } else {
                              if (window.confirm(`Lock study room "${room.title}"?`)) onLock(room._id);
                            }
                          }}
                          title={isLocked ? 'Unlock Room' : 'Lock Room'}
                        >
                          {isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                          <span>{isLocked ? 'Unlock' : 'Lock'}</span>
                        </button>
                      )}

                      {/* END button - for LIVE */}
                      {room.status === 'LIVE' && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--admin-error)', color: 'var(--admin-error)' }}
                          onClick={() => {
                            if (window.confirm(`End study room "${room.title}"? This will disconnect participants.`)) {
                              onEnd(room._id);
                            }
                          }}
                          title="End Room"
                        >
                          <Power size={12} />
                          <span>End</span>
                        </button>
                      )}

                      {/* CANCEL button - for SCHEDULED */}
                      {room.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--admin-warning)', color: 'var(--admin-warning)' }}
                          onClick={() => {
                            if (window.confirm(`Cancel scheduled study room "${room.title}"?`)) {
                              onCancel(room._id);
                            }
                          }}
                          title="Cancel Room"
                        >
                          <CalendarOff size={12} />
                          <span>Cancel</span>
                        </button>
                      )}

                      {/* DELETE button - for DRAFT or CANCELLED */}
                      {['DRAFT', 'CANCELLED'].includes(room.status) && (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--admin-error)', color: 'var(--admin-error)' }}
                          onClick={() => onDelete(room)}
                          title="Delete Room"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
