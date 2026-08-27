import React from 'react';

export default function DeleteRoomDialog({ room, isOpen, onClose, onConfirm }) {
  if (!isOpen || !room) return null;

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-panel">
        <div className="admin-modal-header">
          <h2>Delete Study Room</h2>
          <button type="button" className="btn-close-drawer" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="delete-dialog-body">
          <p>
            Are you sure you want to delete the study room <strong>"{room.title}"</strong>?
          </p>
          <p style={{ color: 'var(--admin-error)', marginTop: '8px', fontSize: '0.82rem' }}>
            ⚠ This action will permanently remove this room and all associated history logs and goal structures. This action cannot be undone.
          </p>
        </div>

        <div className="admin-form-actions">
          <button type="button" className="btn-admin-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-admin-primary"
            style={{ backgroundColor: 'var(--admin-error)' }}
            onClick={onConfirm}
          >
            Delete Room
          </button>
        </div>
      </div>
    </div>
  );
}
