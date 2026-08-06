import React from 'react';
import { 
  Home, 
  FolderOpen,
  Edit3, 
  Map 
} from 'lucide-react';

export const WorkspaceTabs = React.memo(({ activeTab, onTabChange, activeResource }) => {
  const tabs = [
    { id: 'overview', name: 'Overview', icon: Home },
    { id: 'sources', name: 'Sources', icon: FolderOpen },
    { id: 'notes_viewer', name: 'Notes', icon: Edit3 },
    { id: 'mindmap', name: 'Mind Map', icon: Map }
  ];

  // If a resource sub-tab is active, highlight 'sources' in the global nav
  const highlightedTab = activeResource && !['overview', 'mindmap', 'notes_viewer'].includes(activeTab)
    ? 'sources'
    : activeTab;

  return (
    <div style={{ padding: '0 24px 10px 24px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(14, 17, 24, 0.95)', flexShrink: 0 }}>
      <div className="sw-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = highlightedTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="tab-btn-icon" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

WorkspaceTabs.displayName = 'WorkspaceTabs';
export default WorkspaceTabs;
