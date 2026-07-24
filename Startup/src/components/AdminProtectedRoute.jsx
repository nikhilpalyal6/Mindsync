
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

export const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
  const adminLevel = ROLE_HIERARCHY[ROLES.ADMIN];

  if (userRoleLevel < adminLevel) {
    return <Navigate to="/study" replace />;
  }

  return children;
};
