import React, { useState, useEffect } from 'react';
import { Plus, Menu } from 'lucide-react';
import { getStudyRooms, getPendingTasks } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/Toast';

// Component Imports
import StudyRoomsSidebar from '../../components/studyRooms/StudyRoomsSidebar';
import StudyRoomFilters from '../../components/studyRooms/StudyRoomFilters';
import RecommendedRooms from '../../components/studyRooms/RecommendedRooms';
import LiveRooms from '../../components/studyRooms/LiveRooms';
import UpcomingRooms from '../../components/studyRooms/UpcomingRooms';
import MyRooms from '../../components/studyRooms/MyRooms';
import TopicBrowser from '../../components/studyRooms/TopicBrowser';
import CreateRoomModal from '../../components/studyRooms/CreateRoomModal';
import StudyRoomCard from '../../components/studyRooms/StudyRoomCard';

import './StudyRooms.css';

export default function StudyRooms() {
  const { user } = useAuth();
  
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subview navigation: 'explore' | 'my-rooms' | 'calendar' | 'goals' | 'history' | 'analytics'
  const [activeView, setActiveView] = useState('explore');

  // Toolbar State
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');

  // Modals & Menu State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Dynamic Goals List State
  const [goalsList, setGoalsList] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  const fetchRooms = () => {
    setLoading(true);
    setError(null);
    getStudyRooms()
      .then((res) => {
        if (Array.isArray(res)) {
          setRooms(res);
        } else {
          setError('Failed to fetch rooms');
        }
      })
      .catch((err) => {
        console.error('Error fetching study rooms:', err);
        setError(err.message || 'Error loading study rooms. Please check connection.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (activeView === 'goals') {
      setLoadingGoals(true);
      getPendingTasks()
        .then((res) => {
          if (res && res.tasks) {
            setGoalsList(res.tasks);
          } else if (Array.isArray(res)) {
            setGoalsList(res);
          } else {
            setGoalsList([]);
          }
        })
        .catch((err) => {
          console.error('Failed to load pending goals:', err);
          setGoalsList([]);
        })
        .finally(() => {
          setLoadingGoals(false);
        });
    }
  }, [activeView]);

  const handleRoomCreated = () => {
    fetchRooms();
    setActiveView('explore');
  };

  const handleTopicSelected = (topic) => {
    setSearchQuery(topic);
    setSubjectFilter(topic);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter Logic based on toolbar search/filters
  const getFilteredRooms = () => {
    let filtered = [...rooms];

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    } else {
      // exclude ended/cancelled by default
      filtered = filtered.filter((r) => r.status !== 'ENDED' && r.status !== 'CANCELLED');
    }

    // Subject filter
    if (subjectFilter) {
      const sub = subjectFilter.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(sub) ||
          (r.description && r.description.toLowerCase().includes(sub)) ||
          (r.workshopId?.title && r.workshopId.title.toLowerCase().includes(sub))
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.workshopId?.title && r.workshopId.title.toLowerCase().includes(q))
      );
    }

    // Duration filter mock (durations not supported in model fields but we map logically based on capacity or metadata)
    if (durationFilter) {
      if (durationFilter === 'short') {
        filtered = filtered.filter((r) => r.capacity <= 5);
      } else if (durationFilter === 'medium') {
        filtered = filtered.filter((r) => r.capacity > 5 && r.capacity <= 20);
      } else {
        filtered = filtered.filter((r) => r.capacity > 20);
      }
    }

    return filtered;
  };

  const filteredRooms = getFilteredRooms();

  // Subview renders
  const renderExploreView = () => {
    if (loading) {
      return (
        <div className="rooms-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <h3>Error Loading Rooms</h3>
          <p>{error}</p>
          <button type="button" className="btn-primary" onClick={fetchRooms}>
            Retry Connection
          </button>
        </div>
      );
    }

    if (rooms.length === 0) {
      const canCreateRooms = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
      return (
        <div className="empty-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.5 }}>📚</div>
          <h3>No Study Rooms Available</h3>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.9rem', margin: '8px 0 20px' }}>
            {canCreateRooms ? 'Create a new study room or wait for hosts to start a session.' : 'There are currently no active or scheduled study rooms. Check back when a host starts a session.'}
          </p>
          {canCreateRooms && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }}
            >
              <Plus size={16} />
              <span>Create Study Room</span>
            </button>
          )}
        </div>
      );
    }

    // If query search or filters are active, show single result grid
    if (searchQuery.trim() || subjectFilter || statusFilter || durationFilter) {
      return (
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Search Results ({filteredRooms.length})</h2>
          </div>
          {filteredRooms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No matching rooms</h3>
              <p>Try clearing your search query or adjusting filters.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSearchQuery('');
                  setSubjectFilter('');
                  setStatusFilter('');
                  setDurationFilter('');
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="rooms-grid">
              {filteredRooms.map((room) => (
                <StudyRoomCard
                  key={room._id}
                  room={room}
                  currentUser={user}
                  onStateChanged={fetchRooms}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        {/* Recommended Row holding 3 distinct panels */}
        <RecommendedRooms
          rooms={rooms}
          currentUser={user}
          onStateChanged={fetchRooms}
        />

        {/* 3-Column Dashboard Main Panel */}
        <div className="dashboard-three-columns">
          <LiveRooms
            rooms={rooms}
            currentUser={user}
            onStateChanged={fetchRooms}
            onViewAllClick={() => showToast('Navigating to Live Rooms list', 'info')}
          />
          <UpcomingRooms
            rooms={rooms}
            onViewAllClick={() => showToast('Navigating to Scheduled Rooms list', 'info')}
          />
          <MyRooms
            rooms={rooms}
            currentUser={user}
            onStateChanged={fetchRooms}
            onExploreClick={() => setActiveView('explore')}
            onViewAllClick={() => showToast('Navigating to My Rooms list', 'info')}
          />
        </div>

        {/* Category topic selector */}
        <TopicBrowser
          rooms={rooms}
          onTopicSelected={handleTopicSelected}
          onViewAllClick={() => showToast('Navigating to all subjects index', 'info')}
        />
      </>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'explore':
        return (
          <>
            <StudyRoomFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              subjectFilter={subjectFilter}
              onSubjectChange={setSubjectFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              durationFilter={durationFilter}
              onDurationChange={setDurationFilter}
            />
            {renderExploreView()}
          </>
        );

      case 'my-rooms':
        return (
          <div className="dashboard-section">
            <MyRooms
              rooms={rooms}
              currentUser={user}
              onStateChanged={fetchRooms}
              onExploreClick={() => setActiveView('explore')}
              onViewAllClick={() => showToast('Viewing all user joined sessions', 'info')}
            />
          </div>
        );

      case 'calendar': {
        const currentDate = new Date();
        const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const currentDay = currentDate.getDate();
        const scheduledRooms = rooms.filter((r) => r.status === 'SCHEDULED' && r.scheduledStart);

        return (
          <div className="calendar-view">
            <div className="calendar-header">
              <div className="calendar-title">{monthName}</div>
            </div>
            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="calendar-day-label">
                  {d}
                </div>
              ))}
              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = idx + 1;
                const isToday = day === currentDay;
                const roomsOnDay = scheduledRooms.filter((r) => {
                  const sDate = new Date(r.scheduledStart);
                  return (
                    sDate.getFullYear() === currentDate.getFullYear() &&
                    sDate.getMonth() === currentDate.getMonth() &&
                    sDate.getDate() === day
                  );
                });

                return (
                  <div key={day} className={`calendar-day ${isToday ? 'today' : ''}`}>
                    <span className="calendar-day-num">{day}</span>
                    {roomsOnDay.map((r) => (
                      <div key={r._id} className="calendar-event-tag" title={r.title}>
                        {r.title.length > 12 ? `${r.title.substring(0, 10)}...` : r.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'goals':
        return (
          <div className="goals-view">
            <div className="section-header">
              <h2>Your Study Goals & Planner Tasks</h2>
            </div>
            {loadingGoals ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--admin-text-muted)' }}>
                Loading goals from Study Planner...
              </div>
            ) : goalsList.length === 0 ? (
              <div
                className="empty-state"
                style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--admin-text-muted)' }}
              >
                <p>No active study tasks in Study Planner. Create study tasks in the planner or inside study rooms.</p>
              </div>
            ) : (
              <div className="goals-list">
                {goalsList.map((g) => (
                  <div key={g._id || g.id} className="goal-item-row">
                    <div className="goal-item-content">
                      <span className={`goal-title-text ${g.status === 'COMPLETED' ? 'completed' : ''}`}>
                        {g.title}
                      </span>
                    </div>
                    <span className="goal-tag">{g.status || 'ACTIVE'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'history': {
        const userJoinedHistory = rooms.filter((r) => r.isCurrentUserParticipant);

        return (
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Study Session History</h2>
            </div>
            {userJoinedHistory.length === 0 ? (
              <div
                className="empty-state"
                style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--admin-text-muted)' }}
              >
                <p>No study sessions attended yet. Join a live study room to build your history.</p>
              </div>
            ) : (
              <div className="history-timeline">
                {userJoinedHistory.map((room) => {
                  const startTimeStr = room.actualStart || room.createdAt;
                  const dateFormatted = startTimeStr
                    ? new Date(startTimeStr).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : '';
                  return (
                    <div key={room._id} className="history-item">
                      <div className="history-dot">📚</div>
                      <div className="history-card">
                        <div className="history-card-header">
                          <span className="history-card-title">{room.title}</span>
                          <span className="history-card-time">{dateFormatted}</span>
                        </div>
                        <div className="history-card-meta">
                          Status: {room.status} • Capacity: {room.capacity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'analytics': {
        const userRooms = rooms.filter((r) => r.isCurrentUserParticipant);
        let totalMinutes = 0;
        for (const r of userRooms) {
          if (r.actualStart && r.actualEnd) {
            totalMinutes += Math.max(0, Math.round((new Date(r.actualEnd) - new Date(r.actualStart)) / 60000));
          } else if (r.status === 'LIVE' && r.actualStart) {
            totalMinutes += Math.max(0, Math.round((Date.now() - new Date(r.actualStart)) / 60000));
          }
        }
        const avgMinutes = userRooms.length > 0 ? Math.round(totalMinutes / userRooms.length) : 0;

        return (
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Sessions Attended</h3>
              <div className="chart-placeholder">
                {userRooms.length === 0 ? (
                  <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem', margin: 'auto' }}>
                    No sessions recorded yet
                  </div>
                ) : (
                  userRooms.slice(0, 7).map((r, idx) => (
                    <div key={r._id || idx} className="chart-bar-wrapper">
                      <div className="chart-bar-fill" style={{ height: '60px' }} />
                      <span className="chart-bar-label">S{idx + 1}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="analytics-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Key Metrics</h3>
                <div style={{ margin: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>SESSIONS ATTENDED</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{userRooms.length} Sessions</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>AVERAGE DURATION</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{avgMinutes} mins</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (activeView) {
      case 'explore':
        return 'Study Rooms';
      case 'my-rooms':
        return 'My Study Rooms';
      case 'calendar':
        return 'Study Calendar';
      case 'goals':
        return 'Personal Goals';
      case 'history':
        return 'Session History';
      case 'analytics':
        return 'Study Analytics';
      default:
        return 'Study Rooms';
    }
  };

  return (
    <div className="study-rooms-layout" data-testid="study-rooms-container">
      {/* Mobile navigation header */}
      <div className="mobile-nav-bar">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setIsMobileSidebarOpen(true)}
          aria-label="Toggle Sidebar Menu"
        >
          <Menu size={24} />
        </button>
        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Study Rooms Hub</span>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar component */}
      <StudyRoomsSidebar
        activeView={activeView}
        onViewChanged={setActiveView}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        rooms={rooms}
      />

      {/* Main Content Area */}
      <main className="study-rooms-main">
        <div className="rooms-dashboard-header-container">
          <div className="header-meta-text">
            <h1>{getHeaderTitle()}</h1>
            <p>Join focused study sessions. Achieve more together.</p>
          </div>

          {/* Interactive neon hologram visual block */}
          <div className="focus-hologram-visual">
            <div className="hologram-text-block">
              <span className="hologram-label">FOCUS TIME</span>
              <span className="hologram-timer">25:00</span>
              <span className="hologram-tagline">Let's Focus!</span>
            </div>
            
            <svg className="hologram-svg-art" viewBox="0 0 140 80" width="140" height="80" aria-hidden="true">
              <defs>
                <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#4ef2c9" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path d="M0,60 L140,60 M20,10 L20,80 M60,10 L60,80 M100,10 L100,80" stroke="rgba(29, 78, 216, 0.08)" strokeWidth="1" />
              <circle cx="85" cy="40" r="24" fill="none" stroke="url(#neonGlow)" strokeWidth="2.5" strokeDasharray="3 1" />
              <circle cx="85" cy="40" r="18" fill="none" stroke="#4ef2c9" strokeWidth="1" opacity="0.4" />
              <path d="M40,55 Q55,45 70,55 T100,55" fill="none" stroke="#4ef2c9" strokeWidth="1.5" opacity="0.6" />
              <path d="M10,70 L130,70" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {renderActiveView()}
      </main>

      {/* Modal overlays */}
      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <CreateRoomModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRoomCreated={handleRoomCreated}
        />
      )}
    </div>
  );
}
