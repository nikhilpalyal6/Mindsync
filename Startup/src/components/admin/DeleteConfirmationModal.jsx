import React, { useEffect } from 'react';

export const DeleteConfirmationModal = React.memo(({ 
  isOpen, 
  title = 'Are you sure?', 
  message = 'This action cannot be undone.', 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  isDanger = false 
}) => {
  
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="admin-modal">
        <h3 id="modal-title" className="admin-modal-title">{title}</h3>
        <p className="admin-modal-message">{message}</p>
        
        <div className="admin-modal-actions">
          <button 
            onClick={onCancel} 
            className="admin-btn admin-btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className="admin-btn admin-btn-primary"
            style={{ 
              padding: '8px 16px', 
              fontSize: '0.875rem',
              backgroundColor: isDanger ? 'var(--admin-error)' : 'var(--admin-primary)'
            }}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteConfirmationModal.displayName = 'DeleteConfirmationModal';
export default DeleteConfirmationModal;
