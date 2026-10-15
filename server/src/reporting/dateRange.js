import { IntegrationError } from '../integrations/errors.js';
import { dayKeyInTimezone } from '../integrations/transforms.js';
import { addDays } from '../integrations/requestBuilder.js';

export const RANGE_PRESETS = ['today', 'yesterday', '7d', '30d', '90d', 'mtd', 'custom'];
export const MAX_RANGE_DAYS = 366;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(key) {
  if (!DAY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function daysBetween(from, to) {
  const a = Date.UTC(...from.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  const b = Date.UTC(...to.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Resolve a date range into inclusive business-day keys in the platform's timezone.
 * Presets are evaluated against "today" in that timezone, never the server's.
 */
export function resolveRange({ range, from, to } = {}, timezone = 'UTC', defaultDays = 30, now = new Date()) {
  const today = dayKeyInTimezone(now, timezone);
  let preset = range || (from || to ? 'custom' : null);
  let start;
  let end;

  switch (preset) {
    case 'today': start = today; end = today; break;
    case 'yesterday': start = addDays(today, -1); end = start; break;
    case '7d': start = addDays(today, -6); end = today; break;
    case '30d': start = addDays(today, -29); end = today; break;
    case '90d': start = addDays(today, -89); end = today; break;
    case 'mtd': start = `${today.slice(0, 8)}01`; end = today; break;
    case 'custom':
      if (!from || !to) throw new IntegrationError('INVALID_DATE', 'Both start and end dates are required.');
      if (!isRealDay(from) || !isRealDay(to)) throw new IntegrationError('INVALID_DATE', 'Dates must be valid calendar dates in YYYY-MM-DD format.');
      start = from;
      end = to;
      break;
    default:
      preset = 'default';
      start = addDays(today, -(defaultDays - 1));
      end = today;
  }

  if (start > end) throw new IntegrationError('INVALID_DATE', 'The start date must be on or before the end date.');
  const days = daysBetween(start, end);
  if (days > MAX_RANGE_DAYS) throw new IntegrationError('INVALID_DATE', `Date ranges are limited to ${MAX_RANGE_DAYS} days.`);
  return { range: preset, from: start, to: end, days, timezone, today };
}

export function listDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
