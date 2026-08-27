import React, { useState, useEffect } from 'react';
import { getStudySessions, createStudyRoom } from '../../services/api';
import { showToast } from '../Toast';

export default function CreateRoomModal({ isOpen, onClose, onRoomCreated }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [workshopId, setWorkshopId] = useState('');

  // Client Validation Errors
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Load user workspaces
      setLoadingWorkspaces(true);
      getStudySessions()
        .then((res) => {
          if (Array.isArray(res)) {
            setWorkspaces(res);
          }
        })
        .catch((err) => {
          console.error('Failed to load workspaces:', err);
        })
        .finally(() => {
          setLoadingWorkspaces(false);
        });

      // Reset form on open
      setTitle('');
      setDescription('');
      setCapacity(10);
      setVisibility('PUBLIC');
      setIsScheduled(false);
      setScheduledStart('');
      setScheduledEnd('');
      setWorkshopId('');
      setErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateForm = () => {
    const tempErrors = {};
    if (!title.trim()) {
      tempErrors.title = 'Room title is required';
    } else if (title.length > 255) {
      tempErrors.title = 'Title cannot exceed 255 characters';
    }

    if (!capacity) {
      tempErrors.capacity = 'Capacity is required';
    } else {
      const capInt = parseInt(capacity, 10);
      if (isNaN(capInt) || capInt < 1 || capInt > 1000) {
        tempErrors.capacity = 'Capacity must be between 1 and 1000';
      }
    }

    if (isScheduled) {
      if (!scheduledStart) {
        tempErrors.scheduledStart = 'Scheduled start time is required';
      }
      if (!scheduledEnd) {
        tempErrors.scheduledEnd = 'Scheduled end time is required';
      }
      if (scheduledStart && scheduledEnd && new Date(scheduledStart) >= new Date(scheduledEnd)) {
        tempErrors.scheduledEnd = 'End time must be after start time';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        capacity: parseInt(capacity, 10),
        visibility,
        status: isScheduled ? 'SCHEDULED' : 'LIVE',
        workshopId: workshopId || undefined
      };

      if (isScheduled) {
        payload.scheduledStart = new Date(scheduledStart).toISOString();
        payload.scheduledEnd = new Date(scheduledEnd).toISOString();
      }

      const res = await createStudyRoom(payload);
      if (res) {
        showToast('Study Room created successfully', 'success');
        onRoomCreated(res);
        onClose();
      } else {
        showToast('Failed to create room', 'error');
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || 'Error occurred while creating room';
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errMsg = err.errors.map(e => `${e.field || e.path || 'Error'}: ${e.message || e.msg}`).join(', ');
      }
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Study Room</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Room Title *</label>
            <input
              type="text"
              id="title"
              className="form-control"
              placeholder="e.g. Algorithms & Data Structures Focus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <span className="form-error">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-control"
              placeholder="Write a brief overview of what you will study..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="capacity">Capacity *</label>
              <input
                type="number"
                id="capacity"
                className="form-control"
                min="1"
                max="1000"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              {errors.capacity && <span className="form-error">{errors.capacity}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="visibility">Privacy Settings</label>
              <select
                id="visibility"
                className="form-control"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="PUBLIC">Public (Visible in Hub)</option>
                <option value="PRIVATE">Private (Invite Link Only)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="workshopId">Topic/Workspace Relationship</label>
            <select
              id="workshopId"
              className="form-control"
              value={workshopId}
              onChange={(e) => setWorkshopId(e.target.value)}
              disabled={loadingWorkspaces}
            >
              <option value="">-- Optional: Link to a Workspace --</option>
              {workspaces.map((ws) => (
                <option key={ws._id} value={ws._id}>
                  {ws.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '24px 0' }}>
            <input
              type="checkbox"
              id="isScheduled"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="isScheduled" style={{ margin: 0, cursor: 'pointer' }}>
              Schedule for a future time
            </label>
          </div>

          {isScheduled && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="scheduledStart">Start Time *</label>
                <input
                  type="datetime-local"
                  id="scheduledStart"
                  className="form-control"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                />
                {errors.scheduledStart && <span className="form-error">{errors.scheduledStart}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="scheduledEnd">End Time *</label>
                <input
                  type="datetime-local"
                  id="scheduledEnd"
                  className="form-control"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                />
                {errors.scheduledEnd && <span className="form-error">{errors.scheduledEnd}</span>}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
