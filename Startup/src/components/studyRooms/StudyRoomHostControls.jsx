import React, { useState } from 'react';
import { Shield, Lock, Unlock, MicOff, Volume2, Power } from 'lucide-react';
import { lockStudyRoom, unlockStudyRoom, endStudyRoom } from '../../services/api';
import { showToast } from '../Toast';

export default function StudyRoomHostControls({
  roomId,
  room,
  onRefresh,
  sendSocketMessage
}) {
  const [allowUnmute, setAllowUnmute] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!room) return null;

  const isLocked = room.isLocked;

  const handleToggleLock = async () => {
    setSubmitting(true);
    try {
      if (isLocked) {
        await unlockStudyRoom(roomId);
        showToast('Room unlocked successfully', 'success');
      } else {
        await lockStudyRoom(roomId);
        showToast('Room locked successfully', 'success');
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error toggling lock state', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMuteAll = () => {
    sendSocketMessage('MUTE_ALL', { allowParticipantUnmute: allowUnmute });
    showToast(`Muted all participants. Allow unmute: ${allowUnmute ? 'Yes' : 'No'}`, 'success');
  };

  const handleAllowUnmute = () => {
    sendSocketMessage('ALLOW_UNMUTE', {});
    showToast('Unmute restriction lifted for all participants', 'success');
  };

  const handleEndRoom = async () => {
    if (!window.confirm('Are you sure you want to end this study session for everyone?')) return;
    setSubmitting(true);
    try {
      await endStudyRoom(roomId);
      showToast('Study session ended.', 'success');
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error ending study room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="workspace-info-card" style={{
      background: '#0f172a',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
        <Shield size={16} />
        <span style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em' }}>HOST MODERATION</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Lock/Unlock Toggle */}
        <button
          type="button"
          onClick={handleToggleLock}
          disabled={submitting}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: isLocked ? '#9a3412' : '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{isLocked ? 'Unlock Room' : 'Lock Room'}</span>
        </button>

        {/* Mute All Controls */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '6px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: '#9ca3af', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowUnmute}
              onChange={(e) => setAllowUnmute(e.target.checked)}
            />
            <span>Allow participants to unmute</span>
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleMuteAll}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <MicOff size={12} />
              <span>Mute All</span>
            </button>

            <button
              type="button"
              onClick={handleAllowUnmute}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Volume2 size={12} />
              <span>Allow Unmute</span>
            </button>
          </div>
        </div>

        {/* End Room Button */}
        <button
          type="button"
          onClick={handleEndRoom}
          disabled={submitting}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'none',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Power size={14} />
          <span>End Study Session</span>
        </button>
      </div>
    </div>
  );
}
export { StudyRoomHostControls };
