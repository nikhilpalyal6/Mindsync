import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function StudyRoomError({ errorText }) {
  return (
    <div className="workspace-error-container">
      <div className="workspace-error-card">
        <div className="error-icon-wrapper">
          <AlertTriangle size={32} />
        </div>
        
        <h2>Room Unavailable</h2>
        <p className="error-desc-text">
          {errorText || 'We encountered an error loading this study room session. The room may have ended, cancelled, or you might not have authorization.'}
        </p>

        <Link to="/study-rooms" className="btn-error-back-hub">
          <ArrowLeft size={16} />
          <span>Back to Study Rooms</span>
        </Link>
      </div>
    </div>
  );
}
