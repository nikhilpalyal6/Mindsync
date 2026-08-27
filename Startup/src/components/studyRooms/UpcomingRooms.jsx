import React, { useState, useEffect } from 'react';
import { Calendar, Bell, BellOff } from 'lucide-react';
import { showToast } from '../Toast';

export default function UpcomingRooms({ rooms = [], onViewAllClick }) {
  const [reminders, setReminders] = useState([]);

  const upcomingRooms = rooms.filter((r) => r.status === 'SCHEDULED');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mindsync-room-reminders');
      if (stored) setReminders(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleReminder = (roomId) => {
    let updated;
    let isAdded = false;
    if (reminders.includes(roomId)) {
      updated = reminders.filter((id) => id !== roomId);
    } else {
      updated = [...reminders, roomId];
      isAdded = true;
    }
    setReminders(updated);
    try {
      localStorage.setItem('mindsync-room-reminders', JSON.stringify(updated));
      showToast(
        isAdded ? 'Reminder set for study room!' : 'Reminder removed.',
        isAdded ? 'success' : 'info'
      );
    } catch (e) {
      console.error(e);
    }
  };

  const formatScheduledTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="column-section">
      <div className="column-header">
        <h2>Upcoming Rooms</h2>
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
        {upcomingRooms.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px', margin: 0 }}>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              No upcoming rooms
            </p>
          </div>
        ) : (
          upcomingRooms.slice(0, 4).map((room) => {
            const hasReminder = reminders.includes(room._id);
            return (
              <div key={room._id} className="upcoming-row-card">
                <div className="upcoming-row-left">
                  <div className="upcoming-row-icon">
                    <Calendar size={16} />
                  </div>
                  <div className="upcoming-row-info">
                    <h3>{room.title}</h3>
                    <div className="upcoming-row-schedule">
                      {room.scheduledStart ? formatScheduledTime(room.scheduledStart) : 'Flexible Time'}
                    </div>
                    <div className="upcoming-row-tags">
                      <span className="upcoming-row-seats-count">{room.capacity} seats</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-upcoming-reminder"
                  onClick={() => toggleReminder(room._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {hasReminder ? <BellOff size={12} /> : <Bell size={12} />}
                  <span>{hasReminder ? 'Reminder Set' : 'Set Reminder'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
