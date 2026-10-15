import './helpers/env.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePath, parsePath } from '../src/integrations/jsonPath.js';
import { parseDecimal, parseInteger, parseDateKey, sumExact, microsToNumber, toMicros } from '../src/integrations/transforms.js';
import { buildReportRequest, zonedDayStart } from '../src/integrations/requestBuilder.js';
import { normalizeResponse } from '../src/integrations/normalizer.js';
import { validateIntegrationConfig, validateEndpointPath } from '../src/integrations/configSchema.js';
import { alphaIntegration, betaIntegration } from './fixtures/mockPlatformApi.js';

const valid = cfg => {
  const { config, errors } = validateIntegrationConfig(cfg);
  assert.deepEqual(errors, []);
  return config;
};

describe('JSON paths', () => {
  test('resolves nested keys and indexes, distinguishing missing from null', () => {
    const obj = { data: { rows: [{ v: 1 }, { v: null }] } };
    assert.deepEqual(resolvePath(obj, 'data.rows[0].v'), { found: true, value: 1 });
    assert.deepEqual(resolvePath(obj, 'data.rows.1.v'), { found: true, value: null });
    assert.equal(resolvePath(obj, 'data.rows[5].v').found, false);
    assert.equal(resolvePath(obj, '$').value, obj);
  });
  test('rejects prototype-pollution segments and expressions', () => {
    assert.throws(() => parsePath('__proto__.x'));
    assert.throws(() => parsePath('a.constructor'));
    assert.throws(() => parsePath('a[?(@.x)]'));
    assert.throws(() => parsePath('a..b'));
  });
});

describe('Value transforms', () => {
  test('decimals: currency prefixes, thousands separators, comma decimal separator', () => {
    assert.equal(parseDecimal('GHC 1,234.50').value, 1234.5);
    assert.equal(parseDecimal('1.234,56', { decimalSeparator: ',' }).value, 1234.56);
    assert.equal(parseDecimal(12.3).value, 12.3);
    assert.equal(parseDecimal('abc').ok, false);
  });
  test('missing values are null, never zero', () => {
    for (const v of [null, undefined, '', '  ']) assert.deepEqual(parseDecimal(v), { ok: true, value: null });
  });
  test('integers reject fractions', () => {
    assert.equal(parseInteger('12').value, 12);
    assert.equal(parseInteger('12.5').ok, false);
  });
  test('dates: explicit formats, real calendar validation, ambiguity rejected', () => {
    assert.equal(parseDateKey('14/09/2026', 'DD/MM/YYYY').value, '2026-09-14');
    assert.equal(parseDateKey('09/14/2026', 'MM/DD/YYYY').value, '2026-09-14');
    assert.equal(parseDateKey('20260914', 'YYYYMMDD').value, '2026-09-14');
    assert.equal(parseDateKey('2026-02-30', 'YYYY-MM-DD').ok, false);
    assert.equal(parseDateKey('14/09/2026', 'auto').ok, false);
  });
  test('datetimes are bucketed into the business timezone', () => {
    // 23:30 UTC on the 14th is already the 15th in Nairobi (UTC+3) but still the 14th in Accra (UTC+0).
    assert.equal(parseDateKey('2026-09-14T23:30:00Z', 'iso_datetime', 'Africa/Nairobi').value, '2026-09-15');
    assert.equal(parseDateKey('2026-09-14T23:30:00Z', 'iso_datetime', 'Africa/Accra').value, '2026-09-14');
    assert.equal(parseDateKey(Date.UTC(2026, 8, 14, 22, 0), 'epoch_ms', 'Asia/Kolkata').value, '2026-09-15');
  });
  test('money sums are exact and rounded half-up', () => {
    assert.equal(sumExact([0.1, 0.2]), 0.3);
    assert.equal(sumExact(Array(1000).fill(0.01)), 10);
    assert.equal(sumExact([1.005, 0]), 1.01);
    assert.equal(sumExact([57.79, 0.79]), 58.58);
    assert.equal(sumExact([null, undefined]), null);
    assert.equal(microsToNumber(toMicros('-2.345')), -2.35);
  });
});

