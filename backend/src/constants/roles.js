export const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
});

export const DEFAULT_ROLE = ROLES.USER;

export const ALL_ROLES = Object.values(ROLES);
