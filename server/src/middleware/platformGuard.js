import { db } from '../models/db.js';
import { determineAccessStatus } from '../utils/platformAccessHelper.js';

export async function requirePlatform(req, res, next) {
  try {
    // Platform identifier from headers, params, query, or body
    const platformHeader = req.headers['x-platform-code'] || req.headers['x-platform-id'];
    const platformQuery = req.query.platform_code || req.query.platform_id;
    const platformParam = req.params.platformCode || req.params.platformId;
    const requestedPlatform = (platformHeader || platformQuery || platformParam || '').toString().trim();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before platform validation.'
      });
    }

    // Super Admin requesting "ALL" or cross-platform consolidated view
    if (requestedPlatform.toUpperCase() === 'ALL') {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          code: 'SUPER_ADMIN_REQUIRED',
          message: 'Cross-platform consolidated reports require Super Admin privilege.'
        });
      }
      req.activePlatform = { id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true };
      req.platformRole = 'Super Admin';
      return next();
    }

    // Resolve target platform from database
    let platformRecord = null;
    if (requestedPlatform) {
      const aliasCode = requestedPlatform.toUpperCase() === 'GHSUPERWINNINGS' ? 'GHSUPERWININGS' : requestedPlatform;
      platformRecord = await db.get(
        `SELECT id, name, code, logo_url, description, status, enabled_modules, country, mongo_uri, database_name, collection_sdp, collection_callback 
         FROM platforms WHERE (UPPER(code) = UPPER(?) OR UPPER(code) = UPPER(?) OR id = ?) AND status = 'ACTIVE'`,
        [requestedPlatform, aliasCode, requestedPlatform]
      );
      if (!platformRecord) {
        return res.status(404).json({
          success: false,
          code: 'PLATFORM_NOT_FOUND',
          message: `Platform '${requestedPlatform}' not found or is currently inactive.`
        });
      }
    } else {
      // If no platform specified by client, pick user's first currently active platform
      if (req.user.platforms && req.user.platforms.length > 0) {
        const first = req.user.platforms[0];
        platformRecord = await db.get('SELECT * FROM platforms WHERE id = ?', [first.platform_id]);
      } else if (req.user.isSuperAdmin) {
        req.activePlatform = { id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true };
        req.platformRole = 'Super Admin';
        return next();
      } else {
        return res.status(403).json({
          success: false,
          code: 'NO_PLATFORMS_ASSIGNED',
          message: 'Your account has not been assigned to any active platform.'
        });
      }
    }

    // Super Admin has universal access to all active platforms
    if (req.user.isSuperAdmin) {
      let modules = [];
      try { modules = JSON.parse(platformRecord.enabled_modules || '[]'); } catch { modules = []; }

      req.activePlatform = {
        id: platformRecord.id,
        code: platformRecord.code,
        name: platformRecord.name,
        logo_url: platformRecord.logo_url,
        enabled_modules: modules
      };
      req.platformRole = 'Super Admin';
      return next();
    }

    // REAL-TIME DATE-WISE AUTHORIZATION CHECK
    // Query platform_access table directly for this specific user & platform
    const accessRow = await db.get(
      `SELECT pa.id, pa.user_id, pa.platform_id, pa.role_id, r.name as role_name,
              pa.start_date, pa.end_date, pa.status
       FROM platform_access pa
       JOIN roles r ON pa.role_id = r.id
       WHERE pa.user_id = ? AND pa.platform_id = ?`,
      [req.user.id, platformRecord.id]
    );

    if (!accessRow) {
      // Check fallback to user_platforms if migration hadn't populated
      const fallbackRow = await db.get(
        `SELECT up.id, up.user_id, up.platform_id, up.role_id, r.name as role_name
         FROM user_platforms up
         JOIN roles r ON up.role_id = r.id
         WHERE up.user_id = ? AND up.platform_id = ?`,
        [req.user.id, platformRecord.id]
      );

      if (!fallbackRow) {
        return res.status(403).json({
          success: false,
          code: 'PLATFORM_ACCESS_DENIED',
          message: `403 Forbidden: You are not authorized to access platform '${platformRecord.name}'. Access denied.`
        });
      }

      // If in fallback table, permit with platform role
      let modules = [];
      try { modules = JSON.parse(platformRecord.enabled_modules || '[]'); } catch { modules = []; }
      req.activePlatform = {
        id: platformRecord.id,
        code: platformRecord.code,
        name: platformRecord.name,
        logo_url: platformRecord.logo_url,
        database_name: platformRecord.database_name,
        collection_sdp: platformRecord.collection_sdp,
        collection_callback: platformRecord.collection_callback,
        enabled_modules: modules
      };
      req.platformRole = fallbackRow.role_name;
      return next();
    }

    // Evaluate date boundaries in real-time
    const now = new Date();
    const evaluation = determineAccessStatus(accessRow, now);

    if (!evaluation.isCurrentlyActive) {
      if (evaluation.status === 'REVOKED') {
        return res.status(403).json({
          success: false,
          code: 'PLATFORM_ACCESS_REVOKED',
          message: `403 Forbidden: Your access to platform '${platformRecord.name}' has been revoked by an administrator.`
        });
      }

      if (evaluation.status === 'UPCOMING') {
        return res.status(403).json({
          success: false,
          code: 'PLATFORM_ACCESS_UPCOMING',
          message: `403 Forbidden: Your access to platform '${platformRecord.name}' is scheduled for a future date (starts ${accessRow.start_date}). Access is not yet active.`,
          startDate: accessRow.start_date
        });
      }

      if (evaluation.status === 'EXPIRED') {
        return res.status(403).json({
          success: false,
          code: 'PLATFORM_ACCESS_EXPIRED',
          message: `403 Forbidden: Your access to platform '${platformRecord.name}' expired on ${accessRow.end_date}. Continued access is denied.`,
          endDate: accessRow.end_date
        });
      }

      return res.status(403).json({
        success: false,
        code: 'PLATFORM_ACCESS_DENIED',
        message: `403 Forbidden: ${evaluation.reason}`
      });
    }

    // Access is ACTIVE and verified!
    let modules = [];
    try { modules = JSON.parse(platformRecord.enabled_modules || '[]'); } catch { modules = []; }

    req.activePlatform = {
      id: platformRecord.id,
      code: platformRecord.code,
      name: platformRecord.name,
      logo_url: platformRecord.logo_url,
      database_name: platformRecord.database_name,
      collection_sdp: platformRecord.collection_sdp,
      collection_callback: platformRecord.collection_callback,
      enabled_modules: modules,
      startDate: accessRow.start_date,
      endDate: accessRow.end_date,
      isExpiringSoon: evaluation.isExpiringSoon,
      daysUntilExpiry: evaluation.daysUntilExpiry
    };
    req.platformRole = accessRow.role_name;

    next();
  } catch (err) {
    console.error('[PlatformGuard] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal error during platform authorization check.' });
  }
}

