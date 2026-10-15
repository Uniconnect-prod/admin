import './helpers/env.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMetric } from '../src/reporting/metrics.js';
import { buildSettlement } from '../src/reporting/reportService.js';
import { resolveRange } from '../src/reporting/dateRange.js';
import { csvCell, toCsv } from '../src/utils/csv.js';
import { validateIntegrationConfig } from '../src/integrations/configSchema.js';
import { describeCapabilities } from '../src/integrations/capabilities.js';
import { buildReportRequest } from '../src/integrations/requestBuilder.js';
import { PRESETS } from '../src/integrations/presets.js';
import { alphaIntegration } from './fixtures/mockPlatformApi.js';

const cfgOf = input => validateIntegrationConfig(input).config;

function snapshot(rows, summary = null) {
  return { daily: { present: true, rows }, summary: summary ? { present: true, values: summary } : { present: false, values: {} } };
}

const mappingConfig = (daily, summary = {}) => cfgOf({
  ...alphaIntegration(),
  mappings: {
    daily: { report_date: { path: 'date', format: 'YYYY-MM-DD' }, ...Object.fromEntries(daily.map(k => [k, { path: k }])) },
    summary: Object.fromEntries(Object.keys(summary).map(k => [k, { path: k }])),
    records: {}
  }
});

describe('Metric provenance and calculation rules', () => {
  test('API summary values are used as-is and labelled "api"', () => {
    const cfg = mappingConfig(['grand_total'], { grand_total: 1 });
    const m = resolveMetric('grand_total', snapshot([{ report_date: '2026-10-01', grand_total: 10 }], { grand_total: 999.99 }), cfg);
    assert.equal(m.value, 999.99);
    assert.equal(m.provenance, 'api');
  });
  test('without a summary, additive metrics are summed from daily rows and labelled "calculated"', () => {
    const cfg = mappingConfig(['grand_total']);
    const m = resolveMetric('grand_total', snapshot([{ report_date: '2026-10-01', grand_total: 0.1 }, { report_date: '2026-10-02', grand_total: 0.2 }]), cfg);
    assert.equal(m.value, 0.3);
    assert.equal(m.provenance, 'calculated');
    assert.equal(m.source, 'daily_sum');
  });
  test('derived grand total is only calculated when the API does not provide one (no double counting)', () => {
    const rows = [{ report_date: '2026-10-01', daily_revenue: 57.79, ondemand_revenue: 0.79, grand_total: 58.58 }];
    const withApiTotal = resolveMetric('grand_total', snapshot(rows), mappingConfig(['daily_revenue', 'ondemand_revenue', 'grand_total']));
    assert.equal(withApiTotal.value, 58.58);
    assert.equal(withApiTotal.source, 'daily_sum');
    const derived = resolveMetric('grand_total', snapshot(rows), mappingConfig(['daily_revenue', 'ondemand_revenue']));
    assert.equal(derived.value, 58.58);
    assert.equal(derived.source, 'derived');
  });
  test('point-in-time metrics are never summed across days', () => {
    const m = resolveMetric('active_subscribers', snapshot([{ report_date: '2026-10-01', active_subscribers: 100 }, { report_date: '2026-10-02', active_subscribers: 120 }]), mappingConfig(['active_subscribers']));
    assert.equal(m.value, 120);
    assert.match(m.note, /2026-10-02/);
  });
  test('unmapped metrics are unavailable with the missing inputs named — never zero', () => {
    const m = resolveMetric('renewal_rate', snapshot([{ report_date: '2026-10-01', renewal_count: 5 }]), mappingConfig(['renewal_count']));
    assert.equal(m.value, null);
    assert.equal(m.provenance, 'unavailable');
    assert.deepEqual(m.missing, ['failed_renewal_count']);
    const n = resolveMetric('activation_parking', snapshot([]), mappingConfig([]));
    assert.equal(n.value, null);
    assert.equal(n.provenance, 'unavailable');
  });
  test('days where the API returned null are not counted as zero', () => {
    const m = resolveMetric('new_subscribers', snapshot([{ report_date: '2026-10-01', new_subscribers: 4 }, { report_date: '2026-10-02', new_subscribers: null }]), mappingConfig(['new_subscribers']));
    assert.equal(m.value, 4);
    assert.match(m.note, /1 day\(s\) had no value/);
  });
  test('renewal rate is calculated from mapped counts', () => {
    const m = resolveMetric('renewal_rate', snapshot([{ report_date: '2026-10-01', renewal_count: 97, failed_renewal_count: 3 }]), mappingConfig(['renewal_count', 'failed_renewal_count']));
    assert.equal(m.value, 97);
    assert.equal(m.provenance, 'calculated');
  });
});

