import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  FaTwitter, 
  FaLinkedin, 
  FaGithub, 
  FaYoutube, 
  FaDiscord,
  FaEnvelope,
  FaArrowRight,
  FaCheckCircle
} from 'react-icons/fa'
import './footer.css'

export default function Footer(){
  const [status, setStatus] = useState('idle')
  const [email, setEmail] = useState('')

  function handleSubmit(e){
    e.preventDefault()
    const emailValue = email.trim()
    if(!emailValue) return
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if(!emailRegex.test(emailValue)) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
      return
    }

    setStatus('sending')
    // Simulate API call
    setTimeout(()=>{
      setStatus('sent')
      setEmail('')
      setTimeout(()=> setStatus('idle'), 3000)
    }, 1200)
  }

  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="footer-background"></div>
      
      <div className="footer-inner">
        {/* Brand Section */}
        <div className="footer-brand">
          <div className="brand-header">
            <div className="logo">
              <span className="logo-text">Mind</span>
              <span className="logo-accent">Sync</span>
              <span className="logo-dot">.</span>
            </div>
            <p className="brand-tagline">AI-Powered Learning Platform</p>
          </div>
          
          <p className="brand-desc">
            Transform your learning experience with AI-driven summaries, smart flashcards, 
            focus tools, and comprehensive progress tracking. Study smarter, not harder.
          </p>
          
          <div className="socials">
            <a 
              href="https://twitter.com/mindsync" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Follow us on Twitter"
              className="social-link"
            >
              <FaTwitter />
            </a>
            <a 
              href="https://linkedin.com/company/mindsync" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Connect on LinkedIn"
              className="social-link"
            >
              <FaLinkedin />
            </a>
            <a 
              href="https://github.com/mindsync" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="social-link"
            >
              <FaGithub />
            </a>
            <a 
              href="https://youtube.com/@mindsync" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Watch on YouTube"
              className="social-link"
            >
              <FaYoutube />
            </a>
            <a 
              href="https://discord.gg/mindsync" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Join Discord Community"
              className="social-link"
            >
              <FaDiscord />
            </a>
          </div>
        </div>

        {/* Product Links */}
        <div className="footer-links">
          <h4 className="links-title">Product</h4>
          <ul className="links-list">
            <li>
              <Link to="/#features" className="footer-link">Features</Link>
            </li>
            <li>
              <Link to="/#how-it-works" className="footer-link">How It Works</Link>
            </li>
            <li>
              <Link to="/pricing" className="footer-link">Pricing</Link>
            </li>
            <li>
              <Link to="/study" className="footer-link">Study Mode</Link>
            </li>
            <li>
              <Link to="/#demo" className="footer-link">Demo</Link>
            </li>
          </ul>
        </div>

        {/* Company Links */}
        <div className="footer-links">
          <h4 className="links-title">Company</h4>
          <ul className="links-list">
            <li>
              <Link to="/about" className="footer-link">About Us</Link>
            </li>
            <li>
              <Link to="/contact" className="footer-link">Contact</Link>
            </li>
            <li>
              <a href="https://blog.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Blog</a>
            </li>
            <li>
              <a href="https://careers.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Careers</a>
            </li>
            <li>
              <a href="https://status.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Status</a>
            </li>
          </ul>
        </div>

        {/* Resources Links */}
        <div className="footer-links">
          <h4 className="links-title">Resources</h4>
          <ul className="links-list">
            <li>
              <a href="https://docs.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Documentation</a>
            </li>
            <li>
              <a href="https://help.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Help Center</a>
            </li>
            <li>
              <a href="https://community.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Community</a>
            </li>
            <li>
              <a href="https://api.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">API</a>
            </li>
            <li>
              <a href="https://changelog.mindsync.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Changelog</a>
            </li>
          </ul>
        </div>

        {/* Newsletter Section */}
        <div className="footer-newsletter">
          <h4 className="newsletter-title">Stay Updated</h4>
          <p className="newsletter-desc">
            Get the latest updates, tips, and exclusive offers delivered to your inbox.
          </p>

          <form className="subscribe-form" onSubmit={handleSubmit} aria-label="Subscribe to newsletter">
            <div className="input-group">
              <div className="input-wrapper">
                <FaEnvelope className="input-icon" />
                <input 
                  id="footer-email" 
                  name="email" 
                  type="email" 
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className={status === 'error' ? 'error' : ''}
                />
              </div>
              <button 
                type="submit" 
                className={`subscribe-btn ${status}`}
                disabled={status === 'sending' || status === 'sent'}
                aria-label="Subscribe to newsletter"
              >
                {status === 'sending' ? (
                  <span className="btn-spinner"></span>
                ) : status === 'sent' ? (
                  <>
                    <FaCheckCircle className="btn-icon" />
                    <span>Subscribed!</span>
                  </>
                ) : (
                  <>
                    <span>Subscribe</span>
                    <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
            </div>
            {status === 'error' && (
              <p className="error-message">Please enter a valid email address</p>
            )}
            {status === 'sent' && (
              <p className="success-message">Thank you for subscribing!</p>
            )}
          </form>

          <p className="newsletter-note">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <div className="bottom-inner">
          <div className="bottom-left">
            <p className="copyright">
              © {currentYear} <span className="brand-name">MindSync</span>. All rights reserved.
            </p>
          </div>
          
          <div className="bottom-right">
            <div className="legal-links">
              <a href="/privacy" className="legal-link">Privacy Policy</a>
              <span className="separator">•</span>
              <a href="/terms" className="legal-link">Terms of Service</a>
              <span className="separator">•</span>
              <a href="/cookies" className="legal-link">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
