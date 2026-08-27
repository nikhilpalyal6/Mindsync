import React from 'react';
import { User, VideoOff, MicOff, Mic } from 'lucide-react';

export default function StudyRoomParticipantCard({
  participant,
  isEmptySeat,
  isCurrentUser,
  stream,
  cameraOn,
  micOn,
  roomHostId,
  currentUserIsHostOrAdmin,
  onMuteParticipant
}) {
  if (isEmptySeat) {
    return (
      <div className="participant-workspace-card empty" style={{
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px dashed rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: '16/10',
        minHeight: '160px'
      }}>
        <div className="empty-seat-placeholder" style={{ textAlign: 'center', opacity: 0.3 }}>
          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>＋</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Empty Seat</span>
        </div>
      </div>
    );
  }

  const name = participant.user?.name || participant.user?.username || participant.name || 'Unknown User';
  const avatar = participant.user?.profileImage || participant.user?.avatar || participant.avatar;
  
  // Authoritative host check
  const hostId = roomHostId && (typeof roomHostId === 'object' ? roomHostId._id : roomHostId);
  const isHost = roomHostId && String(participant.user?._id || participant.user || participant.participantId) === String(hostId);

  const initials = name.charAt(0).toUpperCase();

  return (
    <div className={`participant-workspace-card ${isCurrentUser ? 'self' : ''}`} style={{
      background: '#0d1326',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      aspectRatio: '16/10',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '160px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Video Container */}
      <div className="camera-feed-placeholder" style={{
        flex: 1,
        background: '#070b16',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {cameraOn && stream ? (
          <video
            ref={(el) => {
              if (el && stream && el.srcObject !== stream) {
                el.srcObject = stream;
              }
            }}
            autoPlay
            playsInline
            muted={isCurrentUser}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1
            }}
          />
        ) : null}

        {/* Video Off Overlay or Avatar Fallback */}
        {(!cameraOn || !stream) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            background: '#080d1a'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              backgroundImage: avatar ? `url(${avatar})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}>
              {!avatar && initials}
            </div>
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              padding: '4px',
              display: 'flex'
            }}>
              <VideoOff size={12} style={{ color: '#ef4444' }} />
            </div>
          </div>
        )}

        {/* Speaking visual activity rings if practical */}
        {micOn && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderRadius: '50%',
            padding: '4px',
            zIndex: 3,
            display: 'flex'
          }}>
            <Mic size={12} style={{ color: '#22c55e' }} />
          </div>
        )}

        {!micOn && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '50%',
            padding: '4px',
            zIndex: 3,
            display: 'flex'
          }}>
            <MicOff size={12} style={{ color: '#ef4444' }} />
          </div>
        )}
      </div>

      {/* Footer details */}
      <div className="participant-card-footer" style={{
        height: '42px',
        background: '#0d1326',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        zIndex: 4
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
          {name} {isCurrentUser && '(You)'}
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {isHost ? (
            <span className="p-role-badge host" style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '3px',
              textTransform: 'uppercase'
            }}>
              Host
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="p-role-badge student" style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#9ca3af',
                fontSize: '0.62rem',
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: '3px',
                textTransform: 'uppercase'
              }}>
                Student
              </span>
              {currentUserIsHostOrAdmin && onMuteParticipant && (
                <button
                  type="button"
                  onClick={() => onMuteParticipant(participant.user?._id || participant.user || participant.participantId, micOn)}
                  style={{
                    background: micOn ? '#ef4444' : '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {micOn ? 'Mute' : 'Unmute'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
