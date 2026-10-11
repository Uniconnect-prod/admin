import { db } from '../models/db.js';

export async function logAudit(req, action, entity, entityId = null, metadata = {}) {
  try {
    const userId = req.user?.id || null;
    const platformId = req.activePlatform?.isAll ? null : (req.activePlatform?.id || null);
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    await db.run(
      `INSERT INTO audit_logs (user_id, platform_id, action, entity, entity_id, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, platformId, action, entity, entityId ? String(entityId) : null, JSON.stringify(metadata), ipAddress]
    );
  } catch (err) {
    console.error('[Audit Logger] Error creating audit log:', err.message);
  }
}

