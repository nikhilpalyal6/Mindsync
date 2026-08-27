import React from 'react';

export default function LeaveRoomDialog({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="workspace-modal-overlay">
      <div className="workspace-modal-panel">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 12px 0', color: '#fff' }}>
          Leave Study Room?
        </h2>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.88rem', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Are you sure you want to exit this study room? This will update your status as having left and remove you from the active participant registry.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn-admin-secondary" onClick={onClose}>
            Stay
          </button>
          <button
            type="button"
            className="btn-admin-primary"
            style={{ backgroundColor: 'var(--admin-error)' }}
            onClick={onConfirm}
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
