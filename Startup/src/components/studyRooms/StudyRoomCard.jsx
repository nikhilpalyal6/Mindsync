import React, { useState } from 'react';
import { Users, Clock, Lock, Unlock, Bell, BellOff, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { joinStudyRoom, leaveStudyRoom } from '../../services/api';
import { showToast } from '../Toast';

export default function StudyRoomCard({ room, currentUser, onStateChanged, reminderState = null }) {
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState(false);

  const {
    _id,
    title,
    description,
    host,
    status,
    scheduledStart,
    capacity,
    isLocked,
    workshopId,
    participantsCount = 0,
    isCurrentUserParticipant = false
  } = room;

  const isHost = currentUser && host && (host._id || host) === currentUser._id;

  const handleJoin = async () => {
    setLoadingAction(true);
    console.log(`JOIN REQUEST\nroomId: ${_id}\nuserId: ${currentUser?._id}`);
    try {
      const res = await joinStudyRoom(_id);
      console.log(`JOIN RESPONSE\nstatus: success\nresponse:`, res);
      if (res) {
        showToast('Joined study room successfully!', 'success');
        onStateChanged();
        if (status === 'LIVE') {
          navigate(`/study-rooms/${_id}`);
        }
      } else {
        showToast('Failed to join room', 'error');
      }
    } catch (err) {
      console.error(err);
      console.log(`JOIN RESPONSE\nstatus: error\nresponse:`, err.message);
      showToast(err.message || 'Error joining study room', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLeave = async () => {
    setLoadingAction(true);
    try {
      const res = await leaveStudyRoom(_id);
      if (res) {
        showToast('Left study room successfully.', 'success');
        onStateChanged();
      } else {
        showToast('Failed to leave room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error leaving study room', 'error');
    } finally {
      setLoadingAction(false);
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

  const getStatusClass = () => {
    if (isCurrentUserParticipant) return 'joined';
    return status.toLowerCase();
  };

  const getStatusText = () => {
    if (isCurrentUserParticipant) return 'JOINED';
    return status;
  };

  // Render proper CTA button based on state
  const renderAction = () => {
    if (status === 'ENDED') {
      return (
        <button type="button" className="btn-secondary" disabled>
          Session Ended
        </button>
      );
    }

    if (status === 'CANCELLED') {
      return (
        <button type="button" className="btn-secondary" disabled>
          Cancelled
        </button>
      );
    }

    if (isCurrentUserParticipant) {
      return (
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          {status === 'LIVE' && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                console.log(`[JOIN FLOW] Entering room: ${_id}`);
                navigate(`/study-rooms/${_id}`);
              }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>Enter Room</span>
              <ArrowRight size={16} />
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLeave}
            disabled={loadingAction}
            style={{
              borderColor: 'rgba(255, 99, 99, 0.4)',
              color: '#ff6363',
              width: status === 'LIVE' ? 'auto' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px'
            }}
          >
            {loadingAction ? 'Leaving...' : 'Leave'}
          </button>
        </div>
      );
    }

    if (status === 'SCHEDULED' && reminderState) {
      const { isSet, onToggle } = reminderState;
      return (
        <button
          type="button"
          className="btn-secondary"
          onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {isSet ? (
            <>
              <BellOff size={16} />
              <span>Reminder Set</span>
            </>
          ) : (
            <>
              <Bell size={16} />
              <span>Set Reminder</span>
            </>
          )}
        </button>
      );
    }

    if (isLocked && !isHost) {
      return (
        <button type="button" className="btn-secondary" disabled style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Lock size={16} />
          <span>Locked</span>
        </button>
      );
    }

    if (participantsCount >= capacity) {
      return (
        <button type="button" className="btn-secondary" disabled>
          Full
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn-primary"
        onClick={handleJoin}
        disabled={loadingAction}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <span>{loadingAction ? 'Joining...' : 'Join Room'}</span>
        <ArrowRight size={16} />
      </button>
    );
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const hostName = host?.name || host?.username || 'Unknown Host';
  const hostAvatar = host?.profileImage || host?.avatar;

  return (
    <div className={`room-card-v2 ${status === 'LIVE' ? 'live-card' : ''}`} data-testid="study-room-card">
      <div className="card-top">
        {workshopId?.title ? (
          <span className="card-topic-tag" title={workshopId.title}>
            {workshopId.title}
          </span>
        ) : (
          <span className="card-topic-tag">General Study</span>
        )}
        
        <div className={`card-badge ${getStatusClass()}`}>
          {getStatusText()}
        </div>
      </div>

      <h3 className="card-title">{title}</h3>
      <p className="card-desc">{description || 'No description provided for this focus session.'}</p>

      <div className="room-host" style={{ marginBottom: '20px' }}>
        <div className="host-avatar">
          {hostAvatar ? (
            <img src={hostAvatar} alt={hostName} />
          ) : (
            getInitials(hostName)
          )}
        </div>
        <span>Hosted by {hostName}</span>
      </div>

      <div className="card-metadata">
        <div className="metadata-item">
          <Users size={16} />
          <span>
            {participantsCount} / {capacity} studying
          </span>
        </div>
        <div className="metadata-item">
          <Clock size={16} />
          <span>
            {status === 'LIVE'
              ? 'Active'
              : scheduledStart
              ? formatScheduledTime(scheduledStart)
              : 'Flexible'}
          </span>
        </div>
        {isLocked && (
          <div className="metadata-item">
            <Lock size={14} />
            <span>Locked</span>
          </div>
        )}
      </div>

      <div className="card-actions">
        {renderAction()}
      </div>
    </div>
  );
}
