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
              <button type="button" className="profile-button" onClick={() => setIsDropdownOpen((prev) => !prev)} aria-haspopup="true" aria-expanded={isDropdownOpen}>
                <span className="profile-avatar">
                  {user.profileImage || user.avatar ? (
                    <img src={user.profileImage || user.avatar} alt={user.name || user.username} />
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
                <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                  <div className="dropdown-header">
                    <div className="dropdown-avatar">
                      {user.profileImage || user.avatar ? (
                        <img src={user.profileImage || user.avatar} alt={user.name || user.username} />
                      ) : (
                        <span>{(user.name || user.username || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-name">{user.name || user.username}</div>
                      <div className="dropdown-user-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="dropdown-badge">Free Plan</div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-items">
                    {/* Show Admin Dashboard link only for admins */}
                    {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                      <button type="button" className="dropdown-item" role="menuitem" onClick={() => { setIsDropdownOpen(false); navigate('/admin') }}>
                        <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                        </svg>
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    <button type="button" className="dropdown-item" role="menuitem" onClick={() => { setIsDropdownOpen(false); navigate('/profile') }}>
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>Profile</span>
                    </button>
                    <button type="button" className="dropdown-item" role="menuitem" onClick={() => { setIsDropdownOpen(false); navigate('/settings') }}>
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      <span>Settings</span>
                    </button>
                    <button type="button" className="dropdown-item" role="menuitem" onClick={() => { setIsDropdownOpen(false); navigate('/pricing') }}>
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>Upgrade Plan</span>
                    </button>
                    <button type="button" className="dropdown-item" role="menuitem">
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span>Notifications</span>
                    </button>
                    <button type="button" className="dropdown-item" role="menuitem">
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Help</span>
                    </button>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button type="button" className="dropdown-item dropdown-item-logout" role="menuitem" onClick={async () => { setIsDropdownOpen(false); await signOut(); navigate('/login') }}>
                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Logout</span>
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
