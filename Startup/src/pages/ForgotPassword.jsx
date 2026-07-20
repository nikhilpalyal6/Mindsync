import { useState } from 'react';
import { Link } from 'react-router-dom';
import './auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setMessage('Password reset link sent to your email!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="image-badge" data-aos="fade-down">
              MindSync
            </div>
            <h1 data-aos="fade-up" data-aos-delay="200">
              Reset Your <span className="gradient-text">Password</span>
            </h1>
            <p className="image-description" data-aos="fade-up" data-aos-delay="400">
              Don't worry! Enter your email and we'll send you a link to reset your password.
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
              <h1>Forgot Password</h1>
              <p className="form-subtitle">Enter your email to receive a reset link</p>
            </div>

            {message && (
              <div style={{ 
                color: '#48efb3', 
                background: 'rgba(72, 200, 147, 0.1)', 
                border: '1px solid rgba(72, 200, 147, 0.2)', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                marginBottom: '24px', 
                textAlign: 'center' 
              }}>
                {message}
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || !!message}
                />
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={isLoading || !!message}
              >
                {isLoading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
