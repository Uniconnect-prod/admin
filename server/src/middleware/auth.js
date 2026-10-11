import { verifyAccessToken } from '../utils/token.js';
import { db } from '../models/db.js';
import { determineAccessStatus } from '../utils/platformAccessHelper.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please refresh session.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid access token.'
      });
    }

    // Lookup user in database
    const user = await db.get(
      `SELECT id, name, email, username, status, last_login_at 
       FROM users WHERE id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.'
      });
    }

    // Get user platform assignments from platform_access (fallback to user_platforms if no platform_access yet)
    let rawAccess = await db.all(
      `SELECT pa.id, pa.platform_id, p.code as platform_code, p.name as platform_name,
              p.logo_url, p.enabled_modules, pa.role_id, r.name as role_name,
              pa.start_date, pa.end_date, pa.status
       FROM platform_access pa
       JOIN platforms p ON pa.platform_id = p.id
       JOIN roles r ON pa.role_id = r.id
       WHERE pa.user_id = ? AND p.status = 'ACTIVE'`,
      [user.id]
    );

    // If no platform_access records yet, fallback to user_platforms with active default window
    if (!rawAccess || rawAccess.length === 0) {
      const fallback = await db.all(
        `SELECT up.id, up.platform_id, p.code as platform_code, p.name as platform_name,
                p.logo_url, p.enabled_modules, up.role_id, r.name as role_name,
                DATETIME('now', '-30 days') as start_date,
                DATETIME('now', '+365 days') as end_date,
                'ACTIVE' as status
         FROM user_platforms up
         JOIN platforms p ON up.platform_id = p.id
         JOIN roles r ON up.role_id = r.id
         WHERE up.user_id = ? AND p.status = 'ACTIVE'`,
        [user.id]
      );
      rawAccess = fallback || [];
    }

    // Evaluate real-time authorization state for each platform
    const now = new Date();
    const evaluatedPlatforms = rawAccess.map(p => {
      let modules = [];
      try { modules = JSON.parse(p.enabled_modules || '[]'); } catch { modules = []; }

      const evalResult = determineAccessStatus(p, now);

      return {
        id: p.id,
        platform_id: p.platform_id,
        platform_code: p.platform_code,
        platform_name: p.platform_name,
        logo_url: p.logo_url,
        enabled_modules: modules,
        role_id: p.role_id,
        role_name: p.role_name,
        start_date: p.start_date,
        end_date: p.end_date,
        configured_status: p.status,
        status: evalResult.status, // ACTIVE, UPCOMING, EXPIRED, REVOKED
        isCurrentlyActive: evalResult.isCurrentlyActive,
        isExpiringSoon: evalResult.isExpiringSoon || false,
        daysUntilExpiry: evalResult.daysUntilExpiry ?? null,
        reason: evalResult.reason
      };
    });

    // Check if user is Super Admin or root user (id=1)
    const isSuperAdmin = user.id === 1 || evaluatedPlatforms.some(p => p.role_name === 'Super Admin' && p.isCurrentlyActive);

    req.user = {
      ...user,
      isSuperAdmin,
      allPlatformAccess: evaluatedPlatforms,
      // platforms lists only currently ACTIVE authorized platforms
      platforms: evaluatedPlatforms.filter(p => p.isCurrentlyActive || isSuperAdmin)
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
}


