import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { showToast } from '../components/Toast'
import Toggle from '../components/Toggle'
import './auth.css'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getUserPreferences,
  updateUserPreferences,
  getRecentActivity,
  getLoginHistory,
  clearLoginHistory,
  getActiveSessions,
  logoutDevice,
  logoutAllOtherDevices,
  deleteAccount
} from '../services/api'

const TAB_NAMES = {
  GENERAL: 'General',
  SECURITY: 'Security',
  NOTIFICATIONS: 'Notifications',
  APPEARANCE: 'Appearance',
  SESSIONS: 'Sessions',
  ACTIVITY: 'Activity',
  DANGER: 'Danger Zone'
}

export default function Settings() {
  const { signOut, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(TAB_NAMES.SECURITY)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Notifications state
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    productUpdates: true,
    learningReminders: true,
    securityAlerts: true,
    weeklyReports: true,
    marketingEmails: false
  })

  // User preferences state
  const [userPrefs, setUserPrefs] = useState({
    language: 'en',
    timezone: 'UTC',
    studyReminder: true,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12',
    landingPage: '/study-mode',
    animations: true
  })

  // Sessions/Devices state
  const [sessions, setSessions] = useState([])

  // Recent activity state
  const [activities, setActivities] = useState([])

  // Login history state
  const [loginHistory, setLoginHistory] = useState([])

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  // Activity sub-tab state
  const [activeSubTab, setActiveSubTab] = useState('activity')

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // Fetch notification preferences
      const notifData = await getNotificationPreferences()
      setNotificationPrefs(notifData)

      // Fetch user preferences
      const userPrefsData = await getUserPreferences()
      setUserPrefs(userPrefsData)

      // Fetch sessions
      const sessionsData = await getActiveSessions()
      setSessions(sessionsData)

      // Fetch recent activity
      const activityData = await getRecentActivity()
      setActivities(activityData)

      // Fetch login history
      const historyData = await getLoginHistory()
      setLoginHistory(historyData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message)
      }

      setMessage('Password changed successfully. Signing out...')
      showToast('Password changed successfully', 'success')
      await signOut()
      navigate('/login')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle notification preferences update
  const handleNotificationUpdate = async (key, value) => {
    const newPrefs = { ...notificationPrefs, [key]: value }
    setNotificationPrefs(newPrefs)

    try {
      await updateNotificationPreferences(newPrefs)
      showToast('Preferences updated', 'success')
    } catch (err) {
      console.error('Failed to update notification preferences:', err)
      showToast('Failed to update preferences', 'error')
    }
  }

  // Handle user preferences update
  const handleUserPrefsUpdate = async (key, value) => {
    const newPrefs = { ...userPrefs, [key]: value }
    setUserPrefs(newPrefs)

    try {
      await updateUserPreferences(newPrefs)
      showToast('Preferences updated', 'success')
    } catch (err) {
      console.error('Failed to update user preferences:', err)
      showToast('Failed to update preferences', 'error')
    }
  }

  // Handle logout device
  const handleLogoutDevice = async (sessionId) => {
    try {
      await logoutDevice(sessionId)
      showToast('Device logged out', 'success')
      fetchData()
    } catch (err) {
      console.error('Failed to logout device:', err)
      showToast('Failed to logout device', 'error')
    }
  }

  // Handle logout all other devices
  const handleLogoutAllDevices = async () => {
    try {
      await logoutAllOtherDevices()
      showToast('All other devices logged out', 'success')
      fetchData()
    } catch (err) {
      console.error('Failed to logout all devices:', err)
      showToast('Failed to logout all devices', 'error')
    }
  }

  // Handle delete account
  const handleDeleteAccount = async () => {
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const body = { confirmation: deleteConfirm }
      if (user?.provider !== 'google') {
        body.password = deletePassword
      }

      await deleteAccount(body)

      setMessage('Account deleted successfully. Redirecting to home...')
      showToast('Account deleted successfully', 'success')
      await signOut()
      navigate('/')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    showToast('Logged out successfully', 'success')
    navigate('/login')
  }

  // Render tabs
  const renderTabs = () => (
    <div className="settings-tabs">
      {Object.values(TAB_NAMES).map(tab => (
        <button
          key={tab}
          className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case TAB_NAMES.GENERAL:
        return (
          <div className="settings-content">
            <h2>General Preferences</h2>
            <div className="settings-card">
              <div className="form-group">
                <label>Language</label>
                <select
                  value={userPrefs.language}
                  onChange={(e) => handleUserPrefsUpdate('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={userPrefs.timezone}
                  onChange={(e) => handleUserPrefsUpdate('timezone', e.target.value)}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date Format</label>
                <select
                  value={userPrefs.dateFormat}
                  onChange={(e) => handleUserPrefsUpdate('dateFormat', e.target.value)}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time Format</label>
                <select
                  value={userPrefs.timeFormat}
                  onChange={(e) => handleUserPrefsUpdate('timeFormat', e.target.value)}
                >
                  <option value="12">12-hour</option>
                  <option value="24">24-hour</option>
                </select>
              </div>
              <Toggle
                label="Enable Animations"
                checked={userPrefs.animations}
                onChange={(checked) => handleUserPrefsUpdate('animations', checked)}
              />
            </div>
          </div>
        )
      case TAB_NAMES.SECURITY:
        return (
          <div className="settings-content">
            <h2>Security Settings</h2>
            <div className="settings-card">
              <p>Update your password or sign out from this device.</p>
              <button type="button" className="secondary-btn" onClick={handleLogout}>
                Logout
              </button>
              <button type="button" className="secondary-btn" onClick={() => navigate('/forgot-password')}>
                Forgot password?
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="auth-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? <span className="loading-spinner"></span> : 'Change password'}
              </button>
            </form>
          </div>
        )
      case TAB_NAMES.NOTIFICATIONS:
        return (
          <div className="settings-content">
            <h2>Notification Preferences</h2>
            <div className="settings-card">
              <Toggle
                label="Email Notifications"
                checked={notificationPrefs.emailNotifications}
                onChange={(checked) => handleNotificationUpdate('emailNotifications', checked)}
              />
              <Toggle
                label="Product Updates"
                checked={notificationPrefs.productUpdates}
                onChange={(checked) => handleNotificationUpdate('productUpdates', checked)}
              />
              <Toggle
                label="Learning Reminders"
                checked={notificationPrefs.learningReminders}
                onChange={(checked) => handleNotificationUpdate('learningReminders', checked)}
              />
              <Toggle
                label="Security Alerts"
                checked={notificationPrefs.securityAlerts}
                onChange={(checked) => handleNotificationUpdate('securityAlerts', checked)}
              />
              <Toggle
                label="Weekly Reports"
                checked={notificationPrefs.weeklyReports}
                onChange={(checked) => handleNotificationUpdate('weeklyReports', checked)}
              />
              <Toggle
                label="Marketing Emails"
                checked={notificationPrefs.marketingEmails}
                onChange={(checked) => handleNotificationUpdate('marketingEmails', checked)}
              />
            </div>
          </div>
        )
      case TAB_NAMES.APPEARANCE:
        return (
          <div className="settings-content">
            <h2>Appearance</h2>
            <div className="settings-card">
              <div className="theme-options">
                <button
                  className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  ☀️ Light
                </button>
                <button
                  className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  🌙 Dark
                </button>
                <button
                  className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  💻 System
                </button>
              </div>
            </div>
          </div>
        )
      case TAB_NAMES.SESSIONS:
        return (
          <div className="settings-content">
            <div className="section-header">
              <h2>Active Sessions</h2>
              <button type="button" className="secondary-btn" onClick={handleLogoutAllDevices}>
                Logout all other devices
              </button>
            </div>
            <div className="sessions-list">
              {sessions.map(session => (
                <div key={session._id} className="session-card">
                  <div className="session-info">
                    <div className="session-device">
                      {session.isCurrent && <span className="current-badge">Current</span>}
                      <strong>{session.browser || 'Unknown browser'}</strong>
                      <span>{session.os || 'Unknown OS'}</span>
                    </div>
                    <div className="session-meta">
                      <span>IP: {session.ipAddress || 'Unknown'}</span>
                      <span>Last active: {new Date(session.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => handleLogoutDevice(session._id)}
                    >
                      Logout
                    </button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="empty-state">No active sessions found.</div>
              )}
            </div>
          </div>
        )
      case TAB_NAMES.ACTIVITY:
        return (
          <div className="settings-content">
            <div className="section-header">
              <h2>Recent Activity & Login History</h2>
              <div className="sub-tabs">
                <button
                  type="button"
                  className={`settings-tab ${activeSubTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('activity')}
                >
                  Recent Activity
                </button>
                <button
                  type="button"
                  className={`settings-tab ${activeSubTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('history')}
                >
                  Login History
                </button>
              </div>
            </div>
            {activeSubTab === 'activity' && (
              <div className="activity-list">
                {activities.map(activity => (
                  <div key={activity._id} className="activity-card">
                    <div className="activity-info">
                      <strong>{activity.action}</strong>
                      <span>{new Date(activity.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="empty-state">No recent activity found.</div>
                )}
              </div>
            )}
            {activeSubTab === 'history' && (
              <div className="activity-list">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={async () => {
                    try {
                      await clearLoginHistory()
                      showToast('Login history cleared', 'success')
                      fetchData()
                    } catch (err) {
                      showToast('Failed to clear login history', 'error')
                    }
                  }}
                >
                  Clear Login History
                </button>
                {loginHistory.map(entry => (
                  <div key={entry._id} className="activity-card">
                    <div className="activity-info">
                      <strong>
                        {entry.provider ? `${entry.provider} login` : 'Login'} -{' '}
                        {entry.success ? 'Success' : 'Failed'}
                      </strong>
                      <span>{new Date(entry.loginTime).toLocaleString()}</span>
                      {entry.browser && <span>{entry.browser} on {entry.os}</span>}
                      {entry.ipAddress && <span>IP: {entry.ipAddress}</span>}
                    </div>
                  </div>
                ))}
                {loginHistory.length === 0 && (
                  <div className="empty-state">No login history found.</div>
                )}
              </div>
            )}
          </div>
        )
      case TAB_NAMES.DANGER:
        return (
          <div className="settings-content">
            <h2>Danger Zone</h2>
            <div className="danger-zone">
              <h3>Delete Account</h3>
              <p>Deleting your account will log you out and remove access to MindSync.</p>
              <div className="form-group">
                <label>Confirm deletion by typing "DELETE"</label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE"
                />
              </div>
              {user?.provider !== 'google' && (
                <div className="form-group">
                  <label>Enter your password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
              )}
              <button
                type="button"
                className="danger-btn"
                onClick={handleDeleteAccount}
                disabled={isLoading || deleteConfirm !== 'DELETE'}
              >
                {isLoading ? <span className="loading-spinner"></span> : 'Delete Account'}
              </button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-background-effects">
        <div className="bg-particle p1"></div>
        <div className="bg-particle p2"></div>
        <div className="bg-particle p3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-image">
          <div className="image-content">
            <div className="image-badge">Settings</div>
            <h1>Manage your account</h1>
            <p className="image-description">
              Customize your experience and keep your account safe.
            </p>
          </div>
        </div>

        <div className="auth-form-container">
          <div className="auth-header">
            <button type="button" className="back-link" onClick={() => navigate(-1)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>

          <div className="auth-form-content">
            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            {renderTabs()}
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
