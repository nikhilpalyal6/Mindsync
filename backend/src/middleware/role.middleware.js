import ApiError from '../utils/ApiError.js';
import { ROLE_HIERARCHY } from '../constants/roles.js';

/**
 * Restricts route access to specified roles.
 * Uses role hierarchy — higher roles inherit lower role permissions.
 *
 * @param {...string} allowedRoles - Roles permitted to access the route
 */
export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;

  const hasPermission = allowedRoles.some((role) => {
    const requiredLevel = ROLE_HIERARCHY[role] || 0;
    return userRoleLevel >= requiredLevel;
  });

  if (!hasPermission) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }

  next();
};

export default authorize;
