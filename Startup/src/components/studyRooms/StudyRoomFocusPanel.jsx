import React, { useState, useEffect } from 'react';
import { Play, Power, Compass } from 'lucide-react';
import {
  startFocusSession,
  endFocusSession,
  pauseFocusSession,
  resumeFocusSession
} from '../../services/api';
import { showToast } from '../Toast';

export default function StudyRoomFocusPanel({ roomId, focusSession, isHost, onRefresh }) {
  const [plannedDuration, setPlannedDuration] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds

  useEffect(() => {
    if (!focusSession || (focusSession.status !== 'ACTIVE' && focusSession.status !== 'PAUSED')) {
      setTimeLeft(0);
      return;
    }

    if (focusSession.status === 'PAUSED') {
      setTimeLeft(focusSession.remainingSeconds || 0);
      return;
    }

    const calculateTimeLeft = () => {
      if (!focusSession.endsAt) return 0;
      const diffSecs = Math.max(0, Math.ceil((new Date(focusSession.endsAt).getTime() - Date.now()) / 1000));
      return diffSecs;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onRefresh();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [focusSession, onRefresh]);

  const handleStartFocus = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await startFocusSession(roomId, { plannedDuration });
      if (res) {
        showToast('Focus session started!', 'success');
        onRefresh();
      } else {
        showToast('Failed to start session', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error starting focus session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePauseFocus = async () => {
    setSubmitting(true);
    try {
      const res = await pauseFocusSession(roomId);
      if (res) {
        showToast('Focus session paused.', 'success');
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error pausing focus session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeFocus = async () => {
    setSubmitting(true);
    try {
      const res = await resumeFocusSession(roomId);
      if (res) {
        showToast('Focus session resumed!', 'success');
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error resuming focus session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndFocus = async () => {
    if (!window.confirm('Are you sure you want to end this focus session early?')) return;
    setSubmitting(true);
    try {
      const res = await endFocusSession(roomId);
      if (res) {
        showToast('Focus session ended.', 'success');
        onRefresh();
      } else {
        showToast('Failed to end session', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error ending focus session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Time format helper (MM:SS)
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isSessionActive = focusSession && focusSession.status === 'ACTIVE';
  const isSessionPaused = focusSession && focusSession.status === 'PAUSED';
  const isTimerRunning = isSessionActive || isSessionPaused;

  return (
    <div className="workspace-focus-timer-card">
      <div className="timer-header">
         <Compass className="timer-compass-icon" size={16} />
        <span>FOCUS SESSION</span>
      </div>

      <div className="timer-display-area">
        {isTimerRunning ? (
          <div className={`timer-countdown ${isSessionActive ? 'active' : 'paused'}`}>
            {formatTime(timeLeft)}
          </div>
        ) : (
          <div className="timer-countdown inactive">25:00</div>
        )}

        <div className="timer-status-phrase">
          {isSessionActive ? 'DEEP FOCUS ACTIVE' : isSessionPaused ? 'FOCUS PAUSED' : 'TIMER INACTIVE'}
        </div>
      </div>

      {/* Host Controls Section */}
      {isHost ? (
        <div className="host-controls-wrapper">
          <span className="host-controls-header">HOST CONTROLS</span>
          
          {isTimerRunning ? (
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {isSessionPaused ? (
                <button
                  type="button"
                  className="btn-timer-action start"
                  onClick={handleResumeFocus}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  <Play size={14} fill="#fff" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-timer-action pause"
                  onClick={handlePauseFocus}
                  disabled={submitting}
                  style={{ flex: 1, backgroundColor: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>⏸</span>
                  <span>Pause</span>
                </button>
              )}
              <button
                type="button"
                className="btn-timer-action stop"
                onClick={handleEndFocus}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                <Power size={14} />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleStartFocus} className="start-focus-form">
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <select
                  value={plannedDuration}
                  onChange={(e) => setPlannedDuration(parseInt(e.target.value, 10))}
                  disabled={submitting}
                  className="duration-selector-input"
                  aria-label="Planned Duration"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={25}>25 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={90}>90 Minutes</option>
                </select>

                <button type="submit" className="btn-timer-action start" disabled={submitting}>
                  <Play size={14} fill="#fff" />
                  <span>Start Focus</span>
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="participant-timer-footer">
          {isSessionActive ? (
            <span>Focus together with the host. Stand strong!</span>
          ) : isSessionPaused ? (
            <span>Timer is paused by host. Take a deep breath!</span>
          ) : (
            <span>Waiting for the host to start a focus session...</span>
          )}
        </div>
      )}
    </div>
  );
}
