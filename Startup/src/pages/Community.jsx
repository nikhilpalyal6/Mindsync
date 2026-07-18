import React from 'react'
import { FiTrendingUp, FiUsers, FiAward, FiBook, FiVideo, FiCalendar, FiMessageCircle, FiHeart, FiDownload, FiZap, FiStar } from 'react-icons/fi'
const heroNeuralBg = '/hero-neural-bg.jpg'
import './community.css'

export default function Community() {
  return (
    <main className="community-page">
      {/* Premium Hero Section */}
      {/* Premium Hero Section */}
      <section className="community-hero">
        <div className="hero-background">
          <img src={heroNeuralBg} alt="Neural Network Background" className="neural-bg-image" />
          <div className="neural-network-overlay"></div>
          <div className="hero-glow"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <FiStar className="badge-icon" />
            <span>Premium Community</span>
          </div>
          <h1 className="hero-title">
            Join the <span className="gradient-text">Elite</span> Learning Community
          </h1>
          <p className="hero-subtitle">
            Connect with top learners, share insights, and accelerate your growth in the most vibrant learning ecosystem.
          </p>
          <div className="hero-cta-group">
            <button className="cta-button hero-cta primary">
              <FiUsers className="cta-icon" />
              Join Now - Free
            </button>
            <button className="cta-button hero-cta secondary">
              <FiVideo className="cta-icon" />
              Watch Tour
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">50K+</div>
              <div className="stat-label">Active Learners</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Discussions</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">500+</div>
              <div className="stat-label">Study Circles</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">1.2K+</div>
              <div className="stat-label">Achievements</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Section - Top Performers */}
      <section className="community-section featured-section">
        <div className="section-container">
          <div className="section-header premium-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiAward className="section-icon" />
              </div>
              <div>
                <div className="section-badge">Featured</div>
                <h2 className="section-title">Top Performers This Week</h2>
                <p className="section-subtitle">Celebrating excellence and dedication in learning</p>
              </div>
            </div>
            <button className="secondary-button premium">
              <FiTrendingUp className="button-icon" />
              View Leaderboard
            </button>
          </div>
          <div className="learners-list premium">
            <LearnerCard
              rank={1}
              avatar="AR"
              name="Alex Rhywin"
              xp="2,347 XP"
              studyTime="47h study"
              avatarColor="gold"
              badge="Champion"
            />
            <LearnerCard
              rank={2}
              avatar="JL"
              name="Jessica Lee"
              xp="2,189 XP"
              studyTime="42h study"
              avatarColor="silver"
              badge="Elite"
            />
            <LearnerCard
              rank={3}
              avatar="ST"
              name="Sam Thompson"
              xp="2,056 XP"
              studyTime="39h study"
              avatarColor="bronze"
              badge="Pro"
            />
            <LearnerCard
              rank={4}
              avatar="MC"
              name="Maria Chen"
              xp="1,987 XP"
              studyTime="38h study"
              avatarColor="teal"
            />
            <LearnerCard
              rank={5}
              avatar="CK"
              name="Chris Kim"
              xp="1,845 XP"
              studyTime="35h study"
              avatarColor="green"
            />
          </div>
        </div>
      </section>

      {/* Trending Discussions - Enhanced */}
      <section className="community-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiTrendingUp className="section-icon" />
              </div>
              <div>
                <h2 className="section-title">Trending Discussions</h2>
                <p className="section-subtitle">Join the hottest conversations in the community</p>
              </div>
            </div>
            <button className="secondary-button">
              <FiMessageCircle className="button-icon" />
              Explore All
            </button>
          </div>
          <div className="discussions-grid">
            <DiscussionCard
              featured={true}
              avatar="SC"
              title="Best AI tools for students in 2024 🔥"
              author="Sarah Chen"
              tags={["AI tools", "Study Tips", "Productivity"]}
              comments={237}
              likes={107}
              views={1200}
              avatarColor="teal"
            />
            <DiscussionCard
              avatar="CD"
              title="Daily study goals - Day 7 Challenge 🧠"
              author="Carlos Diaz"
              tags={["Motivation", "Challenges"]}
              comments={189}
              likes={94}
              views={890}
              avatarColor="green"
            />
            <DiscussionCard
              avatar="MU"
              title="How to maintain focus during long sessions"
              author="Maya Upton"
              tags={["Focus", "Productivity"]}
              comments={156}
              likes={82}
              views={756}
              avatarColor="purple"
            />
            <DiscussionCard
              avatar="AK"
              title="Share your favorite study playlist 🎵"
              author="Alex Kim"
              tags={["Music", "Community"]}
              comments={203}
              likes={125}
              views={1100}
              avatarColor="teal"
            />
          </div>
        </div>
      </section>

      {/* Premium Challenges Section */}
      <section className="community-section premium-challenges">
        <div className="section-container">
          <div className="section-header premium-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiZap className="section-icon" />
              </div>
              <div>
                <div className="section-badge">Challenges</div>
                <h2 className="section-title">Elite Challenges</h2>
                <p className="section-subtitle">Push your limits and unlock exclusive rewards</p>
              </div>
            </div>
          </div>
          <div className="challenges-grid">
            <ChallengeCard
              premium={true}
              icon={<FiZap className="challenge-icon" />}
              title="7-Day Focus Streak Challenge"
              description="Maintain a 7-day study streak and unlock exclusive badges and rewards"
              progress={90}
              participants={124}
              reward="Premium Badge + 500 XP"
            />
            <ChallengeCard
              icon={<FiBook className="challenge-icon" />}
              title="Summarize a Video, Share a Note"
              description="Create and share your best video summaries with the community"
              progress={75}
              participants={89}
              reward="Community Badge"
            />
            <ChallengeCard
              icon={<FiStar className="challenge-icon" />}
              title="Top Flashcard Creator of the Week"
              description="Create the most helpful flashcards and win recognition"
              progress={82}
              participants={156}
              reward="Creator Badge + 300 XP"
            />
          </div>
        </div>
      </section>

      {/* Study Circles - Premium */}
      <section className="community-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiUsers className="section-icon" />
              </div>
              <div>
                <h2 className="section-title">Premium Study Circles</h2>
                <p className="section-subtitle">Join exclusive groups and learn with the best</p>
              </div>
            </div>
            <button className="secondary-button">
              <FiUsers className="button-icon" />
              Browse All
            </button>
          </div>
          <div className="study-circles-grid">
            <StudyCircleCard
              premium={true}
              icon={<span className="circle-icon">&lt;/&gt;</span>}
              title="Web Dev Circle"
              description="Master web development with industry experts"
              members={124}
              activeNow={23}
            />
            <StudyCircleCard
              icon={<FiStar className="circle-icon" />}
              title="AI Learners Hub"
              description="Explore AI and machine learning"
              members={98}
              activeNow={15}
            />
            <StudyCircleCard
              icon={<FiBook className="circle-icon" />}
              title="Exam Prep Forum"
              description="Prepare for exams with peers"
              members={167}
              activeNow={31}
            />
            <StudyCircleCard
              icon={<FiAward className="circle-icon" />}
              title="Study Goals Group"
              description="Set and achieve study goals"
              members={89}
              activeNow={12}
            />
            <StudyCircleCard
              icon={<FiZap className="circle-icon" />}
              title="Productivity Masters"
              description="Master productivity techniques"
              members={112}
              activeNow={19}
            />
            <StudyCircleCard
              icon={<FiTrendingUp className="circle-icon" />}
              title="Learning Science"
              description="Discover effective learning methods"
              members={76}
              activeNow={8}
            />
          </div>
        </div>
      </section>

      {/* Shared Resources - Enhanced */}
      <section className="community-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiBook className="section-icon" />
              </div>
              <div>
                <h2 className="section-title">Premium Resources</h2>
                <p className="section-subtitle">Access curated materials from top learners</p>
              </div>
            </div>
            <button className="secondary-button">
              <FiDownload className="button-icon" />
              View Library
            </button>
          </div>
          <div className="resources-grid">
            <ResourceCard
              featured={true}
              type="PDF"
              title="Complete React Hooks Guide 2024"
              author="Tom Brooks"
              tags={["React", "Web Dev", "Advanced"]}
              downloads={234}
              rating={4.9}
            />
            <ResourceCard
              type="Mind Map"
              title="AI & Machine Learning Roadmap"
              author="Sarah Chen"
              tags={["AI", "Roadmap", "ML"]}
              downloads={189}
              rating={4.8}
            />
            <ResourceCard
              type="Playlist"
              title="Focus Music Collection"
              author="Alex Kim"
              tags={["Music", "Focus", "Productivity"]}
              downloads={312}
              rating={4.7}
            />
            <ResourceCard
              type="Article"
              title="Effective Study Techniques"
              author="Maria Chen"
              tags={["Study Tips", "Learning"]}
              downloads={267}
              rating={4.9}
            />
            <ResourceCard
              type="PDF"
              title="JavaScript Cheat Sheet"
              author="Chris Kim"
              tags={["JavaScript", "Reference"]}
              downloads={445}
              rating={4.8}
            />
            <ResourceCard
              type="Mind Map"
              title="Data Structures Overview"
              author="Sam Thompson"
              tags={["CS", "Algorithms"]}
              downloads={198}
              rating={4.6}
            />
          </div>
        </div>
      </section>

      {/* Live Study Rooms - Premium */}
      <section className="community-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiVideo className="section-icon" />
              </div>
              <div>
                <h2 className="section-title">Live Study Rooms</h2>
                <p className="section-subtitle">Join live focused study sessions with peers</p>
              </div>
            </div>
            <button className="primary-button">
              <FiVideo className="button-icon" />
              Create Room
            </button>
          </div>
          <div className="study-rooms-grid">
            <StudyRoomCard
              status="live"
              title="Focus Zone Alpha"
              participants={12}
              maxParticipants={20}
              time="Started: 18:33"
              activity="Current: Study Session"
              premium={true}
            />
            <StudyRoomCard
              status="live"
              title="Pomodoro Power"
              participants={8}
              maxParticipants={15}
              time="Started: 19:15"
              activity="Current: Study Session"
            />
            <StudyRoomCard
              status="waiting"
              title="Deep Work Den"
              participants={5}
              maxParticipants={12}
              time="Starts: 09:00"
              activity="Current: Waiting"
            />
            <StudyRoomCard
              status="waiting"
              title="Exam Prep Central"
              participants={3}
              maxParticipants={10}
              time="Starts: 10:30"
              activity="Current: Waiting"
            />
          </div>
        </div>
      </section>

      {/* Upcoming Events - Enhanced */}
      <section className="community-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div className="section-icon-wrapper">
                <FiCalendar className="section-icon" />
              </div>
              <div>
                <h2 className="section-title">Upcoming Events</h2>
                <p className="section-subtitle">Don't miss out on exclusive workshops and events</p>
              </div>
            </div>
            <button className="secondary-button">
              <FiCalendar className="button-icon" />
              View Calendar
            </button>
          </div>
          <div className="events-grid">
            <EventCard
              isLive={true}
              featured={true}
              title="Study with Me - Focus Session"
              date="Tomorrow"
              time="7:00 PM EST"
              host="Hosted by Focus Squad"
              action="Join Live"
              attendees={120}
            />
            <EventCard
              isLive={false}
              title="AI Tools for Students Workshop"
              date="12/01/2024"
              time="3:00 PM EST"
              host="Hosted by MindSync Team"
              action="Set Reminder"
              attendees={89}
            />
            <EventCard
              isLive={false}
              title="MindSync Buildathon 2024"
              date="15/01/2024"
              time="10:00 AM EST"
              host="Hosted by MindSync Team"
              action="View Details"
              attendees={250}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

// Enhanced Discussion Card Component
function DiscussionCard({ avatar, title, author, tags, comments, likes, views, avatarColor = 'teal', featured = false }) {
  return (
    <div className={`discussion-card ${featured ? 'featured' : ''}`}>
      {featured && <div className="featured-badge">🔥 Hot</div>}
      <div className="discussion-header">
        <div className={`avatar avatar-${avatarColor}`}>{avatar}</div>
        <div className="discussion-info">
          <h3 className="discussion-title">{title}</h3>
          <p className="discussion-author">by {author}</p>
        </div>
      </div>
      <div className="discussion-tags">
        {tags.map((tag, index) => (
          <span key={index} className="tag">{tag}</span>
        ))}
      </div>
      <div className="discussion-stats">
        <span className="stat">
          <FiMessageCircle className="stat-icon" />
          {comments}
        </span>
        <span className="stat">
          <FiHeart className="stat-icon" />
          {likes}
        </span>
        {views && (
          <span className="stat">
            <FiTrendingUp className="stat-icon" />
            {views > 1000 ? `${(views / 1000).toFixed(1)}K` : views}
          </span>
        )}
      </div>
    </div>
  )
}

// Enhanced Challenge Card Component
function ChallengeCard({ icon, title, description, progress, participants, reward, premium = false }) {
  return (
    <div className={`challenge-card ${premium ? 'premium' : ''}`}>
      {premium && <div className="premium-badge">⭐ Premium</div>}
      <div className="challenge-icon-wrapper">{icon}</div>
      <h3 className="challenge-title">{title}</h3>
      <p className="challenge-description">{description}</p>
      <div className="challenge-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">{progress}% complete</div>
      </div>
      {reward && (
        <div className="challenge-reward">
          <FiAward className="reward-icon" />
          <span>{reward}</span>
        </div>
      )}
      <div className="challenge-footer">
        <span className="participants">
          <FiUsers className="participants-icon" />
          {participants} participants
        </span>
        <button className="join-button">Join</button>
      </div>
    </div>
  )
}

// Enhanced Learner Card Component
function LearnerCard({ rank, avatar, name, xp, studyTime, avatarColor = 'teal', badge }) {
  return (
    <div className={`learner-card ${avatarColor === 'gold' ? 'rank-1' : avatarColor === 'silver' ? 'rank-2' : avatarColor === 'bronze' ? 'rank-3' : ''}`}>
      <div className="learner-rank">{rank}</div>
      <div className={`avatar learner-avatar avatar-${avatarColor}`}>{avatar}</div>
      <div className="learner-info">
        <div className="learner-header">
          <h3 className="learner-name">{name}</h3>
          {badge && <span className="learner-badge">{badge}</span>}
        </div>
        <p className="learner-stats">
          <span className="stat-item">
            <FiStar className="stat-icon-small" />
            {xp}
          </span>
          <span className="stat-item">
            <FiZap className="stat-icon-small" />
            {studyTime}
          </span>
        </p>
      </div>
    </div>
  )
}

// Enhanced Study Circle Card Component
function StudyCircleCard({ icon, title, description, members, activeNow, premium = false }) {
  return (
    <div className={`study-circle-card ${premium ? 'premium' : ''}`}>
      {premium && <div className="premium-badge">⭐ Premium</div>}
      <div className="circle-icon-wrapper">{icon}</div>
      <h3 className="circle-title">{title}</h3>
      <p className="circle-description">{description}</p>
      <div className="circle-stats">
        <span className="circle-members">
          <FiUsers className="members-icon" />
          {members} members
        </span>
        {activeNow && (
          <span className="circle-active">
            <span className="active-dot"></span>
            {activeNow} active now
          </span>
        )}
      </div>
      <div className="circle-footer">
        <button className="join-button outline">Join Circle</button>
      </div>
    </div>
  )
}

// Enhanced Resource Card Component
function ResourceCard({ type, title, author, tags, downloads, rating, featured = false }) {
  return (
    <div className={`resource-card ${featured ? 'featured' : ''}`}>
      {featured && <div className="featured-badge">⭐ Featured</div>}
      <div className="resource-type">{type}</div>
      <h3 className="resource-title">{title}</h3>
      <p className="resource-author">by {author}</p>
      {rating && (
        <div className="resource-rating">
          <FiStar className="star-icon filled" />
          <span>{rating}</span>
        </div>
      )}
      <div className="resource-tags">
        {tags.map((tag, index) => (
          <span key={index} className="tag">{tag}</span>
        ))}
      </div>
      <div className="resource-footer">
        <span className="downloads">
          <FiDownload className="download-icon" />
          {downloads} downloads
        </span>
        <button className="view-button">View</button>
      </div>
    </div>
  )
}

// Enhanced Study Room Card Component
function StudyRoomCard({ status, title, participants, maxParticipants, time, activity, premium = false }) {
  return (
    <div className={`study-room-card ${premium ? 'premium' : ''}`}>
      {premium && <div className="premium-badge">⭐ Premium</div>}
      <div className={`room-status ${status}`}>
        {status === 'live' ? (
          <>
            <span className="live-dot"></span>
            Live
          </>
        ) : (
          'Waiting'
        )}
      </div>
      <h3 className="room-title">{title}</h3>
      <div className="room-info">
        <span className="room-participants">
          <FiUsers className="participants-icon" />
          {participants}{maxParticipants && `/${maxParticipants}`} participants
        </span>
        <span className="room-time">{time}</span>
      </div>
      <p className="room-activity">{activity}</p>
      <button className={status === 'live' ? 'join-room-button live' : 'join-room-button'}>
        {status === 'live' ? 'Join Now' : 'Set Reminder'}
      </button>
    </div>
  )
}

// Enhanced Event Card Component
function EventCard({ isLive, title, date, time, host, action, attendees, featured = false }) {
  return (
    <div className={`event-card ${featured ? 'featured' : ''}`}>
      {isLive && <div className="event-status live">
        <span className="live-dot"></span>
        Live Now
      </div>}
      {featured && !isLive && <div className="featured-badge">⭐ Featured</div>}
      <h3 className="event-title">{title}</h3>
      <div className="event-date">{date}</div>
      <div className="event-time">{time}</div>
      <p className="event-host">{host}</p>
      {attendees && (
        <div className="event-attendees">
          <FiUsers className="attendees-icon" />
          <span>{attendees} registered</span>
        </div>
      )}
      <button className={isLive ? 'event-button live' : 'event-button secondary'}>
        {action}
      </button>
    </div>
  )
}
