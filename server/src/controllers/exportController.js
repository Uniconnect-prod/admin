import { exportSettlementCsv, exportRecordsCsv } from '../reporting/exportService.js';
import { normalizeModules } from '../repositories/platformRepository.js';
import { logAudit } from '../middleware/auditLogger.js';
import { AppError } from '../utils/errors.js';
import { requestSignal } from './reportController.js';

function send(res, { csv, filename, meta }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Export-Rows', String(meta.rows));
  res.setHeader('X-Export-Complete', meta.complete ? 'true' : 'false');
  res.setHeader('X-Export-Pages', String(meta.pages ?? 1));
  if (meta.reportedTotal !== undefined && meta.reportedTotal !== null) res.setHeader('X-Export-Reported-Total', String(meta.reportedTotal));
  if (meta.duplicatesSkipped) res.setHeader('X-Export-Duplicates-Skipped', String(meta.duplicatesSkipped));
  res.status(200).send(csv);
}

function rangeQuery(q) {
  return { range: q.range || undefined, from: q.from || undefined, to: q.to || undefined };
}

export const exportController = {
  async settlement(req, res) {
    if (!normalizeModules(req.activePlatform.enabled_modules).includes('settlement')) {
      throw new AppError(404, 'MODULE_DISABLED', 'The settlement report is not enabled for this platform.');
    }
    const view = req.query.view === 'transactions' ? 'transactions' : 'revenue';
    const result = await exportSettlementCsv(req.activePlatform, rangeQuery(req.query), { view, userId: req.user.id, signal: requestSignal(req, res) });
    await logAudit(req, 'EXPORT_SETTLEMENT_CSV', 'Report', null, { view, rows: result.meta.rows, file: result.filename });
    send(res, result);
  },

  async records(req, res) {
    const reportType = String(req.query.reportType || 'subscribers');
    if (!['all', 'overview', 'subscribers', 'renewals', 'churn'].includes(reportType)) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown export type.');
    const module = (reportType === 'subscribers' || reportType === 'all' || reportType === 'overview') ? 'subscriber_records' : reportType;
    if (!normalizeModules(req.activePlatform.enabled_modules).includes(module)) {
      throw new AppError(404, 'MODULE_DISABLED', 'This export is not enabled for this platform.');
    }
    const search = typeof req.query.search === 'string' && /^[0-9+\s-]{3,40}$/.test(req.query.search.trim()) ? req.query.search.trim().replace(/[\s+-]/g, '') : undefined;
    const result = await exportRecordsCsv(req.activePlatform, { reportType, ...rangeQuery(req.query), search }, { userId: req.user.id, signal: requestSignal(req, res) });
    await logAudit(req, 'EXPORT_RECORDS_CSV', 'Report', null, { reportType, rows: result.meta.rows, complete: result.meta.complete, file: result.filename });
    send(res, result);
  }
};
