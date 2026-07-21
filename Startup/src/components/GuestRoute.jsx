import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const allowedForAuthenticated = ['/verify-email', '/reset-password', '/forgot-password']

export default function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  const pathname = location.pathname
  const isAllowedPath = allowedForAuthenticated.some((path) => pathname.startsWith(path))

  if (user && !isAllowedPath) {
    return <Navigate to="/study" replace />
  }

  return children
}
