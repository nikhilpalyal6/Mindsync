import React from 'react';

export const UserAvatar = React.memo(({ user, size = 'sm' }) => {
  const sizeClasses = {
    sm: { width: '32px', height: '32px', fontSize: '0.8rem' },
    md: { width: '40px', height: '40px', fontSize: '0.95rem' },
    lg: { width: '96px', height: '96px', fontSize: '2.25rem' }
  };

  const currentSize = sizeClasses[size] || sizeClasses.sm;

  if (user?.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.name || 'User avatar'}
        style={{
          width: currentSize.width,
          height: currentSize.height,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid var(--admin-border)'
        }}
      />
    );
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : user?.username
      ? user.username.substring(0, 2).toUpperCase()
      : 'U';

  return (
    <div
      className="admin-avatar"
      style={{
        width: currentSize.width,
        height: currentSize.height,
        fontSize: currentSize.fontSize,
        border: size === 'lg' ? '4px solid var(--admin-border)' : '1.5px solid var(--admin-border)',
        flexShrink: 0
      }}
    >
      {initials}
    </div>
  );
});

UserAvatar.displayName = 'UserAvatar';
export default UserAvatar;
