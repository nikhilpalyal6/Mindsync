import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './navbar.css'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial scroll position
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (isMenuOpen && !e.target.closest('.mobile-nav') && !e.target.closest('.mobile-menu-btn')) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isMenuOpen])

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <nav className={`site-navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        <div className="brand">
          <div className="brand-logo" aria-hidden>
            <img src="/logo.png" alt="MindSync Logo" className="logo-icon" />
          </div>
          <span className="brand-name">
            <span className="brand-left">Mind</span>
            <span className="brand-right">Sync</span>
          </span>
        </div>

        <ul className="nav-links">
          <li>
            <Link 
              className={location.pathname === '/' ? 'active' : ''} 
              to="/"
            >
              Home
            </Link>
          </li>
          <li>
            <Link 
              className={location.pathname === '/study' ? 'active' : ''} 
              to="/study"
            >
              Study Mode
            </Link>
          </li>
          <li>
            <Link 
              className={location.pathname === '/pricing' ? 'active' : ''} 
              to="/pricing"
            >
              Pricing
            </Link>
          </li>
          <li>
            <Link 
              className={location.pathname === '/about' ? 'active' : ''} 
              to="/about"
            >
              Community
            </Link>
          </li>
          <li>
            <Link 
              className={location.pathname === '/contact' ? 'active' : ''} 
              to="/contact"
            >
              Contact
            </Link>
          </li>
        </ul>

        <div className="nav-actions">
          <Link className="login" to="/login">Login</Link>
          <Link className="cta" to="/study">Start Free</Link>
        </div>

        <button 
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle mobile menu"
        >
          {isMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      <div className={`mobile-nav ${isMenuOpen ? 'active' : ''}`}>
        <ul className="nav-links">
          <li>
            <Link 
              onClick={() => setIsMenuOpen(false)} 
              className={location.pathname === '/' ? 'active' : ''} 
              to="/"
            >
              Home
            </Link>
          </li>
          <li>
            <Link 
              onClick={() => setIsMenuOpen(false)} 
              className={location.pathname === '/study' ? 'active' : ''} 
              to="/study"
            >
              Study Mode
            </Link>
          </li>
          <li>
            <Link 
              onClick={() => setIsMenuOpen(false)} 
              className={location.pathname === '/pricing' ? 'active' : ''} 
              to="/pricing"
            >
              Pricing
            </Link>
          </li>
          <li>
            <Link 
              onClick={() => setIsMenuOpen(false)} 
              className={location.pathname === '/about' ? 'active' : ''} 
              to="/about"
            >
              Community
            </Link>
          </li>
          <li>
            <Link 
              onClick={() => setIsMenuOpen(false)} 
              className={location.pathname === '/contact' ? 'active' : ''} 
              to="/contact"
            >
              Contact
            </Link>
          </li>
        </ul>
        <div className="nav-actions">
          <Link onClick={() => setIsMenuOpen(false)} className="login" to="/login">Login</Link>
          <Link onClick={() => setIsMenuOpen(false)} className="cta" to="/study">Start Free</Link>
        </div>
      </div>
    </nav>
  )
}
