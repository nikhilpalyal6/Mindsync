import React from 'react';
import ChatLayout from '../chat/ChatLayout';

export const AIChatSidebar = React.memo(({ session, collapsed, activeResource }) => {
  return (
    <aside className={`sw-right ${collapsed ? 'collapsed' : ''}`}>
      <div className="persistent-chat-wrapper">
        <ChatLayout session={session} activeResource={activeResource} />
      </div>
    </aside>
  );
});

AIChatSidebar.displayName = 'AIChatSidebar';
export default AIChatSidebar;
