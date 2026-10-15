import { col, COLLECTIONS } from '../store/index.js';
import { userRepository } from './userRepository.js';

const SENSITIVE_KEY = /(password|secret|token|api[_-]?key|authorization|cookie|credential)/i;

/**
 * Remove anything that looks like a credential before it is persisted in an audit record.
 */
export function scrubMetadata(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map(v => scrubMetadata(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrubMetadata(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export const auditRepository = {
  async insert({ userId = null, platformId = null, action, entity, entityId = null, metadata = {}, ip = null }) {
    await col(COLLECTIONS.audit).insertOne({
      user_id: userId,
      platform_id: platformId,
      action,
      entity,
      entity_id: entityId === null || entityId === undefined ? null : String(entityId),
      metadata: scrubMetadata(metadata),
      ip_address: ip,
      created_at: new Date()
    });
  },

  async search({ platformIds = null, action, entity, userId, from, to, page = 1, limit = 25 }) {
    const filter = {};
    if (platformIds) filter.platform_id = { $in: platformIds };
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (userId) filter.user_id = parseInt(userId, 10);
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = from;
      if (to) filter.created_at.$lte = to;
    }
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const audit = col(COLLECTIONS.audit);
    const [total, rows] = await Promise.all([
      audit.countDocuments(filter),
      audit.find(filter).sort({ created_at: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray()
    ]);
    const names = await userRepository.namesByIds(rows.map(r => r.user_id));
    return {
      records: rows.map(r => ({
        id: String(r._id),
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        userId: r.user_id,
        user: names.get(r.user_id)?.name || (r.user_id ? `User #${r.user_id}` : 'System'),
        platformId: r.platform_id,
        metadata: r.metadata || {},
        ip: r.ip_address,
        timestamp: r.created_at
      })),
      pagination: { totalRecords: total, totalPages: Math.max(1, Math.ceil(total / safeLimit)), currentPage: safePage, limit: safeLimit }
    };
  },

  async distinctActions() {
    const rows = await col(COLLECTIONS.audit).find({}, { projection: { action: 1 } }).sort({ created_at: -1 }).limit(2000).toArray();
    return [...new Set(rows.map(r => r.action).filter(Boolean))].sort();
  }
};