describe('Configuration validation', () => {
  test('both mock platform configurations are valid', () => {
    valid(alphaIntegration());
    valid(betaIntegration());
  });
  test('rejects unsafe paths, headers, methods and unknown fields', () => {
    const cfg = alphaIntegration();
    const { errors } = validateIntegrationConfig({
      ...cfg,
      base_url: 'https://user:pw@x.example.com/api',
      endpoints: { report: { path: '/admin/../secret?x=1', method: 'DELETE' } },
      extra_headers: [{ name: 'Host', value: 'internal' }, { name: 'X-Trace', value: 'a\r\nInjected: 1' }],
      mappings: { ...cfg.mappings, daily: { ...cfg.mappings.daily, not_a_field: { path: 'x' }, new_subscribers: { path: '__proto__.x' } } }
    });
    const fields = errors.map(e => e.field);
    for (const f of ['base_url', 'endpoints.report.path', 'endpoints.report.method', 'extra_headers.0.name', 'extra_headers.1.value', 'mappings.daily.not_a_field', 'mappings.daily.new_subscribers']) {
      assert.ok(fields.includes(f), `expected error for ${f}; got ${fields.join(', ')}`);
    }
  });
  test('endpoint path rules', () => {
    assert.equal(validateEndpointPath('/admin/dashboard'), null);
    assert.ok(validateEndpointPath('admin'));
    assert.ok(validateEndpointPath('/a//b'));
    assert.ok(validateEndpointPath('/a/%2e%2e/b'));
    assert.ok(validateEndpointPath('/a?b=1'));
  });
  test('api key header cannot be a forbidden header', () => {
    const { errors } = validateIntegrationConfig({ ...betaIntegration(), auth: { type: 'api_key', header_name: 'Cookie' } });
    assert.ok(errors.some(e => e.field === 'auth.header_name'));
  });
});

describe('Dynamic request parameter mapping', () => {
  test('ALPHA uses fromDate/toDate/report/page/limit with ISO dates', () => {
    const cfg = valid(alphaIntegration());
    const built = buildReportRequest(cfg, { reportType: 'renewals', from: '2026-10-01', to: '2026-10-13', page: 2, limit: 50 }, 'Africa/Accra');
    assert.equal(built.method, 'GET');
    assert.equal(built.url, 'https://alpha.example.test/api/admin/dashboard?fromDate=2026-10-01&toDate=2026-10-13&report=renewal&page=2&limit=50');
  });
  test('BETA uses start_date/end_date/type/offset/per_page with DD/MM/YYYY dates', () => {
    const cfg = valid(betaIntegration());
    const built = buildReportRequest(cfg, { reportType: 'churn', from: '2026-10-01', to: '2026-10-13', offset: 25, limit: 25 }, 'Africa/Lagos');
    const url = new URL(built.url);
    assert.equal(url.pathname, '/v2/reports/kpis');
    assert.deepEqual(Object.fromEntries(url.searchParams), { start_date: '01/10/2026', end_date: '13/10/2026', type: 'cancellations', offset: '25', per_page: '25' });
  });
  test('unconfigured report types are refused rather than guessed', () => {
    const cfg = valid(betaIntegration());
    assert.throws(() => buildReportRequest(cfg, { reportType: 'renewals', from: '2026-10-01', to: '2026-10-02' }), { code: 'UNSUPPORTED_REPORT' });
  });
  test('exclusive end-date APIs receive the following day', () => {
    const cfg = valid({ ...alphaIntegration(), end_date_mode: 'exclusive' });
    const built = buildReportRequest(cfg, { from: '2026-10-01', to: '2026-10-31' });
    assert.equal(new URL(built.url).searchParams.get('toDate'), '2026-11-01');
  });
  test('datetime parameters respect the business timezone day boundaries', () => {
    const cfg = valid({ ...alphaIntegration(), date_param_format: 'iso_datetime' });
    const built = buildReportRequest(cfg, { from: '2026-10-01', to: '2026-10-01' }, 'Asia/Kolkata');
    const q = new URL(built.url).searchParams;
    assert.equal(q.get('fromDate'), '2026-09-30T18:30:00.000Z');
    assert.equal(q.get('toDate'), '2026-10-01T18:29:59.999Z');
    assert.equal(new Date(zonedDayStart('2026-03-29', 'Europe/London')).toISOString(), '2026-03-29T00:00:00.000Z');
  });
  test('POST endpoints send parameters as a JSON body', () => {
    const cfg = valid({ ...alphaIntegration(), endpoints: { report: { path: '/admin/dashboard', method: 'POST' } } });
    const built = buildReportRequest(cfg, { from: '2026-10-01', to: '2026-10-02' });
    assert.equal(built.url, 'https://alpha.example.test/api/admin/dashboard');
    assert.deepEqual(JSON.parse(built.body), { fromDate: '2026-10-01', toDate: '2026-10-02', report: 'all' });
  });
});

