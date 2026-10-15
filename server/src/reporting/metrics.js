import { DAILY_FIELDS, SUMMARY_FIELDS } from '../integrations/canonicalFields.js';
import { sumExact, sumIntegers, toMicros, microsToNumber } from '../integrations/transforms.js';

/**
 * Metric resolution with explicit provenance.
 *
 *  provenance 'api'         – value supplied directly by the platform API (summary field, or the
 *                              latest daily value of a point-in-time metric)
 *  provenance 'calculated'  – computed by the reporting backend from API-supplied values
 *                              (sum of daily rows, documented derived formulas)
 *  provenance 'unavailable' – the API mapping does not provide the inputs; `missing` names them
 *
 * Rules that prevent double counting:
 *  - an API summary value always wins over recomputing it from daily rows;
 *  - a derived metric (e.g. grand total) is only calculated when the API does NOT supply it;
 *  - API totals and locally recalculated totals are never added together.
 */

export const DERIVED_METRICS = {
  grand_total: {
    label: 'Grand total revenue',
    kind: 'currency',
    inputs: ['daily_revenue', 'ondemand_revenue'],
    formula: 'Daily offer revenue + On-demand revenue'
  },
  transaction_count: {
    label: 'Transactions',
    kind: 'count',
    inputs: ['daily_transactions', 'ondemand_transactions'],
    formula: 'Daily offer transactions + On-demand transactions'
  },
  renewal_rate: {
    label: 'Renewal success rate',
    kind: 'ratio',
    inputs: ['renewal_count', 'failed_renewal_count'],
    formula: 'Renewals ÷ (Renewals + Failed renewals)'
  },
  net_additions: {
    label: 'Net subscriber additions',
    kind: 'count',
    inputs: ['new_subscribers', 'deactivations'],
    formula: 'New subscribers − Deactivations'
  }
};

function definition(key) {
  return SUMMARY_FIELDS[key] || DAILY_FIELDS[key] || DERIVED_METRICS[key] || { label: key, kind: 'count' };
}

function unavailable(key, label, missing, note) {
  const def = definition(key);
  return { key, label: label || def.label, kind: def.kind, value: null, provenance: 'unavailable', source: null, missing, note };
}

function labelFor(key, config) {
  return config?.mappings?.daily?.[key]?.label || config?.mappings?.summary?.[key]?.label || definition(key).label;
}

/**
 * Resolve one metric from a fetched snapshot { daily: {rows}, summary: {values} }.
 */
export function resolveMetric(key, snapshot, config, depth = 0) {
  const decimals = config?.currency_decimals ?? 2;
  const mappings = config?.mappings || {};
  const def = definition(key);
  const label = labelFor(key, config);
  const rows = snapshot?.daily?.rows || [];

  // 1. Directly supplied by the API summary.
  if (mappings.summary?.[key] && snapshot?.summary?.present) {
    const value = snapshot.summary.values[key];
    if (value === null || value === undefined) {
      return unavailable(key, label, [], 'The API response did not include a value for this metric.');
    }
    return { key, label, kind: def.kind, value, provenance: 'api', source: 'summary', note: 'Reported by the platform API.' };
  }

  // 2. From daily rows.
  if (mappings.daily?.[key] && snapshot?.daily?.present) {
    const values = rows.map(r => r[key]);
    const present = values.filter(v => v !== null && v !== undefined);
    if (!present.length) {
      return unavailable(key, label, [], rows.length ? 'The API returned no values for this metric in the selected period.' : 'The API returned no daily rows for the selected period.');
    }
    if (def.kind === 'stock') {
      const latest = [...rows].reverse().find(r => r[key] !== null && r[key] !== undefined);
      return { key, label, kind: def.kind, value: latest[key], provenance: 'api', source: 'latest_daily', note: `Latest value reported by the API (as of ${latest.report_date}).` };
    }
    const value = def.kind === 'currency' ? sumExact(values, decimals) : sumIntegers(values);
    const partial = present.length < rows.length ? ` ${rows.length - present.length} day(s) had no value.` : '';
    return { key, label, kind: def.kind, value, provenance: 'calculated', source: 'daily_sum', note: `Sum of ${present.length} daily value(s) returned by the API.${partial}` };
  }

  // 3. Derived from other metrics (only when the API does not supply the metric itself).
  const derived = DERIVED_METRICS[key];
  if (derived && depth === 0) {
    const inputs = derived.inputs.map(k => resolveMetric(k, snapshot, config, depth + 1));
    const missing = inputs.filter(i => i.provenance === 'unavailable').map(i => i.key);
    if (missing.length) return unavailable(key, label, missing, `Requires ${derived.inputs.join(' and ')}.`);
    const [a, b] = inputs.map(i => i.value);
    let value;
    if (derived.kind === 'currency') value = microsToNumber(toMicros(a) + toMicros(b), decimals);
    else if (key === 'renewal_rate') value = a + b > 0 ? Math.round((a / (a + b)) * 10000) / 100 : null;
    else if (key === 'net_additions') value = a - b;
    else value = a + b;
    if (value === null) return unavailable(key, label, [], 'No renewal attempts in the selected period.');
    return { key, label, kind: derived.kind, value, provenance: 'calculated', source: 'derived', note: `Calculated: ${derived.formula}.` };
  }

  return unavailable(key, label, [key], "Not provided by this platform's API mapping.");
}

/**
 * Per-day values for a key, including documented derivations, without fabricating zeros.
 */
export function dailyValue(row, key, config) {
  if (row[key] !== undefined && config?.mappings?.daily?.[key]) return row[key];
  const derived = DERIVED_METRICS[key];
  if (!derived || derived.kind === 'ratio') return null;
  const [a, b] = derived.inputs.map(k => (config?.mappings?.daily?.[k] ? row[k] : null));
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (derived.kind === 'currency') return microsToNumber(toMicros(a) + toMicros(b), config?.currency_decimals ?? 2);
  if (key === 'net_additions') return a - b;
  return a + b;
}

export function dailyAvailable(key, config) {
  if (config?.mappings?.daily?.[key]) return { available: true, provenance: 'api' };
  const derived = DERIVED_METRICS[key];
  if (derived && derived.kind !== 'ratio' && derived.inputs.every(k => config?.mappings?.daily?.[k])) {
    return { available: true, provenance: 'calculated', formula: derived.formula };
  }
  return { available: false, provenance: 'unavailable' };
}
