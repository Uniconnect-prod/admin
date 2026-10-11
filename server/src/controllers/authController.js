import bcrypt from 'bcryptjs';
import { db } from '../models/db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.js';
import { logAudit } from '../middleware/auditLogger.js';
import { determineAccessStatus, formatAccessRecord } from '../utils/platformAccessHelper.js';

export const authController = {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username/Email and password are required.'
        });
      }

      // Find user by username or email
      const user = await db.get(
        `SELECT id, name, email, username, password_hash, status, last_login_at 
         FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND deleted_at IS NULL`,
        [username.trim(), username.trim()]
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. User does not exist.'
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'This account has been disabled. Please contact the administrator.'
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Password incorrect.'
        });
      }

      // 1. Fetch user's date-wise platform assignments from platform_access
      let rawAccess = await db.all(
        `SELECT pa.id, pa.platform_id, p.code as platform_code, p.name as platform_name,
                p.logo_url, p.country as platform_country, p.enabled_modules, pa.role_id, r.name as role_name,
                pa.start_date, pa.end_date, pa.status
         FROM platform_access pa
         JOIN platforms p ON pa.platform_id = p.id
         JOIN roles r ON pa.role_id = r.id
         WHERE pa.user_id = ? AND p.status = 'ACTIVE'`,
        [user.id]
      );

      // Fallback to user_platforms if platform_access hasn't been migrated for this user
      if (!rawAccess || rawAccess.length === 0) {
        const fallback = await db.all(
          `SELECT up.id, up.platform_id, p.code as platform_code, p.name as platform_name,
                  p.logo_url, p.country as platform_country, p.enabled_modules, up.role_id, r.name as role_name,
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

      // 2. Real-time Date & Status Evaluation
      const now = new Date();
      const evaluatedAssignments = rawAccess.map(p => {
        let modules = [];
        try { modules = JSON.parse(p.enabled_modules || '[]'); } catch { modules = []; }
        const evalResult = determineAccessStatus(p, now);

        return {
          id: p.id,
          platform_id: p.platform_id,
          code: p.platform_code,
          name: p.platform_name,
          logo_url: p.logo_url,
          country: p.platform_country || p.country || 'Ghana',
          enabled_modules: modules,
          role_id: p.role_id,
          role: p.role_name,
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

      // Check if user has active Super Admin role or is root user (id=1)
      const isSuperAdmin = user.id === 1 || evaluatedAssignments.some(p => p.role === 'Super Admin' && p.isCurrentlyActive);

      // Filter to currently ACTIVE authorized platforms only
      const activePlatforms = evaluatedAssignments.filter(p => p.isCurrentlyActive);

      // 3. Handle Edge Cases explicitly as required in Section 16
      // Case A: User has no platform assignments at all
      if (rawAccess.length === 0 && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          code: 'NO_PLATFORMS_ASSIGNED',
          message: 'Access Denied: Your account has no digital platforms assigned. Please contact an administrator.'
        });
      }

      // Case B: User has platform assignments, but ZERO currently active platforms
      if (!isSuperAdmin && activePlatforms.length === 0) {
        // Inspect reasons (all expired vs all upcoming vs revoked)
        const allExpired = evaluatedAssignments.every(p => p.status === 'EXPIRED');
        const allUpcoming = evaluatedAssignments.every(p => p.status === 'UPCOMING');
        const allRevoked = evaluatedAssignments.every(p => p.status === 'REVOKED');

        if (allExpired) {
          const lastEnd = evaluatedAssignments[0]?.end_date;
          return res.status(403).json({
            success: false,
            code: 'PLATFORM_ACCESS_EXPIRED',
            message: `Platform Access Expired: Your authorization ended on ${lastEnd}. Please contact an administrator to extend your access period.`
          });
        }

        if (allUpcoming) {
          const nextStart = evaluatedAssignments[0]?.start_date;
          return res.status(403).json({
            success: false,
            code: 'PLATFORM_ACCESS_UPCOMING',
            message: `Platform Access Upcoming: Your access is scheduled to begin on ${nextStart}. Access is not yet active.`
          });
        }

        if (allRevoked) {
          return res.status(403).json({
            success: false,
            code: 'PLATFORM_ACCESS_REVOKED',
            message: 'Platform Access Revoked: Your access has been revoked by an administrator.'
          });
        }

        return res.status(403).json({
          success: false,
          code: 'PLATFORM_ACCESS_DENIED',
          message: 'Access Denied: No active authorized platforms found for your account at this time.'
        });
      }

      // 4. Determine Active Platform & Role
      let activePlatformInfo = null;
      let activeRole = 'Viewer';

      if (isSuperAdmin) {
        activePlatformInfo = { id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true };
        activeRole = 'Super Admin';
      } else {
        // Default to first currently active authorized platform
        const primary = activePlatforms[0];
        activePlatformInfo = {
          id: primary.platform_id,
          code: primary.code,
          name: primary.name,
          logo_url: primary.logo_url,
          country: primary.country || 'Ghana',
          enabled_modules: primary.enabled_modules,
          startDate: primary.start_date,
          endDate: primary.end_date,
          isExpiringSoon: primary.isExpiringSoon,
          daysUntilExpiry: primary.daysUntilExpiry
        };
        activeRole = primary.role;
      }

      // Generate Tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        isSuperAdmin
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Update last login
      await db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      // Log Audit
      await logAudit(
        { user: { id: user.id }, activePlatform: activePlatformInfo, ip: req.ip },
        'USER_LOGIN',
        'Auth',
        user.id,
        { platform: activePlatformInfo?.code, username: user.username, activeCount: activePlatforms.length }
      );

      // If Super Admin, expose all platforms in switcher
      let availablePlatforms = activePlatforms;
      if (isSuperAdmin) {
        const allDbPlatforms = await db.all('SELECT * FROM platforms WHERE status = "ACTIVE"');
        availablePlatforms = allDbPlatforms.map(p => {
          let modules = [];
          try { modules = JSON.parse(p.enabled_modules || '[]'); } catch { modules = []; }
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            logo_url: p.logo_url,
            country: p.country || 'Ghana',
            role: 'Super Admin',
            enabled_modules: modules,
            status: 'ACTIVE',
            isCurrentlyActive: true
          };
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        data: {
          token: accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            country: user.country || 'Ghana',
            isSuperAdmin,
            activeRole
          },
          activePlatform: activePlatformInfo,
          availablePlatforms
        }
      });
    } catch (err) {
      console.error('[Auth Controller] Login Error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error during login.' });
    }
  },

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token required.' });
      }

      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
      }

      const user = await db.get('SELECT id, email, username, status FROM users WHERE id = ? AND deleted_at IS NULL', [decoded.userId]);
      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({ success: false, message: 'User deactivated or not found.' });
      }

      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        username: user.username,
        isSuperAdmin: decoded.isSuperAdmin
      });

      return res.status(200).json({
        success: true,
        data: {
          token: newAccessToken
        }
      });
    } catch (err) {
      console.error('[Auth Controller] Refresh Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to refresh token.' });
    }
  },

  async logout(req, res) {
    if (req.user) {
      await logAudit(req, 'USER_LOGOUT', 'Auth', req.user.id, { username: req.user.username });
    }
    return res.status(200).json({ success: true, message: 'Successfully logged out.' });
  },

  async me(req, res) {
    try {
      const user = req.user;
      let availablePlatforms = user.platforms.map(p => ({
        id: p.platform_id,
        code: p.platform_code,
        name: p.platform_name,
        role: p.role_name
      }));

      // Hardcode user 1 as super admin
      const isUserSuperAdmin = user.isSuperAdmin || user.id === 1;

      if (isUserSuperAdmin) {
        const allDbPlatforms = await db.all('SELECT * FROM platforms WHERE status = "ACTIVE"');
        availablePlatforms = allDbPlatforms.map(p => {
          let modules = [];
          try { modules = JSON.parse(p.enabled_modules || '[]'); } catch { modules = []; }
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            logo_url: p.logo_url,
            role: 'Super Admin',
            enabled_modules: modules
          };
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            isSuperAdmin: isUserSuperAdmin
          },
          availablePlatforms
        }
      });
    } catch (err) {
      console.error('[Auth Controller] Me Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
  }
};

