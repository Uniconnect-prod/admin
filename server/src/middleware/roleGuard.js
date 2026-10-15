export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required.' });
    }
    if (req.user.isSuperAdmin) return next();
    if (!req.platformRole || !allowedRoles.includes(req.platformRole)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_ROLE_PERMISSIONS',
        message: `This action requires one of: ${allowedRoles.join(', ')}.`
      });
    }
    return next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ success: false, code: 'SUPER_ADMIN_REQUIRED', message: 'This action requires Super Admin privileges.' });
  }
  return next();
}

/**
 * Allows Super Admins, or users holding one of the roles on ANY currently active platform.
 * Used for non-platform-scoped admin pages (e.g. read-only user list for Platform Admins).
 */
export function requireAnyPlatformRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.user?.isSuperAdmin) return next();
    const ok = (req.user?.access || []).some(a => a.isCurrentlyActive && allowedRoles.includes(a.role_name));
    if (!ok) {
      return res.status(403).json({ success: false, code: 'INSUFFICIENT_ROLE_PERMISSIONS', message: 'You do not have permission to view this page.' });
    }
    return next();
  };
}
