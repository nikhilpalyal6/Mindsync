import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { showToast } from '../components/Toast'
import './auth.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export default function Profile() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ name: '', username: '', bio: '' })
  const [profileImage, setProfileImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        bio: user.bio || ''
      })
      setPreviewUrl(user.profileImage || user.avatar || '')
    }
  }, [user])

  useEffect(() => {
    return () => {
      if (previewUrl && profileImage) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, profileImage])

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const providerLabel = user?.provider === 'google' ? 'Google' : 'Email'
  const verificationLabel = user?.isVerified ? 'Verified' : 'Not verified'

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WEBP image.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image must be smaller than 5 MB.')
      return
    }

    setError('')
    setProfileImage(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const formDataPayload = new FormData()
      formDataPayload.append('name', formData.name)
      formDataPayload.append('username', formData.username)
      formDataPayload.append('bio', formData.bio)
      if (profileImage) {
        formDataPayload.append('profileImage', profileImage)
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PATCH',
        credentials: 'include',
        body: formDataPayload,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update profile')
      }

      setUser(data.data)
      setPreviewUrl(data.data.profileImage || data.data.avatar || previewUrl)
      setMessage('Profile updated successfully')
      showToast('Profile updated successfully')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Unable to resend verification email')
      }

      setMessage('Verification email has been resent.')
      showToast('Verification email resent', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
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
            <div className="image-badge">Profile</div>
            <h1>Manage your account</h1>
            <p className="image-description">
              Update your profile details and keep your account information current.
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
              <h1>Profile</h1>
              <p className="form-subtitle">Your account information is safe and secure.</p>
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="profile-summary-card">
              <div className="profile-summary-header">
                <div className="profile-avatar-large">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Profile" />
                  ) : (
                    <div className="profile-avatar-placeholder-large">{user?.name?.charAt(0) ?? 'U'}</div>
                  )}
                </div>
                <div className="profile-summary-info">
                  <h2>{user?.name || 'Your Name'}</h2>
                  <p className="profile-meta">@{user?.username || 'username'}</p>
                </div>
              </div>

              <div className="profile-summary-grid">
                <div className="info-row">
                  <span>Email</span>
                  <strong>{user?.email || 'N/A'}</strong>
                </div>
                <div className="info-row">
                  <span>Provider</span>
                  <strong>{providerLabel}</strong>
                </div>
                <div className="info-row">
                  <span>Verification</span>
                  <strong>
                    <span className={`status-badge ${user?.isVerified ? 'verified' : 'unverified'}`}>
                      {verificationLabel}
                    </span>
                  </strong>
                </div>
                <div className="info-row">
                  <span>Created</span>
                  <strong>{formatDate(user?.createdAt)}</strong>
                </div>
                <div className="info-row">
                  <span>Last login</span>
                  <strong>{formatDate(user?.lastLogin)}</strong>
                </div>
                <div className="info-row bio-row">
                  <span>Bio</span>
                  <strong>{user?.bio || 'No bio yet. Add a short description about yourself.'}</strong>
                </div>
              </div>

              {!user?.isVerified && (
                <div className="verification-actions">
                  <button type="button" className="secondary-btn" onClick={handleResendVerification}>
                    Verify Email
                  </button>
                  <p className="verification-hint">Check your inbox after requesting a new verification email.</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="profile-avatar-preview">
                <label className="file-picker">
                  {profileImage ? 'Change photo' : 'Upload new photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  rows="4"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="email" value={user?.email || ''} disabled />
              </div>

              <div className="verification-status">
                <span>{user?.isVerified ? 'Email verified' : 'Email not verified'}</span>
                {!user?.isVerified && (
                  <button type="button" className="secondary-btn" onClick={handleResendVerification}>
                    Resend verification
                  </button>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? <span className="loading-spinner"></span> : 'Save profile'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
