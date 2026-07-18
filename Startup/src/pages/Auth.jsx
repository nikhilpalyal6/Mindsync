import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import './auth.css'

export default function Auth() {
  const location = useLocation()
  const isSignup = location.pathname === '/signup'
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      agreeToTerms: false
    })
    setIsLoading(false)
  }, [isSignup])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate form submission
    setTimeout(() => {
      console.log('Form submitted:', formData)
      setIsLoading(false)
      // Add your actual form submission logic here
    }, 2000)
  }

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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7a1 1 0 010 1.414l-7 7a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586L9.293 3.707a1 1 0 010-1.414z" clipRule="evenodd" />
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

            <form onSubmit={handleSubmit} className="auth-form">
              {isSignup && (
                <div className="name-fields">
                  <div className="form-group">
                    <label htmlFor="firstName">First name</label>
                    <input
                      type="text"
                      id="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last name</label>
                    <input
                      type="text"
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638l-2.081-2.47a.75.75 0 111.146-.966l3.5 4.25a.75.75 0 010 .966l-3.5 4.25a.75.75 0 11-1.146-.966l2.081-2.47H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>

              <div className="social-divider">
                <span>Or continue with</span>
              </div>

              <div className="social-buttons">
                <button type="button" className="social-btn google">
                  <img src="/google-icon.svg" alt="Google" />
                  <span>Google</span>
                </button>
                <button type="button" className="social-btn apple">
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