describe('Settlement table', () => {
  test('columns, running totals and exact totals', () => {
    const cfg = cfgOf(alphaIntegration());
    const rows = [
      { report_date: '2026-09-03', new_subscribers: 53, activation_parking: 353, daily_revenue: 57.79, ondemand_revenue: 0.79, grand_total: 58.58, daily_transactions: 56, ondemand_transactions: 1 },
      { report_date: '2026-09-04', new_subscribers: 18, activation_parking: 125, daily_revenue: 74.79, ondemand_revenue: 0, grand_total: 74.79, daily_transactions: 75, ondemand_transactions: 0 }
    ];
    const s = buildSettlement(snapshot(rows), cfg);
    assert.deepEqual(s.columns.map(c => c.label), ['New Subscriber Num', 'Activation Parking', 'Super Winnings Daily', 'Super Winnings on-demand Daily', 'Grand Total']);
    assert.equal(s.totals.grand_total, 133.37);
    assert.equal(s.totals.daily_revenue, 132.58);
    assert.equal(s.rows[1].running.grand_total, 133.37);
    assert.equal(s.viewModes.transactions, true);
    const totalTx = s.columns.find(c => c.key === 'grand_total').transactions;
    assert.equal(totalTx.available, true);
    assert.equal(totalTx.provenance, 'calculated', 'transaction_count is derived from the two mapped transaction counts');
    assert.equal(s.totals.transaction_count, 132);
  });
  test('unmapped columns are flagged unavailable instead of filled with zeros', () => {
    const cfg = mappingConfig(['new_subscribers']);
    const s = buildSettlement(snapshot([{ report_date: '2026-09-03', new_subscribers: 5 }]), cfg);
    assert.equal(s.columns.find(c => c.key === 'activation_parking').available, false);
    assert.equal('activation_parking' in s.rows[0].values, false);
  });
});

describe('Date ranges in the business timezone', () => {
  const now = new Date('2026-10-13T22:30:00Z');
  test('presets are evaluated in the platform timezone', () => {
    assert.deepEqual(resolveRange({ range: 'today' }, 'Africa/Accra', 30, now).from, '2026-10-13');
    assert.deepEqual(resolveRange({ range: 'today' }, 'Africa/Nairobi', 30, now).from, '2026-10-14');
    const r = resolveRange({ range: '7d' }, 'Africa/Accra', 30, now);
    assert.equal(r.from, '2026-10-07');
    assert.equal(r.to, '2026-10-13');
    assert.equal(r.days, 7);
    assert.equal(resolveRange({ range: 'mtd' }, 'Africa/Accra', 30, now).from, '2026-10-01');
  });
  test('invalid ranges are rejected', () => {
    assert.throws(() => resolveRange({ range: 'custom', from: '2026-10-05', to: '2026-10-01' }), { code: 'INVALID_DATE' });
    assert.throws(() => resolveRange({ range: 'custom', from: '2026-02-30', to: '2026-03-01' }), { code: 'INVALID_DATE' });
    assert.throws(() => resolveRange({ range: 'custom', from: '2024-01-01', to: '2026-01-01' }), { code: 'INVALID_DATE' });
  });
});

describe('CSV generation', () => {
  test('escapes quotes/commas/newlines and neutralises spreadsheet formulas', () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('+233201234567'), "'+233201234567");
    assert.equal(csvCell(-5), '-5');
    assert.equal(csvCell(null), '');
  });
  test('preserves numeric precision with fixed decimals', () => {
    assert.equal(csvCell(58.58, { decimals: 2 }), '58.58');
    assert.equal(csvCell(2, { decimals: 2 }), '2.00');
    const csv = toCsv(['Date', 'Total'], [['2026-09-03', csvCell(58.58, { decimals: 2 })]]);
    assert.ok(csv.startsWith('﻿Date,Total\r\n2026-09-03,58.58'));
  });
});

describe('GHSuperWinnings regression', () => {
  const preset = PRESETS.find(p => p.id === 'ghsuperwinnings');

  test('preset is a valid configuration that targets the registered endpoint', () => {
    const { config, errors } = validateIntegrationConfig(preset.integration);
    assert.deepEqual(errors, []);
    assert.equal(config.base_url, 'https://ghsuperwinnings.com/api');
    assert.equal(config.auth.type, 'bearer');
  });
  test('preset reproduces the documented dashboard request exactly', () => {
    const config = validateIntegrationConfig(preset.integration).config;
    const built = buildReportRequest(config, { reportType: 'overview', from: '2026-10-01', to: '2026-10-13', page: 1, limit: 50 }, 'Africa/Accra');
    assert.equal(built.url, 'https://ghsuperwinnings.com/api/admin/dashboard?fromDate=2026-10-01&toDate=2026-10-13&report=all&page=1&limit=50');
  });
  test('preset does not invent settlement revenue or parking fields', () => {
    const config = validateIntegrationConfig(preset.integration).config;
    for (const key of ['activation_parking', 'daily_revenue', 'ondemand_revenue', 'grand_total']) {
      assert.equal(config.mappings.daily[key], undefined, `${key} must stay unmapped until confirmed`);
      assert.equal(config.mappings.summary[key], undefined, `${key} must stay unmapped until confirmed`);
    }
    const caps = describeCapabilities(config);
    assert.equal(caps.modules.revenue, false);
    assert.equal(preset.platform.enabled_modules.includes('revenue'), false);
    assert.ok(preset.unknowns.length >= 5);
  });
  test('settlement view keeps the six required columns, marking unconfirmed ones unavailable', () => {
    const config = validateIntegrationConfig(preset.integration).config;
    const s = buildSettlement(snapshot([{ report_date: '2026-10-01', new_subscribers: 12 }]), config);
    assert.deepEqual(s.columns.map(c => c.key), ['new_subscribers', 'activation_parking', 'daily_revenue', 'ondemand_revenue', 'grand_total']);
    assert.equal(s.columns[0].label, 'New Subscriber Num');
    assert.deepEqual(s.columns.filter(c => !c.available).map(c => c.key), ['activation_parking', 'daily_revenue', 'ondemand_revenue', 'grand_total']);
  });
});
