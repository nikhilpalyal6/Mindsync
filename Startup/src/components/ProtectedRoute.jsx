import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const protectedStudyArea = location.pathname.startsWith('/study')

  if (!user.isVerified && protectedStudyArea) {
    return <Navigate to="/profile" state={{ from: location }} replace />
  }

  return children
}
