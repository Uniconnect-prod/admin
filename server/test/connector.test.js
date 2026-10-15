import './helpers/env.js';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PlatformApiClient, setConnectorTransport, clearResponseCache, resetRateLimits } from '../src/integrations/connector.js';
import { clearTokenCache } from '../src/integrations/authStrategies.js';
import { validateIntegrationConfig } from '../src/integrations/configSchema.js';
import { createMockTransport, alphaIntegration, betaIntegration, ALPHA, BETA, dayMetrics, recordsFor, daysInRange } from './fixtures/mockPlatformApi.js';

const policy = { allowedHosts: [ALPHA.host, BETA.host], allowPrivateHosts: [], allowHttpHosts: [] };
const json = (status, body, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });

function client(kind, { intercept, calls = [], secrets, override = {} } = {}) {
  setConnectorTransport(createMockTransport({ intercept, calls }));
  const base = kind === 'alpha' ? alphaIntegration() : betaIntegration();
  const { config, errors } = validateIntegrationConfig({ ...base, ...override });
  assert.deepEqual(errors, []);
  return new PlatformApiClient({
    platform: { id: kind === 'alpha' ? 1 : 2, code: kind.toUpperCase(), business_timezone: kind === 'alpha' ? 'Africa/Accra' : 'Africa/Lagos' },
    config,
    secrets: secrets ?? (kind === 'alpha' ? { username: ALPHA.email, password: ALPHA.password } : { api_key: BETA.apiKey }),
    policy
  });
}

beforeEach(() => {
  clearTokenCache();
  clearResponseCache();
  resetRateLimits();
});

