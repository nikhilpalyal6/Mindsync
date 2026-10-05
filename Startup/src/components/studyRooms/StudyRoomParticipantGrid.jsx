import React from 'react';
import StudyRoomParticipantCard from './StudyRoomParticipantCard';

/**
 * Responsive Participant grid displaying live WebRTC video channels.
 * Note: P2P Mesh architecture is computationally heavy. Active video channels are capped at 6.
 * Additional members are rendered as spectator status cards (initials/avatars only).
 */
export default function StudyRoomParticipantGrid({
  participants = [],
  capacity = 8,
  currentUserId,
  localStream = null,
  remoteStreams = {},
  localCameraActive = false,
  localMicActive = false,
  roomHostId,
  currentUserIsHostOrAdmin,
  onMuteParticipant
}) {
  const slots = [];
  
  // Add actual participants
  participants.forEach((p) => {
    const isUserAdmin = p.user?.role === 'ADMIN' || p.user?.role === 'SUPER_ADMIN' || p.role === 'ADMIN' || p.role === 'SUPER_ADMIN';
    if (isUserAdmin) return;

    slots.push({
      id: p.participantId || p._id,
      isEmpty: false,
      participant: p,
      isCurrentUser: currentUserId && (String(p.user?._id || p.user || p.participantId) === String(currentUserId))
    });
  });
  
  const displaySlotsCount = Math.max(slots.length, Math.min(capacity, 8));

  // Add empty seats to fill up displaySlotsCount
  const emptySeatsNeeded = displaySlotsCount - slots.length;
  for (let i = 0; i < emptySeatsNeeded; i++) {
    slots.push({
      id: `empty-${i}`,
      isEmpty: true
    });
  }

  const isAlone = slots.length <= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Grid container with responsive layouts */}
      <div className="workspace-participant-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        width: '100%'
      }}>
        {slots.map((slot) => {
          let stream = null;
          let cameraOn = false;
          let micOn = false;

          if (!slot.isEmpty) {
            const uId = String(slot.participant.user?._id || slot.participant.user || slot.participant.participantId || '');
            if (slot.isCurrentUser) {
              stream = localStream;
              cameraOn = localCameraActive;
              micOn = localMicActive;
            } else {
              stream = remoteStreams[uId];
              cameraOn = slot.participant.cameraState === 'CAMERA_ON';
              micOn = slot.participant.micState === 'MIC_ON';
            }
          }

          return (
            <StudyRoomParticipantCard
              key={slot.id}
              isEmptySeat={slot.isEmpty}
              participant={slot.participant}
              isCurrentUser={slot.isCurrentUser}
              stream={stream}
              cameraOn={cameraOn}
              micOn={micOn}
              roomHostId={roomHostId}
              currentUserIsHostOrAdmin={currentUserIsHostOrAdmin}
              onMuteParticipant={onMuteParticipant}
            />
          );
        })}
      </div>

      {isAlone && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#60a5fa',
          fontSize: '0.82rem',
          textAlign: 'center'
        }}>
          You're the only one here. Invite others or wait for participants to join.
        </div>
      )}
    </div>
  );
}
export { StudyRoomParticipantGrid };
