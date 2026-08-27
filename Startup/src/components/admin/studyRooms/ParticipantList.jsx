import React from 'react';

export default function ParticipantList({ participants, onMuteParticipant, isLive }) {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!participants || participants.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
        No participants have joined this study room yet.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="admin-scrollbar">
      <table className="drawer-participants-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            {isLive ? (
              <>
                <th>Mic State</th>
                <th>Action</th>
              </>
            ) : (
              <>
                <th>Joined</th>
                <th>Left</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const userName = p.user?.name || p.user?.username || 'Unknown User';
            const userAvatar = p.user?.profileImage || p.user?.avatar;
            const initials = getInitials(userName);
            const userId = p.user?._id || p.user;

            return (
              <tr key={p._id || userId}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="participant-avatar-circle" style={{ backgroundImage: userAvatar ? `url(${userAvatar})` : 'none', backgroundSize: 'cover' }}>
                      {!userAvatar && initials}
                    </div>
                    <span style={{ fontWeight: 600 }}>{userName}</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.role === 'HOST' ? 'var(--admin-primary)' : 'var(--admin-text-muted)' }}>
                    {p.role}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: p.status === 'active' || p.status === 'joined' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                    {p.status}
                  </span>
                </td>
                {isLive ? (
                  <>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: p.micState === 'MIC_ON' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                        {p.micState === 'MIC_ON' ? '🎙 ON' : '🔇 OFF'}
                      </span>
                    </td>
                    <td>
                      {p.role !== 'HOST' && p.status === 'active' && onMuteParticipant && (
                        <button
                          type="button"
                          onClick={() => onMuteParticipant(userId, p.micState)}
                          style={{
                            background: p.micState === 'MIC_ON' ? '#ef4444' : '#22c55e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {p.micState === 'MIC_ON' ? 'Mute' : 'Unmute'}
                        </button>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{formatTime(p.joinedAt)}</td>
                    <td>{formatTime(p.leftAt)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
