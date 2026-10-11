import { db } from '../models/db.js';

export const auditController = {
  async getAuditLogs(req, res) {
    try {
      const { action, entity, from, to, page = 1, limit = 20 } = req.query;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

      const conditions = [];
      const params = [];

      // If not Super Admin, show only current platform's logs
      if (!req.user.isSuperAdmin) {
        if (req.activePlatform && !req.activePlatform.isAll) {
          conditions.push('(a.platform_id = ? OR a.platform_id IS NULL)');
          params.push(req.activePlatform.id);
        }
      }

      if (action && action !== 'ALL') {
        conditions.push('a.action = ?');
        params.push(action);
      }

      if (entity && entity !== 'ALL') {
        conditions.push('a.entity = ?');
        params.push(entity);
      }

      if (from) {
        conditions.push('a.created_at >= ?');
        params.push(from);
      }

      if (to) {
        conditions.push('a.created_at <= ?');
        params.push(to);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`;
      const totalRes = await db.get(countSql, params);
      const totalRecords = totalRes?.total || 0;

      const dataSql = `
        SELECT a.*, u.name as user_name, u.email as user_email,
               p.name as platform_name, p.code as platform_code
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN platforms p ON a.platform_id = p.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const logs = await db.all(dataSql, [...params, safeLimit, offset]);

      const formattedLogs = logs.map(l => {
        let meta = {};
        try { meta = JSON.parse(l.metadata || '{}'); } catch {}
        return {
          id: l.id,
          action: l.action,
          entity: l.entity,
          entityId: l.entity_id,
          user: l.user_name || 'System / Guest',
          userEmail: l.user_email,
          platform: l.platform_name || 'Global / Multi-Tenant',
          platformCode: l.platform_code,
          details: meta.details || JSON.stringify(meta),
          ip: l.ip_address,
          timestamp: l.created_at
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          records: formattedLogs,
          pagination: {
            totalRecords,
            totalPages: Math.ceil(totalRecords / safeLimit),
            currentPage: parseInt(page, 10),
            limit: safeLimit
          }
        }
      });
    } catch (err) {
      console.error('[AuditController] getAuditLogs error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
    }
  }
};

