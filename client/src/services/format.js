const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return intFmt.format(value);
}

export function formatMoney(value, currency, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return currency ? `${currency} ${n}` : n;
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(1)}%`;
}

export function formatMetric(metric, currency) {
  if (!metric || metric.value === null || metric.value === undefined) return '—';
  if (metric.kind === 'currency') return formatMoney(metric.value, currency);
  if (metric.kind === 'ratio') return formatPercent(metric.value);
  return formatCount(metric.value);
}

export function formatValueByKind(value, kind, currency) {
  if (value === null || value === undefined) return '—';
  if (kind === 'currency') return formatMoney(value, currency);
  if (kind === 'ratio') return formatPercent(value);
  return formatCount(value);
}

export function formatDay(dayKey) {
  if (!dayKey) return '—';
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDayShort(dayKey) {
  if (!dayKey) return '';
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function formatDateTime(value, timeZone) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return d.toLocaleString('en-GB', timeZone ? { ...opts, timeZone } : opts);
  } catch {
    return d.toLocaleString('en-GB', opts);
  }
}

export function formatRelative(value) {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '—';
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function humanize(code) {
  return String(code || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