describe('Response normalisation', () => {
  const base = {
    response: { daily_path: 'data.daily', summary_path: 'data.totals', records_path: '' },
    mappings: {
      daily: { report_date: { path: 'd', type: 'date', format: 'YYYY-MM-DD' }, new_subscribers: { path: 'n', type: 'integer' }, grand_total: { path: 'm.total', type: 'decimal' } },
      summary: { grand_total: { path: 'revenue', type: 'decimal' } },
      records: {}
    }
  };

  for (const [label, wrap, path] of [
    ['data envelope', body => ({ data: body }), 'data'],
    ['result envelope', body => ({ result: body }), 'result'],
    ['payload envelope', body => ({ payload: body }), 'payload']
  ]) {
    test(`supports a configurable ${label}`, () => {
      const cfg = { ...base, response: { daily_path: `${path}.daily`, summary_path: `${path}.totals` } };
      const out = normalizeResponse(wrap({ daily: [{ d: '2026-10-01', n: '5', m: { total: '10.50' } }], totals: { revenue: 10.5 } }), cfg);
      assert.deepEqual(out.daily.rows, [{ report_date: '2026-10-01', new_subscribers: 5, grand_total: 10.5 }]);
      assert.equal(out.summary.values.grand_total, 10.5);
    });
  }

  test('root-level arrays via "$"', () => {
    const cfg = { response: { daily_path: '$' }, mappings: { daily: { report_date: { path: 'd', type: 'date', format: 'YYYY-MM-DD' } } } };
    assert.equal(normalizeResponse([{ d: '2026-10-01' }], cfg).daily.rows.length, 1);
  });
  test('missing optional fields become null and are counted, not zeroed', () => {
    const out = normalizeResponse({ data: { daily: [{ d: '2026-10-01' }], totals: {} } }, base);
    assert.equal(out.daily.rows[0].new_subscribers, null);
    assert.equal(out.fieldStats.daily.new_subscribers.missing, 1);
    assert.equal(out.summary.values.grand_total, null);
  });
  test('unparseable values fail loudly', () => {
    assert.throws(() => normalizeResponse({ data: { daily: [{ d: '2026-10-01', n: 'lots' }], totals: {} } }, base), { code: 'UNEXPECTED_SCHEMA' });
    assert.throws(() => normalizeResponse({ data: { daily: [{ d: '01-10-2026' }], totals: {} } }, base), { code: 'MISSING_REQUIRED_FIELDS' });
  });
  test('missing containers and wrong types are schema errors, not empty reports', () => {
    assert.throws(() => normalizeResponse({ data: {} }, base), { code: 'UNEXPECTED_SCHEMA' });
    assert.throws(() => normalizeResponse({ data: { daily: {}, totals: {} } }, base), { code: 'UNEXPECTED_SCHEMA' });
  });
  test('an empty array is a valid empty report', () => {
    const out = normalizeResponse({ data: { daily: [], totals: { revenue: 0 } } }, base);
    assert.equal(out.daily.present, true);
    assert.equal(out.daily.rows.length, 0);
    assert.equal(out.summary.values.grand_total, 0);
  });
  test('success flag false is an API-reported failure', () => {
    const cfg = { ...base, response: { ...base.response, success_path: 'ok', success_value: true, error_message_path: 'err' } };
    assert.throws(() => normalizeResponse({ ok: false, err: 'db down' }, cfg), err => err.code === 'API_REPORTED_FAILURE' && err.message.includes('db down'));
  });
  test('duplicate dates are rejected', () => {
    assert.throws(() => normalizeResponse({ data: { daily: [{ d: '2026-10-01' }, { d: '2026-10-01' }], totals: {} } }, base), { code: 'UNEXPECTED_SCHEMA' });
  });
});
