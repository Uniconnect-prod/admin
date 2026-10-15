import { auditRepository } from '../repositories/auditRepository.js';

/**
 * Record an audit event. options.platformId / options.userId override the values taken
 * from the request (e.g. during login, before req.user exists). Pass platformId: null for
 * events that are not platform-scoped.
 */
export async function logAudit(req, action, entity, entityId = null, metadata = {}, options = {}) {
  try {
    const platformId = 'platformId' in options
      ? options.platformId
      : (req.activePlatform && !req.activePlatform.isAll ? req.activePlatform.id : null);
    await auditRepository.insert({
      userId: options.userId ?? req.user?.id ?? null,
      platformId,
      action,
      entity,
      entityId,
      metadata,
      ip: req.ip || null
    });
  } catch (err) {
    // Audit failures must never break the user request, but they must be visible to operators.
    console.error(`[Audit] Failed to record ${action}: ${err.message}`);
  }
}
