import React, { useState } from 'react';
import { Sparkles, Calendar, ArrowRight, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { joinStudyRoom } from '../../services/api';
import { showToast } from '../Toast';

export default function RecommendedRooms({ rooms = [], currentUser, onStateChanged }) {
  const navigate = useNavigate();
  const [loadingCardId, setLoadingCardId] = useState(null);

  // Filter live or scheduled rooms for recommendations
  const activeRooms = rooms.filter((r) => r.status === 'LIVE' || r.status === 'SCHEDULED');
  
  // Find rooms the current user has already joined/participated in
  const userJoinedRooms = rooms.filter(
    (r) => r.isCurrentUserParticipant && (r.status === 'LIVE' || r.status === 'SCHEDULED')
  );

  // Recommendations mapping from real data
  const realDsaRoom = activeRooms[0];
  const realGateRoom = activeRooms.length > 1 ? activeRooms[1] : null;
  const continueRoom = userJoinedRooms.length > 0 ? userJoinedRooms[0] : null;

  const handleJoinRecommended = async (roomId, isLive) => {
    if (!roomId) return;
    
    // If user is already a participant, just navigate them straight in
    const room = rooms.find(r => r._id === roomId);
    if (room?.isCurrentUserParticipant) {
      if (isLive) {
        navigate(`/study-rooms/${roomId}`);
      } else {
        showToast('Room is scheduled but not live yet.', 'info');
      }
      return;
    }

    setLoadingCardId(roomId);
    console.log(`JOIN REQUEST\nroomId: ${roomId}\nuserId: ${currentUser?._id}`);
    try {
      const res = await joinStudyRoom(roomId);
      console.log(`JOIN RESPONSE\nstatus: success\nresponse:`, res);
      if (res) {
        showToast('Joined study session successfully!', 'success');
        onStateChanged();
        if (isLive) {
          navigate(`/study-rooms/${roomId}`);
        }
      } else {
        showToast('Failed to join room', 'error');
      }
    } catch (err) {
      console.error(err);
      console.log(`JOIN RESPONSE\nstatus: error\nresponse:`, err.message);
      showToast(err.message || 'Error joining study room', 'error');
    } finally {
      setLoadingCardId(null);
    }
  };

  if (activeRooms.length === 0 && userJoinedRooms.length === 0) {
    return (
      <div className="dashboard-section" data-testid="recommended-section">
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--admin-text-muted)',
          fontSize: '0.9rem',
          marginBottom: '24px'
        }}>
          <Sparkles size={24} style={{ color: '#64b6ff', marginBottom: '8px', opacity: 0.6 }} />
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>No recommendations yet</div>
          <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.6 }}>Explore or create rooms to get personalized study picks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section" data-testid="recommended-section">
      <div className="recommended-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Card 1: Recommended For You (AI Pick) */}
        {realDsaRoom && (
          <div className="rec-card blue">
            <div className="rec-card-top">
              <span className="rec-header-left">
                <Sparkles size={14} style={{ color: '#64b6ff' }} />
                <span>Recommended For You</span>
              </span>
              <span className="rec-ai-badge">AI PICK</span>
            </div>

            <div className="rec-body-layout">
              <div className="rec-vector-art">
                <svg viewBox="0 0 50 50" width="48" height="48" aria-hidden="true">
                  <defs>
                    <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="25" cy="25" r="22" fill="url(#brainGlow)" />
                  <path d="M25,12 C18,12 14,16 14,23 C14,27 17,29 19,31 C20,32 21,34 21,36 L29,36 C29,34 30,32 31,31 C33,29 36,27 36,23 C36,16 32,12 25,12 Z" fill="none" stroke="#64b6ff" strokeWidth="2" />
                  <path d="M22,38 L28,38 M23,41 L27,41" stroke="#64b6ff" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="25" cy="22" r="4" fill="none" stroke="#4ef2c9" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="rec-card-info">
                <h3>{realDsaRoom.title}</h3>
                <p>{realDsaRoom.description || 'Live interactive study and focus room.'}</p>
                <div className="rec-meta-row">
                  <span>⏱ {realDsaRoom.status === 'LIVE' ? 'LIVE NOW' : 'SCHEDULED'}</span>
                  <span>👤 {realDsaRoom.participantsCount} studying</span>
                </div>
                <div className="rec-tags-row">
                  <span className="rec-tag-chip">{realDsaRoom.visibility}</span>
                  <span className="rec-tag-chip">Active</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-rec-join"
              onClick={() => handleJoinRecommended(realDsaRoom._id, realDsaRoom.status === 'LIVE')}
              disabled={loadingCardId === realDsaRoom._id}
            >
              {loadingCardId === realDsaRoom._id
                ? 'Joining...'
                : realDsaRoom.isCurrentUserParticipant
                ? 'Enter Room'
                : 'Join Room'}
            </button>
          </div>
        )}

        {/* Card 2: Best For You */}
        {realGateRoom && (
          <div className="rec-card green">
            <div className="rec-card-top">
              <span className="rec-header-left">
                <Sparkles size={14} style={{ color: '#22c55e' }} />
                <span>Best For You</span>
              </span>
            </div>

            <div className="rec-body-layout">
              <div className="rec-vector-art">
                <svg viewBox="0 0 50 50" width="48" height="48" aria-hidden="true">
                  <defs>
                    <radialGradient id="shieldGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="25" cy="25" r="22" fill="url(#shieldGlow)" />
                  <path d="M25,12 L37,16 L37,28 C37,35 29,40 25,42 C21,40 13,35 13,28 L13,16 L25,12 Z" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M20,24 L24,28 L30,19" fill="none" stroke="#4ef2c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="rec-card-info">
                <h3>{realGateRoom.title}</h3>
                <p>{realGateRoom.description || 'Holographic silent focus environment.'}</p>
                <div className="rec-meta-row">
                  <span>⏱ {realGateRoom.status === 'LIVE' ? 'LIVE NOW' : 'SCHEDULED'}</span>
                  <span>👤 {realGateRoom.participantsCount} studying</span>
                </div>
                <div className="rec-tags-row">
                  <span className="rec-tag-chip">{realGateRoom.visibility}</span>
                  <span className="rec-tag-chip">Dynamic</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-rec-join"
              onClick={() => handleJoinRecommended(realGateRoom._id, realGateRoom.status === 'LIVE')}
              disabled={loadingCardId === realGateRoom._id}
            >
              {loadingCardId === realGateRoom._id
                ? 'Joining...'
                : realGateRoom.isCurrentUserParticipant
                ? 'Enter Room'
                : 'Join Room'}
            </button>
          </div>
        )}

        {/* Card 3: Continue Where You Left */}
        {continueRoom && (
          <div className="rec-card purple">
            <div className="rec-card-top">
              <span className="rec-header-left">
                <Calendar size={14} style={{ color: '#a855f7' }} />
                <span>Continue Where You Left</span>
              </span>
            </div>

            <div className="rec-body-layout">
              <div className="rec-vector-art">
                <svg viewBox="0 0 50 50" width="48" height="48" aria-hidden="true">
                  <defs>
                    <radialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="25" cy="25" r="22" fill="url(#clockGlow)" />
                  <circle cx="25" cy="25" r="14" fill="none" stroke="#a855f7" strokeWidth="2" />
                  <path d="M25,17 L25,25 L31,28" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="rec-card-info">
                <h3>{continueRoom.title}</h3>
                <p>Active participant in this room.</p>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#a855f7', fontWeight: 600 }}>
                  Joined • {continueRoom.participantsCount} active slots occupied
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-rec-join"
              onClick={() => handleJoinRecommended(continueRoom._id, continueRoom.status === 'LIVE')}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
