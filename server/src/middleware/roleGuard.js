import { db } from '../models/db.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Authentication required.' });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const currentRole = req.platformRole;
    if (!currentRole || !allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_ROLE_PERMISSIONS',
        message: `Forbidden: Action requires one of [${allowedRoles.join(', ')}]. Your platform role is '${currentRole || 'None'}'.`
      });
    }

    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_REQUIRED',
      message: 'Forbidden: This action requires Super Admin system privileges.'
    });
  }
  next();
}

