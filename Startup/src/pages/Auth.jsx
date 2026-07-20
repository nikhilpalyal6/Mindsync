import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import AOS from 'aos'
import 'aos/dist/aos.css'
import './auth.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

export default function Auth() {
  const location = useLocation()
  const navigate = useNavigate()
  const isSignup = location.pathname === '/signup'
  
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    agreeToTerms: false
  })

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
    })
  }, [])

  useEffect(() => {
    // Reset form when switching between login/signup
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      agreeToTerms: false
    })
    setIsLoading(false)
    setError('')
  }, [isSignup])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      let url, body

      if (isSignup) {
        url = `${API_BASE_URL}/auth/register`
        body = {
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password
        }
      } else {
        url = `${API_BASE_URL}/auth/login`
        body = {
          identifier: formData.email,
          password: formData.password
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong')
      }

      if (isSignup) {
        alert('Account created successfully! Please log in.')
        navigate('/login')
      } else {
        navigate('/study')
      }
    } catch (err) {
      console.error('[Auth] Error:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        setIsLoading(true)
        setError('')
        const response = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ code: codeResponse.code })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Google login failed')
        }

        navigate('/study')
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    },
    onError: (error) => {
      console.error('Google login error:', error)
      setError('Google login failed')
    },
    flow: 'auth-code'
  })

  return (
    <div className="auth-page">
      <div className="auth-background-effects">
        <div className="bg-particle p1"></div>
        <div className="bg-particle p2"></div>
        <div className="bg-particle p3"></div>
      </div>

      <div className="auth-card" data-aos="fade-up">
        {/* Left Image Section */}
        <div className="auth-image" data-aos="fade-right" data-aos-delay="100">
          <div className="image-content">
            <div className="image-badge">
              <span>Welcome to MindSync</span>
            </div>
            <h1>
              Learn Smarter.<br />
              Focus Better.<br />
              <span className="gradient-text">Remember Longer</span>
            </h1>
            <p className="image-description">
              Transform your learning experience with AI-powered tools designed to help you study more effectively.
            </p>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="auth-form-container" data-aos="fade-left" data-aos-delay="200">
          {/* Header */}
          <div className="auth-header">
            <Link to="/" className="auth-logo-link">
              <img src="/logo.png" alt="MindSync" className="auth-logo" />
            </Link>
            <Link to="/" className="back-link">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </Link>
          </div>

          <div className="auth-form-content">
            <div className="form-header">
              <h1>{isSignup ? 'Create an account' : 'Welcome back'}</h1>
              <p className="form-subtitle">
                {isSignup 
                  ? 'Start your learning journey today' 
                  : 'Sign in to continue your learning journey'}
              </p>
            </div>
            
            {isSignup ? (
              <div className="switch-auth">
                Already have an account? <Link to="/login">Sign in</Link>
              </div>
            ) : (
              <div className="switch-auth">
                Don't have an account? <Link to="/signup">Sign up for free</Link>
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="auth-form">
              {isSignup && (
                <>
                  <div className="form-group">
                    <label htmlFor="name">Full name</label>
                    <input
                      type="text"
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                      type="text"
                      id="username"
                      placeholder="johndoe"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  {isSignup ? 'Password' : 'Password'}
                  {isSignup && (
                    <span className="password-hint">(min. 8 characters)</span>
                  )}
                </label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder={isSignup ? "Create a strong password" : "Enter your password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {!isSignup && (
                <div className="form-options">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="forgot-password">
                    Forgot password?
                  </Link>
                </div>
              )}

              {isSignup && (
                <div className="terms-check">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.agreeToTerms}
                      onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                      required
                    />
                    <span>
                      I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
                    </span>
                  </label>
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{isSignup ? 'Create account' : 'Sign in'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.75 12h16.5m0 0L12 3.75M20.25 12 12 20.25" />
                    </svg>
                  </>
                )}
              </button>

              <div className="social-divider">
                <span>Or continue with</span>
              </div>

              <div className="social-buttons">
                <button type="button" className="social-btn" onClick={() => handleGoogleLogin()}>
                  <img src="/google-icon.svg" alt="Google" />
                  <span>Google</span>
                </button>
                <button type="button" className="social-btn">
                  <img src="/apple-icon.svg" alt="Apple" />
                  <span>Apple</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
