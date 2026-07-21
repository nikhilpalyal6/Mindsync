import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './navbar.css'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

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

      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isMenuOpen, isDropdownOpen])

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
          {user ? (
            <div className="profile-menu" ref={dropdownRef}>
              <button type="button" className="profile-button" onClick={() => setIsDropdownOpen((prev) => !prev)}>
                <span className="profile-avatar">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name || user.username} />
                  ) : (
                    <span>{(user.name || user.username || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="profile-name">{user.name || user.username}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="profile-chevron">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="profile-dropdown">
                  <button type="button" onClick={() => { setIsDropdownOpen(false); navigate('/profile') }}>
                    Profile
                  </button>
                  <button type="button" onClick={() => { setIsDropdownOpen(false); navigate('/settings') }}>
                    Settings
                  </button>
                  <button type="button" className="logout-action" onClick={async () => { setIsDropdownOpen(false); await signOut(); navigate('/login') }}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link className="login" to="/login">Login</Link>
              <Link className="cta" to="/study">Start Free</Link>
            </>
          )}
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
          {user ? (
            <>
              <Link onClick={() => setIsMenuOpen(false)} className="login" to="/profile">{user.name || user.username}</Link>
              <Link onClick={() => setIsMenuOpen(false)} className="login" to="/settings">Settings</Link>
              <button
                type="button"
                className="cta"
                onClick={async () => {
                  setIsMenuOpen(false)
                  await signOut()
                  navigate('/login')
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link onClick={() => setIsMenuOpen(false)} className="login" to="/login">Login</Link>
              <Link onClick={() => setIsMenuOpen(false)} className="cta" to="/study">Start Free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
