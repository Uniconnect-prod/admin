import { col, COLLECTIONS } from '../store/index.js';

/**
 * Connection and validation history for platform API integrations.
 * Stores request metadata only (host, path, status, timing, error code) — never
 * credentials, headers, query values or response bodies.
 */
export const integrationLogRepository = {
  async insert(entry) {
    await col(COLLECTIONS.integrationLogs).insertOne({
      platform_id: entry.platformId ?? null,
      platform_code: entry.platformCode ?? null,
      kind: entry.kind, // TEST | VALIDATION | FETCH | EXPORT | LOGIN | ACTIVATION
      ok: Boolean(entry.ok),
      http_status: entry.httpStatus ?? null,
      error_code: entry.errorCode ?? null,
      message: entry.message ? String(entry.message).slice(0, 500) : null,
      host: entry.host ?? null,
      path: entry.path ?? null,
      duration_ms: entry.durationMs ?? null,
      bytes: entry.bytes ?? null,
      summary: entry.summary ?? null,
      user_id: entry.userId ?? null,
      created_at: new Date()
    });
  },

  async list({ platformId = null, kind = null, ok = null, page = 1, limit = 25 } = {}) {
    const filter = {};
    if (platformId !== null) filter.platform_id = parseInt(platformId, 10);
    if (kind) filter.kind = kind;
    if (ok !== null) filter.ok = ok;
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const logs = col(COLLECTIONS.integrationLogs);
    const [total, rows] = await Promise.all([
      logs.countDocuments(filter),
      logs.find(filter).sort({ created_at: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray()
    ]);
    return {
      records: rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })),
      pagination: { totalRecords: total, totalPages: Math.max(1, Math.ceil(total / safeLimit)), currentPage: safePage, limit: safeLimit }
    };
  }
};
