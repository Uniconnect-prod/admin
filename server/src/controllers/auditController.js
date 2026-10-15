import { auditRepository } from '../repositories/auditRepository.js';
import { platformRepository } from '../repositories/platformRepository.js';
import { badRequest } from '../utils/errors.js';

function parseDay(value, endOfDay) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('Dates must be YYYY-MM-DD.');
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(d.getTime())) throw badRequest('Invalid date.');
  return d;
}

export const auditController = {
  async getAuditLogs(req, res) {
    const { action, entity, from, to, page, limit, platformId } = req.query;
    let platformIds = null;
    if (!req.user.isSuperAdmin) {
      // Platform Admins see only events for platforms they administer (never global/auth events).
      platformIds = req.user.access.filter(a => a.isCurrentlyActive && a.role_name === 'Platform Admin').map(a => a.platform_id);
      if (platformId) platformIds = platformIds.filter(id => id === parseInt(platformId, 10));
    } else if (platformId) {
      platformIds = [parseInt(platformId, 10)];
    }
    const result = await auditRepository.search({
      platformIds,
      action: action && action !== 'ALL' ? String(action) : null,
      entity: entity && entity !== 'ALL' ? String(entity) : null,
      from: parseDay(from, false),
      to: parseDay(to, true),
      page,
      limit
    });
    const platforms = await platformRepository.listAll();
    const names = new Map(platforms.map(p => [p.id, { name: p.name, code: p.code }]));
    result.records = result.records.map(r => ({ ...r, platform: r.platformId ? (names.get(r.platformId) || { name: `Platform #${r.platformId}` }) : null }));
    res.json({ success: true, data: { ...result, actions: await auditRepository.distinctActions() } });
  }
};
