import { db } from '../models/db.js';
import { logAudit } from '../middleware/auditLogger.js';
import { sourceDataService } from '../services/sourceDataService.js';

export const exportController = {
  async exportSubscribers(req, res) {
    try {
      const { status, offer_code, from, to, search } = req.query;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const result = await sourceDataService.getSubscribers({
        platformCode,
        status,
        offer_code,
        from,
        to,
        search,
        page: 1,
        limit: 5000
      });

      const rows = result.subscribers;

      // Convert to CSV
      const headers = ['ID', 'Platform', 'MSISDN', 'Offer Code', 'Reason', 'Lifecycle', 'Next Billing Date', 'Status', 'Charging Amount', 'Currency', 'Renewal Count', 'Created At'];
      const csvLines = [headers.join(',')];

      for (const row of rows) {
        const line = [
          row.id,
          `"${(row.platform_name || '').replace(/"/g, '""')}"`,
          `"+${String(row.msisdn || '').replace(/^\++/, '')}"`,
          `"${row.offer_code || ''}"`,
          `"${(row.reason || '').replace(/"/g, '""')}"`,
          row.lifecycle || 'ACTIVE',
          `"${row.next_billing_date || ''}"`,
          row.status,
          Number(row.charging_amount || 1.0).toFixed(2),
          row.currency || 'GHC',
          row.renewal_count || 1,
          `"${row.created_at}"`
        ];
        csvLines.push(line.join(','));
      }

      const csvContent = csvLines.join('\r\n');
      const platformPrefix = req.activePlatform.isAll ? 'All_Platforms' : req.activePlatform.name.replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${platformPrefix}_Subscribers_${dateStr}.csv`;

      await logAudit(req, 'EXPORT_SUBSCRIBERS_CSV', 'Subscriber', null, { count: rows.length, filename });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      console.error('[ExportController] exportSubscribers error:', err);
      return res.status(500).json({ success: false, message: 'Failed to export subscribers CSV.' });
    }
  },

  async exportRenewals(req, res) {
    try {
      const conditions = [];
      const params = [];

      if (!req.activePlatform.isAll) {
        conditions.push('r.platform_id = ?');
        params.push(req.activePlatform.id);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT r.id, p.name as Platform, s.msisdn as MSISDN, r.offer_code as Offer_Code,
               s.lifecycle as Lifecycle, r.status as Status, r.amount as Amount,
               r.failure_reason as Failure_Reason, r.renewed_at as Renewal_Time
        FROM renewals r
        JOIN subscribers s ON r.subscriber_id = s.id
        JOIN platforms p ON r.platform_id = p.id
        ${whereClause}
        ORDER BY r.renewed_at DESC
        LIMIT 5000
      `;

      const rows = await db.all(sql, params);

      const headers = ['ID', 'Platform', 'MSISDN', 'Offer Code', 'Lifecycle', 'Status', 'Amount (GHC)', 'Failure Reason', 'Renewal Time'];
      const csvLines = [headers.join(',')];

      for (const row of rows) {
        const line = [
          row.id,
          `"${(row.Platform || '').replace(/"/g, '""')}"`,
          `"${row.MSISDN}"`,
          `"${row.Offer_Code}"`,
          row.Lifecycle,
          row.Status,
          row.Amount,
          `"${(row.Failure_Reason || '').replace(/"/g, '""')}"`,
          `"${row.Renewal_Time}"`
        ];
        csvLines.push(line.join(','));
      }

      const csvContent = csvLines.join('\r\n');
      const platformPrefix = req.activePlatform.isAll ? 'All_Platforms' : req.activePlatform.name.replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${platformPrefix}_Renewals_${dateStr}.csv`;

      await logAudit(req, 'EXPORT_RENEWALS_CSV', 'Renewal', null, { count: rows.length, filename });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      console.error('[ExportController] exportRenewals error:', err);
      return res.status(500).json({ success: false, message: 'Failed to export renewals CSV.' });
    }
  },

  async exportChurn(req, res) {
    try {
      const conditions = [];
      const params = [];

      if (!req.activePlatform.isAll) {
        conditions.push('c.platform_id = ?');
        params.push(req.activePlatform.id);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT c.id, p.name as Platform, s.msisdn as MSISDN, c.offer_code as Offer_Code,
               c.reason as Reason, c.lifecycle as Lifecycle, s.next_billing_date as Last_Billing_Date,
               c.churned_at as Churn_Date
        FROM churns c
        JOIN subscribers s ON c.subscriber_id = s.id
        JOIN platforms p ON c.platform_id = p.id
        ${whereClause}
        ORDER BY c.churned_at DESC
        LIMIT 5000
      `;

      const rows = await db.all(sql, params);

      const headers = ['ID', 'Platform', 'MSISDN', 'Offer Code', 'Reason', 'Lifecycle', 'Last Billing Date', 'Churn Date'];
      const csvLines = [headers.join(',')];

      for (const row of rows) {
        const line = [
          row.id,
          `"${(row.Platform || '').replace(/"/g, '""')}"`,
          `"${row.MSISDN}"`,
          `"${row.Offer_Code}"`,
          `"${(row.Reason || '').replace(/"/g, '""')}"`,
          row.Lifecycle,
          `"${row.Last_Billing_Date || ''}"`,
          `"${row.Churn_Date}"`
        ];
        csvLines.push(line.join(','));
      }

      const csvContent = csvLines.join('\r\n');
      const platformPrefix = req.activePlatform.isAll ? 'All_Platforms' : req.activePlatform.name.replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${platformPrefix}_Churn_${dateStr}.csv`;

      await logAudit(req, 'EXPORT_CHURN_CSV', 'Churn', null, { count: rows.length, filename });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      console.error('[ExportController] exportChurn error:', err);
      return res.status(500).json({ success: false, message: 'Failed to export churn CSV.' });
    }
  }
};

