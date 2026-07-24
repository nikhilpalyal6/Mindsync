import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const allowedForAuthenticated = ['/verify-email', '/reset-password', '/forgot-password']
const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};
const ROLE_HIERARCHY = {
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
};

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
    const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
    const adminLevel = ROLE_HIERARCHY[ROLES.ADMIN];
    if (userRoleLevel >= adminLevel) {
      return <Navigate to="/admin" replace />
    }
    return <Navigate to="/study" replace />
  }

  return children
}
