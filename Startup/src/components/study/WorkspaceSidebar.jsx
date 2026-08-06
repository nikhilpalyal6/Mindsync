import React from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import ResourceExplorer from './ResourceExplorer';

export const WorkspaceSidebar = React.memo(({ 
  session, 
  onBack,
  activeResource,
  onSelectResource,
  activeTab,
  onSwitchTab,
  isCollapsed,
  onToggleSidebar
}) => {
  return (
    <aside className={`sw-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header-area" style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: '8px' }}>
        {/* Back to Dashboard Button */}
        <button 
          className="back-btn-dashboard" 
          onClick={onBack} 
          style={{ 
            width: isCollapsed ? '36px' : 'auto', 
            padding: isCollapsed ? '6px' : '6px 10px', 
            justifyContent: 'center',
            minWidth: 0
          }} 
          title="All Workspaces"
        >
          <ArrowLeft size={14} />
          {!isCollapsed && <span style={{ marginLeft: '4px' }}>All Workspaces</span>}
        </button>
        
        <button 
          onClick={onToggleSidebar} 
          className="action-btn-circle" 
          style={{ width: '26px', height: '26px', flexShrink: 0 }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      
      {!isCollapsed && <h3 className="explorer-title">Resource Explorer</h3>}
      
      {/* Resource Explorer Tree */}
      <ResourceExplorer 
        session={session}
        activeResource={activeResource}
        onSelectResource={onSelectResource}
        activeTab={activeTab}
        onSwitchTab={onSwitchTab}
        isCollapsed={isCollapsed}
      />
    </aside>
  );
});

WorkspaceSidebar.displayName = 'WorkspaceSidebar';
export default WorkspaceSidebar;
