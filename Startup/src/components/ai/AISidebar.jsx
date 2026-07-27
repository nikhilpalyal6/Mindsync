import React from 'react';
import ChatLayout from '../chat/ChatLayout';

export const AISidebar = React.memo(({ session }) => {
  return (
    <div className="ai-sidebar-container" style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }}>
      <ChatLayout session={session} />
    </div>
  );
});

AISidebar.displayName = 'AISidebar';
export default AISidebar;
