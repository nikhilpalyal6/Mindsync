import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export const BroadcastModal = React.memo(({ isOpen, onClose, onBroadcast }) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('broadcast');
  const [priority, setPriority] = useState('medium');
  const [target, setTarget] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onBroadcast({
        title: title.trim(),
        message: message.trim(),
        type,
        priority,
        target
      });
      // Clear inputs on success
      setTitle('');
      setMessage('');
      setType('broadcast');
      setPriority('medium');
      setTarget('all');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to dispatch announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div className="admin-card" style={{
        width: '100%',
        maxWidth: '520px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--admin-border)',
        borderRadius: '12px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--admin-primary)' }}>
            <Send size={18} />
            <h3 className="text-base font-bold text-white" style={{ margin: 0 }}>Broadcast Announcement</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--admin-text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid var(--admin-danger)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: '#fca5a5'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Target Audience */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="broadcast-target" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Target Scope</label>
            <select
              id="broadcast-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="admin-select"
            >
              <option value="all">All registered accounts</option>
              <option value="verified">Verified email users only</option>
              <option value="admins">Admin / Super Admins only</option>
              <option value="USER">USER role only</option>
            </select>
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="broadcast-title" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Announcement Title</label>
            <input
              id="broadcast-title"
              type="text"
              placeholder="e.g. Scheduled Maintenance Window"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="admin-select"
              style={{ padding: '8px 12px' }}
              required
            />
          </div>

          {/* Message */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="broadcast-message" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Message Body</label>
            <textarea
              id="broadcast-message"
              placeholder="Explain the update, window changes, or notes here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="admin-select"
              style={{ minHeight: '120px', padding: '8px 12px', resize: 'vertical' }}
              required
            ></textarea>
          </div>

          {/* Type & Priority splits */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="broadcast-type" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Alert Type</label>
              <select
                id="broadcast-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="admin-select"
              >
                <option value="broadcast">Broadcast / Update</option>
                <option value="maintenance">Maintenance</option>
                <option value="system">System / Alert</option>
              </select>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="broadcast-priority" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Priority Scale</label>
              <select
                id="broadcast-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="admin-select"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--admin-border)', paddingTop: '16px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="admin-btn admin-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn admin-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Send size={14} />
              <span>{submitting ? 'Dispatching...' : 'Dispatch Announcement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

BroadcastModal.displayName = 'BroadcastModal';
export default BroadcastModal;
