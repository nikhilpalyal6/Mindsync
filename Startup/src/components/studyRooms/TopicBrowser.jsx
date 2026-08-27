import React from 'react';
import { Code, Coffee, Database, Cpu, Box, Globe, Sigma, MoreHorizontal } from 'lucide-react';

export default function TopicBrowser({ rooms = [], onTopicSelected, onViewAllClick }) {
  const getCount = (titleKeyword) => {
    const kw = titleKeyword.toLowerCase();
    return rooms.filter((r) => {
      const title = (r.title || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const subject = (r.workshopId?.title || '').toLowerCase();
      
      if (kw === 'dsa') {
        return title.includes('dsa') || title.includes('data structure') || title.includes('algorithm') || title.includes('tree') || title.includes('graph') || desc.includes('dsa');
      }
      if (kw === 'dbms') {
        return title.includes('dbms') || title.includes('database') || desc.includes('database') || title.includes('sql') || title.includes('mongo');
      }
      if (kw === 'operating systems') {
        return title.includes('operating system') || title.includes('os') || title.includes('process') || title.includes('thread') || desc.includes('os');
      }
      if (kw === 'web dev') {
        return title.includes('web dev') || title.includes('javascript') || title.includes('react') || title.includes('html') || title.includes('css') || desc.includes('web dev');
      }
      return title.includes(kw) || desc.includes(kw) || subject.includes(kw);
    }).length;
  };

  const topics = [
    { title: 'DSA', count: getCount('DSA'), color: 'blue', icon: Code },
    { title: 'Java', count: getCount('Java'), color: 'purple', icon: Coffee },
    { title: 'Python', count: getCount('Python'), color: 'yellow', icon: () => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm-1 2h2c1.7 0 3 1.3 3 3v2h-5V8H9V7c0-1.7 1.3-3 3-3zm6 13h-2c-1.7 0-3-1.3-3-3v-2h5v1c0 1.7-1.3 3-3 3z" />
      </svg>
    )},
    { title: 'DBMS', count: getCount('DBMS'), color: 'cyan', icon: Database },
    { title: 'Operating Systems', count: getCount('Operating Systems'), color: 'green', icon: Cpu },
    { title: 'GATE', count: getCount('GATE'), color: 'blue', icon: Box },
    { title: 'Web Dev', count: getCount('Web Dev'), color: 'pink', icon: Globe },
    { title: 'Mathematics', count: getCount('Mathematics'), color: 'purple', icon: Sigma },
    { title: 'More', count: null, color: 'gray', icon: MoreHorizontal }
  ];

  return (
    <div className="dashboard-section">
      <div className="section-header">
        <h2>Browse by Topic</h2>
        <button
          type="button"
          className="column-header-link"
          onClick={onViewAllClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View all
        </button>
      </div>

      <div className="topics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px' }}>
        {topics.map((topic) => {
          const Icon = topic.icon;
          return (
            <div
              key={topic.title}
              className="topic-item-card"
              onClick={() => onTopicSelected(topic.title)}
            >
              <div className={`topic-neon-icon ${topic.color}`}>
                {typeof Icon === 'function' && Icon.name === 'icon' ? <Icon size={20} /> : <Icon size={20} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3>{topic.title}</h3>
                {topic.count !== null && <span>{topic.count} Rooms</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
