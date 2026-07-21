import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginComplete, user } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const hasVerified = useRef(false);

  const getFriendlyError = (errorMessage) => {
    const normalized = (errorMessage || '').toLowerCase();

    if (normalized.includes('expired') || normalized.includes('invalid')) {
      return 'This verification link is invalid or has expired. Please request a new verification email.';
    }

    if (normalized.includes('already')) {
      return 'This email has already been verified.';
    }

    return errorMessage || 'We could not verify your email right now.';
  };

  useEffect(() => {
    const verifyEmail = async () => {
      if (hasVerified.current) {
        return;
      }

      hasVerified.current = true;

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || 'Invalid or expired verification link');
        }

        if (user) {
          await loginComplete();
        }

        setStatus('success');
        setMessage('✓ Email Verified Successfully');

        window.setTimeout(() => {
          navigate(user ? '/study' : '/login');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setMessage(getFriendlyError(err.message));
      }
    };

    verifyEmail();
  }, [token, navigate, loginComplete, user]);

  const handleResend = async () => {
    if (!user) {
      setStatus('error');
      setMessage('Please log in to resend your verification email.');
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to resend verification email');
      }

      setStatus('success');
      setMessage('A fresh verification email has been sent. Please check your inbox.');
    } catch (err) {
      setStatus('error');
      setMessage(getFriendlyError(err.message));
    } finally {
      setIsResending(false);
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
            <div className="image-badge">MindSync</div>
            <h1>
              Email <span className="gradient-text">Verification</span>
            </h1>
            <p className="image-description">
              We are verifying your email address to keep your account secure.
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
              <h1>{status === 'loading' ? 'Verifying...' : status === 'success' ? 'Success!' : 'Verification Issue'}</h1>
              <p className="form-subtitle">{message}</p>
            </div>

            {status === 'loading' && (
              <div className="verification-state">
                <span className="loading-spinner" style={{ width: '32px', height: '32px' }}></span>
                <p>Please wait while we verify your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="status-card success">
                <div className="status-icon">✓</div>
                <div>
                  <h3>Email Verified</h3>
                  <p>{message}</p>
                  <p className="status-subtext">Redirecting you to your dashboard shortly.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="verification-actions">
                <div className="status-card error">
                  <div className="status-icon">!</div>
                  <div>
                    <h3>Verification Failed</h3>
                    <p>{message}</p>
                  </div>
                </div>
                <button type="button" className="submit-btn" onClick={handleResend} disabled={isResending}>
                  {isResending ? <span className="loading-spinner"></span> : 'Resend Verification Email'}
                </button>
                {!user && (
                  <Link to="/login" className="secondary-link">
                    Go to Login
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
