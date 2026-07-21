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
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const checkPasswordStrength = (password) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?\":{}|<>]/.test(password),
    };
    const passedChecks = Object.values(checks).filter(Boolean).length;

    return {
      checks,
      strength: passedChecks < 2 ? 'weak' : passedChecks < 4 ? 'medium' : 'strong',
      isValid: Object.values(checks).every(Boolean),
    };
  };

  const strength = checkPasswordStrength(newPassword);

  const getFriendlyError = (errorMessage) => {
    const normalized = (errorMessage || '').toLowerCase();

    if (normalized.includes('already') || normalized.includes('used')) {
      return 'This reset link has already been used. Please request a new password reset link.';
    }

    if (normalized.includes('expired') || normalized.includes('invalid')) {
      return 'This reset link is invalid or has expired. Please request a new password reset link.';
    }

    return errorMessage || 'Unable to update your password right now.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    if (!token) {
      setStatus('error');
      setMessage('This reset link is invalid. Please request a new one.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (!strength.isValid) {
      setStatus('error');
      setMessage('Password must include at least 8 characters, uppercase, lowercase, a number, and a special character.');
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
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setStatus('success');
      setMessage('Password updated successfully.');
      window.setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(getFriendlyError(err.message));
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

            {status === 'success' && (
              <div className="status-card success">
                <div className="status-icon">✓</div>
                <div>
                  <h3>Password Updated</h3>
                  <p>{message}</p>
                  <p className="status-subtext">Redirecting to login in a moment.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="status-card error">
                <div className="status-icon">!</div>
                <div>
                  <h3>Unable to update password</h3>
                  <p>{message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password <span className="password-hint">(min 8 chars)</span></label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading || status === 'success'}
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

                {newPassword && (
                  <div className="password-strength-card">
                    <div className="password-strength-meta">
                      <span>Password Strength</span>
                      <span className={`strength-badge ${strength.strength}`}>{strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}</span>
                    </div>
                    <div className="strength-meter">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <div
                          key={bar}
                          className={`strength-bar ${bar <= Object.values(strength.checks).filter(Boolean).length ? strength.strength : ''}`}
                        />
                      ))}
                    </div>
                    <div className="validation-list">
                      {Object.entries(strength.checks).map(([key, valid]) => (
                        <div key={key} className={`validation-item ${valid ? 'valid' : 'invalid'}`}>
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

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading || status === 'success'}
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
                  <div className="validation-item invalid" style={{ marginTop: '8px' }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading || status === 'success'}>
                {isLoading ? <span className="loading-spinner"></span> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
