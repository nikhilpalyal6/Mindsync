import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import './auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password strength checker
  const checkPasswordStrength = (password) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    return {
      checks,
      strength: passedChecks < 2 ? 'weak' : passedChecks < 4 ? 'medium' : 'strong',
      isValid: Object.values(checks).every(Boolean)
    };
  };

  const strength = checkPasswordStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!strength.isValid) {
      setError('Password must meet all requirements');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          newPassword, 
          confirmPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setSuccess('Password reset successful!');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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
              Create New <span className="gradient-text">Password</span>
            </h1>
            <p className="image-description" data-aos="fade-up" data-aos-delay="400">
              Choose a strong password to keep your account secure.
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
              <h1>Reset Password</h1>
              <p className="form-subtitle">Enter your new password below</p>
            </div>

            {success && (
              <div style={{ 
                color: '#48efb3', 
                background: 'rgba(72, 200, 147, 0.1)', 
                border: '1px solid rgba(72, 200, 147, 0.2)', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                marginBottom: '24px', 
                textAlign: 'center' 
              }}>
                {success}
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {/* New Password */}
              <div className="form-group">
                <label htmlFor="newPassword">New Password <span className="password-hint">(min 8 chars)</span></label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading || !!success}
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
                {/* Password Strength Indicator */}
                {newPassword && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '12px', 
                      marginBottom: '6px', 
                      color: 'var(--muted)' 
                    }}>
                      <span>Password Strength:</span>
                      <span style={{ 
                        color: strength.strength === 'weak' ? '#ef4444' : strength.strength === 'medium' ? '#f59e0b' : '#48efb3',
                        fontWeight: '600'
                      }}>
                        {strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '4px', 
                      marginBottom: '12px' 
                    }}>
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <div 
                          key={bar}
                          style={{ 
                            height: '4px', 
                            flex: 1, 
                            borderRadius: '2px',
                            background: bar <= Object.values(strength.checks).filter(Boolean).length 
                              ? (strength.strength === 'weak' ? '#ef4444' : strength.strength === 'medium' ? '#f59e0b' : '#48efb3')
                              : 'rgba(255, 255, 255, 0.1)'
                          }}
                        ></div>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {Object.entries(strength.checks).map(([key, valid]) => (
                        <div 
                          key={key}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            color: valid ? '#48efb3' : 'var(--muted)'
                          }}
                        >
                          <span>{valid ? '✓' : '○'}</span>
                          {key === 'length' && 'At least 8 characters'}
                          {key === 'uppercase' && 'Uppercase letter'}
                          {key === 'lowercase' && 'Lowercase letter'}
                          {key === 'number' && 'Number'}
                          {key === 'special' && 'Special character'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading || !!success}
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
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
                {confirmPassword && newPassword !== confirmPassword && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={isLoading || !!success}
              >
                {isLoading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
