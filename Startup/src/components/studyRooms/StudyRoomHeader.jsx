import React from 'react';
import { ArrowLeft, LogOut, Users, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudyRoomHeader({
  room,
  onLeave,
  isHost,
  cameraActive,
  onToggleCamera,
  micActive,
  onToggleMic,
  activeCount,
  showMicControl = false
}) {
  if (!room) return null;

  const displayActiveCount = activeCount !== undefined ? activeCount : (room.participantsCount || 0);
  const maxCapacity = room.capacity || 10;
  const subjectName = room.workshopId?.title || 'General Focus';
  const isLive = room.status === 'LIVE';

  return (
    <header className="study-room-workspace-header" style={{
      height: '64px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      backgroundColor: '#0a0f1d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      boxSizing: 'border-box'
    }}>
      <div className="workspace-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/study-rooms" className="btn-back-hub" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: '#9ca3af',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600,
          padding: '6px 12px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
          transition: 'all 0.2s ease',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <ArrowLeft size={16} />
          <span>Back to Hub</span>
        </Link>
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#fff' }}>{room.title}</h1>
            {isHost && (
              <span className="host-pill-badge" style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                Host
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1px' }}>{subjectName}</span>
        </div>
      </div>

      <div className="workspace-header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`status-led ${room.status.toLowerCase()}`} style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isLive ? '#22c55e' : '#eab308',
            display: 'inline-block',
            position: 'relative'
          }}>
            {isLive && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                animation: 'ping 1.5s infinite',
                opacity: 0.7
              }} />
            )}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>
            {room.status}
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

        {/* Seats counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.8rem' }}>
          <Users size={14} />
          <span>
            {displayActiveCount} / {maxCapacity} Studying
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

        {/* Media Controls */}
        {isLive && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Camera Toggle */}
            <button
              type="button"
              onClick={onToggleCamera}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: cameraActive ? '#22c55e' : '#1e293b',
                color: '#fff',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {cameraActive ? <Video size={14} /> : <VideoOff size={14} />}
              <span>{cameraActive ? 'Camera On' : 'Camera Off'}</span>
            </button>

            {/* Mic Toggle */}
            {showMicControl && (
              <button
                type="button"
                onClick={onToggleMic}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: micActive ? '#22c55e' : '#1e293b',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {micActive ? <Mic size={14} /> : <MicOff size={14} />}
                <span>{micActive ? 'Mic On' : 'Mic Off'}</span>
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onLeave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ef4444',
            color: '#fff',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <LogOut size={14} />
          <span>Leave Room</span>
        </button>
      </div>
    </header>
  );
}
