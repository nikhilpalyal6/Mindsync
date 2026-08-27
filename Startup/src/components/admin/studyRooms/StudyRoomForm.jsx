import React, { useState, useEffect } from 'react';
import { getStudySessions, createStudyRoom, patchStudyRoom } from '../../../services/api';
import { showToast } from '../../Toast';

export default function StudyRoomForm({ room = null, isOpen, onClose, onSaved }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [workshopId, setWorkshopId] = useState('');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    // Load available workspaces
    setLoadingWorkspaces(true);
    getStudySessions()
      .then((res) => {
        if (Array.isArray(res)) {
          setWorkspaces(res);
        }
      })
      .catch((e) => console.error('Failed to load sessions', e))
      .finally(() => setLoadingWorkspaces(false));

    // Populate form fields
    if (room) {
      setTitle(room.title || '');
      setDescription(room.description || '');
      setCapacity(room.capacity || 10);
      setVisibility(room.visibility || 'PUBLIC');
      if (room.scheduledStart) {
        setIsScheduled(true);
        // Format ISO string to datetime-local input string (YYYY-MM-DDTHH:MM)
        const startISO = new Date(room.scheduledStart).toISOString().slice(0, 16);
        setScheduledStart(startISO);
        if (room.scheduledEnd) {
          const endISO = new Date(room.scheduledEnd).toISOString().slice(0, 16);
          setScheduledEnd(endISO);
        } else {
          setScheduledEnd('');
        }
      } else {
        setIsScheduled(false);
        setScheduledStart('');
        setScheduledEnd('');
      }
      setWorkshopId(room.workshopId?._id || room.workshopId || '');
    } else {
      // Clear for Create Mode
      setTitle('');
      setDescription('');
      setCapacity(10);
      setVisibility('PUBLIC');
      setIsScheduled(false);
      setScheduledStart('');
      setScheduledEnd('');
      setWorkshopId('');
    }
    setErrors({});
  }, [isOpen, room]);

  if (!isOpen) return null;

  const validateForm = () => {
    const tempErrors = {};
    if (!title.trim()) {
      tempErrors.title = 'Room title is required';
    } else if (title.length > 255) {
      tempErrors.title = 'Title cannot exceed 255 characters';
    }

    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1 || cap > 1000) {
      tempErrors.capacity = 'Capacity must be between 1 and 1000';
    }

    if (isScheduled) {
      if (!scheduledStart) {
        tempErrors.scheduledStart = 'Start date and time is required';
      }
      if (!scheduledEnd) {
        tempErrors.scheduledEnd = 'End date and time is required';
      }
      if (scheduledStart && scheduledEnd && new Date(scheduledStart) >= new Date(scheduledEnd)) {
        tempErrors.scheduledEnd = 'End date must be after start date';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const payload = {
      title,
      description,
      capacity: parseInt(capacity, 10),
      visibility,
      scheduledStart: isScheduled ? new Date(scheduledStart).toISOString() : null,
      scheduledEnd: isScheduled ? new Date(scheduledEnd).toISOString() : null,
      workshopId: workshopId || null
    };

    try {
      let res;
      if (room) {
        res = await patchStudyRoom(room._id, payload);
      } else {
        res = await createStudyRoom(payload);
      }

      if (res) {
        showToast(
          room ? 'Study room updated successfully!' : 'Study room created successfully!',
          'success'
        );
        onSaved();
        onClose();
      } else {
        showToast('Failed to save room details', 'error');
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || 'Error saving study room config';
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errMsg = err.errors.map(e => `${e.field || e.path || 'Error'}: ${e.message || e.msg}`).join(', ');
      }
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = room && ['ENDED', 'CANCELLED'].includes(room.status);

  return (
    <div className="admin-modal-overlay">
      <form onSubmit={handleSubmit} className="admin-modal-panel">
        <div className="admin-modal-header">
          <h2>{room ? 'Edit Study Room' : 'Create Study Room'}</h2>
          <button type="button" className="btn-close-drawer" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="admin-form-group">
            <label htmlFor="room-title">Room Title</label>
            <input
              type="text"
              id="room-title"
              className="admin-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadOnly || submitting}
              required
            />
            {errors.title && <span style={{ color: 'var(--admin-error)', fontSize: '0.75rem' }}>{errors.title}</span>}
          </div>

          <div className="admin-form-group">
            <label htmlFor="room-desc">Description</label>
            <textarea
              id="room-desc"
              rows={3}
              className="admin-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isReadOnly || submitting}
            />
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="room-capacity">Max Capacity</label>
              <input
                type="number"
                id="room-capacity"
                className="admin-form-input"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                disabled={isReadOnly || submitting}
                required
              />
              {errors.capacity && <span style={{ color: 'var(--admin-error)', fontSize: '0.75rem' }}>{errors.capacity}</span>}
            </div>

            <div className="admin-form-group">
              <label htmlFor="room-visibility">Visibility</label>
              <select
                id="room-visibility"
                className="admin-form-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                disabled={isReadOnly || submitting}
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="room-workshop">Related Workshop Topic</label>
            <select
              id="room-workshop"
              className="admin-form-select"
              value={workshopId}
              onChange={(e) => setWorkshopId(e.target.value)}
              disabled={isReadOnly || loadingWorkspaces || submitting}
            >
              <option value="">None (General Study)</option>
              {workspaces.map((ws) => (
                <option key={ws._id} value={ws._id}>
                  {ws.title}
                </option>
              ))}
            </select>
            {loadingWorkspaces && <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Loading topics...</span>}
          </div>

          <div className="admin-form-group" style={{ flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="room-isScheduled"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              disabled={isReadOnly || submitting}
            />
            <label htmlFor="room-isScheduled" style={{ textTransform: 'none', cursor: 'pointer' }}>
              Schedule this room for a later date
            </label>
          </div>

          {isScheduled && (
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="room-start">Start Date & Time</label>
                <input
                  type="datetime-local"
                  id="room-start"
                  className="admin-form-input"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  disabled={isReadOnly || submitting}
                  required
                />
                {errors.scheduledStart && <span style={{ color: 'var(--admin-error)', fontSize: '0.75rem' }}>{errors.scheduledStart}</span>}
              </div>

              <div className="admin-form-group">
                <label htmlFor="room-end">End Date & Time</label>
                <input
                  type="datetime-local"
                  id="room-end"
                  className="admin-form-input"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  disabled={isReadOnly || submitting}
                  required
                />
                {errors.scheduledEnd && <span style={{ color: 'var(--admin-error)', fontSize: '0.75rem' }}>{errors.scheduledEnd}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="admin-form-actions">
          <button type="button" className="btn-admin-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          {!isReadOnly && (
            <button type="submit" className="btn-admin-primary" disabled={submitting}>
              {submitting ? 'Saving...' : room ? 'Update Room' : 'Create Room'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