describe('Authentication strategies', () => {
  test('login_token: logs in once, caches the token and sends it as Bearer', async () => {
    const calls = [];
    const c = client('alpha', { calls });
    await c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-03' });
    await c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-04' });
    const logins = calls.filter(r => r.url.pathname.endsWith('/login'));
    assert.equal(logins.length, 1);
    assert.deepEqual(JSON.parse(logins[0].body), { email: ALPHA.email, password: ALPHA.password });
    assert.equal(calls.at(-1).headers.authorization, `Bearer ${ALPHA.token}`);
  });
  test('login_token: re-logs in once when the API returns 401 for an expired token', async () => {
    const calls = [];
    let rejected = false;
    const c = client('alpha', {
      calls,
      intercept: req => {
        if (req.url.pathname.endsWith('/dashboard') && !rejected) {
          rejected = true;
          return json(401, { success: false, message: 'jwt expired' });
        }
        return null;
      }
    });
    const snap = await c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-02' });
    assert.equal(snap.daily.rows.length, 2);
    assert.equal(calls.filter(r => r.url.pathname.endsWith('/login')).length, 2);
  });
  test('login_token: wrong credentials produce LOGIN_FAILED', async () => {
    const c = client('alpha', { secrets: { username: ALPHA.email, password: 'wrong' } });
    await assert.rejects(c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-02' }), { code: 'LOGIN_FAILED' });
  });
  test('api_key: key is sent in the configured header; a bad key is FORBIDDEN_UPSTREAM', async () => {
    const calls = [];
    await client('beta', { calls }).fetchSnapshot({ from: '2026-10-01', to: '2026-10-02' });
    assert.equal(calls[0].headers['x-api-key'], BETA.apiKey);
    await assert.rejects(client('beta', { secrets: { api_key: 'nope' } }).fetchSnapshot({ from: '2026-10-01', to: '2026-10-02' }), { code: 'FORBIDDEN_UPSTREAM' });
  });
  test('bearer: static token; missing token is reported before any request', async () => {
    const calls = [];
    const c = client('alpha', { calls, secrets: {}, override: { auth: { type: 'bearer' } } });
    await assert.rejects(c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-02' }), { code: 'AUTH_FAILED' });
    assert.equal(calls.length, 0);
    const ok = client('alpha', { secrets: { token: ALPHA.token }, override: { auth: { type: 'bearer' } } });
    assert.equal((await ok.fetchSnapshot({ from: '2026-10-01', to: '2026-10-01' })).daily.rows.length, 1);
  });
});

describe('Snapshot normalisation for two different platforms', () => {
  test('ALPHA daily rows and summary map to canonical fields', async () => {
    const snap = await client('alpha').fetchSnapshot({ from: '2026-09-01', to: '2026-09-14' });
    assert.equal(snap.daily.rows.length, 14);
    const m = dayMetrics('alpha', '2026-09-03');
    const row = snap.daily.rows.find(r => r.report_date === '2026-09-03');
    assert.equal(row.new_subscribers, m.newSubscribers);
    assert.equal(row.grand_total, m.grandCents / 100);
    assert.equal(snap.summary.values.new_subscribers, daysInRange('2026-09-01', '2026-09-14').reduce((s, d) => s + dayMetrics('alpha', d).newSubscribers, 0));
  });
  test('BETA nested string amounts with thousands separators and DD/MM/YYYY dates', async () => {
    const snap = await client('beta').fetchSnapshot({ from: '2026-09-01', to: '2026-09-03' });
    assert.deepEqual(snap.daily.rows.map(r => r.report_date), ['2026-09-01', '2026-09-02', '2026-09-03']);
    const m = dayMetrics('beta', '2026-09-02');
    assert.equal(snap.daily.rows[1].grand_total, m.grandCents / 100);
    assert.equal(snap.daily.rows[1].new_subscribers, m.newSubscribers);
  });
});

describe('Pagination', () => {
  test('page strategy (ALPHA) retrieves every record exactly once', async () => {
    const c = client('alpha');
    const all = recordsFor('alpha', 'renewal', daysInRange('2026-09-01', '2026-09-10'));
    const result = await c.collectRecords({ reportType: 'renewals', from: '2026-09-01', to: '2026-09-10' });
    assert.equal(result.rows.length, all.length);
    assert.equal(new Set(result.rows.map(r => r.record_id)).size, all.length);
    assert.equal(result.complete, true);
    assert.ok(result.pages >= 2);
  });
  test('offset strategy (BETA) retrieves every record exactly once', async () => {
    const c = client('beta');
    const all = recordsFor('beta', 'success', daysInRange('2026-09-01', '2026-09-05'));
    const result = await c.collectRecords({ reportType: 'subscribers', from: '2026-09-01', to: '2026-09-05' });
    assert.equal(result.rows.length, all.length);
    assert.equal(result.reportedTotal, all.length);
    assert.equal(result.complete, true);
  });
  test('an API that ignores the page parameter is detected', async () => {
    const c = client('alpha', {
      intercept: req => {
        if (!req.url.pathname.endsWith('/dashboard')) return null;
        req.url.searchParams.set('page', '1');
        return null;
      }
    });
    await assert.rejects(c.collectRecords({ reportType: 'renewals', from: '2026-09-01', to: '2026-09-10' }), { code: 'PAGINATION_ERROR' });
  });
  test('missing rows (reported total larger than returned) mark the export incomplete', async () => {
    const c = client('alpha', {
      intercept: req => {
        if (!req.url.pathname.endsWith('/dashboard')) return null;
        return json(200, { success: true, summary: {}, daily: [], data: [{ id: 'a', msisdn: '1', createdAt: '2026-09-01T00:00:00Z' }], total: 5 });
      }
    });
    const result = await c.collectRecords({ reportType: 'renewals', from: '2026-09-01', to: '2026-09-01' });
    assert.equal(result.complete, false);
    assert.equal(result.reportedTotal, 5);
  });
  test('duplicate record ids across pages are skipped and counted', async () => {
    let n = 0;
    const c = client('alpha', {
      override: { pagination: { ...alphaIntegration().pagination, page_size: 2, total_path: '' } },
      intercept: req => {
        if (!req.url.pathname.endsWith('/dashboard')) return null;
        n += 1;
        const pages = { 1: [{ id: 'a' }, { id: 'b' }], 2: [{ id: 'b' }, { id: 'c' }], 3: [] };
        return json(200, { success: true, summary: {}, daily: [], data: (pages[n] || []).map(r => ({ ...r, msisdn: '233', createdAt: '2026-09-01T00:00:00Z' })) });
      }
    });
    const result = await c.collectRecords({ reportType: 'renewals', from: '2026-09-01', to: '2026-09-01' });
    assert.deepEqual(result.rows.map(r => r.record_id), ['a', 'b', 'c']);
    assert.equal(result.duplicates, 1);
  });
  test('unbounded pagination is stopped at max_pages', async () => {
    const c = client('alpha', {
      override: { pagination: { ...alphaIntegration().pagination, page_size: 1, max_pages: 3, total_path: '' } },
      intercept: req => {
        if (!req.url.pathname.endsWith('/dashboard')) return null;
        const p = req.url.searchParams.get('page');
        return json(200, { success: true, summary: {}, daily: [], data: [{ id: `r${p}`, msisdn: '233', createdAt: '2026-09-01T00:00:00Z' }] });
      }
    });
    await assert.rejects(c.collectRecords({ reportType: 'renewals', from: '2026-09-01', to: '2026-09-01' }), { code: 'PAGINATION_ERROR' });
  });
});

describe('Failures are errors, never empty reports', () => {
  const cases = [
    ['HTTP 500', () => json(500, { success: false, message: 'boom' }), 'UPSTREAM_ERROR'],
    ['HTTP 503 HTML', () => ({ status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('<html>down</html>') }), 'UPSTREAM_ERROR'],
    ['HTTP 429', () => json(429, { message: 'slow down' }, { 'retry-after': '30' }), 'RATE_LIMITED'],
    ['HTTP 404', () => json(404, { message: 'nope' }), 'NOT_FOUND_UPSTREAM'],
    ['HTTP 403', () => json(403, { message: 'forbidden' }), 'FORBIDDEN_UPSTREAM'],
    ['invalid JSON', () => ({ status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"success":tru') }), 'INVALID_JSON'],
    ['HTML with 200', () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('<!doctype html><html></html>') }), 'INVALID_JSON'],
    ['empty body', () => ({ status: 200, headers: {}, body: Buffer.alloc(0) }), 'INVALID_JSON'],
    ['success:false', () => json(200, { success: false, message: 'Report engine unavailable' }), 'API_REPORTED_FAILURE'],
    ['schema drift', () => json(200, { success: true, summary: {}, days: [] }), 'UNEXPECTED_SCHEMA'],
    ['non-numeric value', () => json(200, { success: true, summary: {}, daily: [{ date: '2026-10-01', newSubscriptions: 'N/A' }] }), 'UNEXPECTED_SCHEMA']
  ];
  for (const [label, respond, code] of cases) {
    test(label, async () => {
      const c = client('alpha', { intercept: req => (req.url.pathname.endsWith('/dashboard') ? respond() : null) });
      await assert.rejects(c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-01' }), err => {
        assert.equal(err.code, code);
        if (code === 'RATE_LIMITED') assert.equal(err.retryAfterSeconds, 30);
        return true;
      });
    });
  }
  test('a valid empty response is returned as present-but-empty', async () => {
    const c = client('alpha', { intercept: req => (req.url.pathname.endsWith('/dashboard') ? json(200, { success: true, summary: { newSubscriptions: 0, renewals: 0, failed: 0, churn: 0, totalGhsAmount: 0 }, daily: [], data: [], total: 0 }) : null) });
    const snap = await c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-01' });
    assert.equal(snap.daily.present, true);
    assert.equal(snap.daily.rows.length, 0);
    assert.equal(snap.summary.values.grand_total, 0);
  });
  test('outbound rate limit protects the source API', async () => {
    const c = client('beta', { override: { rate_limit_per_minute: 2 } });
    await c.fetchSnapshot({ from: '2026-10-01', to: '2026-10-01' });
    await c.fetchSnapshot({ from: '2026-10-02', to: '2026-10-02' });
    await assert.rejects(c.fetchSnapshot({ from: '2026-10-03', to: '2026-10-03' }), { code: 'LOCAL_RATE_LIMITED' });
  });
});
