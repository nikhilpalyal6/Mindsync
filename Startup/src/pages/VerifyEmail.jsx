import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import './auth.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

export default function VerifyEmail() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message || 'Invalid or expired verification link')
        }

        setStatus('success')
        setMessage('Email verified successfully!')
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } catch (err) {
        setStatus('error')
        setMessage(err.message)
      }
    }

    if (token) {
      verifyEmail()
    } else {
      setStatus('error')
      setMessage('Invalid verification link')
    }
  }, [token, navigate])

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
            <div className="image-badge">
              MindSync
            </div>
            <h1>
              Email <span className="gradient-text">Verification</span>
            </h1>
            <p className="image-description">
              We're verifying your email address to keep your account secure.
            </p>
          </div>
        </div>

        <div className="auth-form-container">
          <div className="auth-header">
            <Link to="/login" className="back-link">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Login
            </Link>
          </div>

          <div className="auth-form-content">
            <div className="form-header">
              <h1>
                {status === 'loading' ? 'Verifying...' : status === 'success' ? 'Success!' : 'Verification Failed'}
              </h1>
              <p className="form-subtitle">{message}</p>
            </div>

            {status === 'loading' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="loading-spinner" style={{ width: '32px', height: '32px' }}></span>
                <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Please wait while we verify your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div style={{ 
                color: '#48efb3', 
                background: 'rgba(72, 200, 147, 0.1)', 
                border: '1px solid rgba(72, 200, 147, 0.2)', 
                padding: '1rem', 
                borderRadius: '12px', 
                textAlign: 'center'
              }}>
                {message}
                <p style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>Redirecting to login...</p>
              </div>
            )}

            {status === 'error' && (
              <>
                <div className="error-message" style={{ marginBottom: '1.5rem' }}>
                  {message}
                </div>
                <Link 
                  to="/signup" 
                  className="submit-btn" 
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  Create New Account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
