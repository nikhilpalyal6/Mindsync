import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { showToast } from '../components/Toast'
import './auth.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

export default function Settings() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
        throw new Error(data.message || 'Unable to change password')
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

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      return
    }

    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/account`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to delete account')
      }

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
            <h1>Security & account</h1>
            <p className="image-description">
              Manage your password and account settings safely.
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
            <div className="form-header">
              <h1>Settings</h1>
              <p className="form-subtitle">Keep your account secure and up to date.</p>
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="settings-panel">
              <div className="settings-card">
                <h2>Security settings</h2>
                <p>Update your password or sign out from this device.</p>
                <button type="button" className="secondary-btn" onClick={handleLogout}>
                  Logout
                </button>
                <button type="button" className="secondary-btn" onClick={() => navigate('/forgot-password')}>
                  Forgot password?
                </button>
              </div>
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

            <div className="danger-zone">
              <h2>Delete account</h2>
              <p>Deleting your account will log you out and remove access to MindSync.</p>
              <button type="button" className="danger-btn" onClick={handleDeleteAccount} disabled={isLoading}>
                {isLoading ? <span className="loading-spinner"></span> : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
