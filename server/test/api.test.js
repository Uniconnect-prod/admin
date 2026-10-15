import './helpers/env.js';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, provisionPlatform } from './helpers/harness.js';
import { alphaIntegration, betaIntegration, ALPHA, BETA, dayMetrics, daysInRange, recordsFor } from './fixtures/mockPlatformApi.js';
import { col, COLLECTIONS } from '../src/store/index.js';

const FROM = '2026-09-01';
const TO = '2026-09-14';
const ALPHA_MODULES = ['overview', 'settlement', 'revenue', 'subscribers', 'subscriber_records', 'renewals', 'churn'];
const BETA_MODULES = ['overview', 'settlement', 'revenue', 'subscribers', 'subscriber_records', 'churn'];

let h;
let rootToken;
let alpha;
let beta;

before(async () => {
  h = await startHarness();
  rootToken = (await h.login()).body.data.token;
  alpha = await provisionPlatform(h, rootToken, {
    code: 'ALPHA_GH', name: 'Alpha Winnings', integration: alphaIntegration(),
    secrets: { username: ALPHA.email, password: ALPHA.password }, modules: ALPHA_MODULES, from: FROM, to: TO
  });
  beta = await provisionPlatform(h, rootToken, {
    code: 'BETA_NG', name: 'Beta Streams', integration: betaIntegration(), secrets: { api_key: BETA.apiKey },
    modules: BETA_MODULES, timezone: 'Africa/Lagos', currency: 'NGN', country: 'Nigeria', from: FROM, to: TO
  });
});

after(async () => {
  await h.close();
});

const custom = `range=custom&from=${FROM}&to=${TO}`;

describe('Authentication', () => {
  test('wrong password and unknown user get the same generic error', async () => {
    const a = await h.login('root', 'nope-nope-nope');
    const b = await h.login('ghost', 'nope-nope-nope');
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
  test('protected routes require a token', async () => {
    assert.equal((await h.request('GET', '/auth/me')).status, 401);
    assert.equal((await h.request('GET', '/reports/overview', { headers: { 'x-platform-code': 'ALPHA_GH' } })).status, 401);
  });
  test('refresh tokens rotate and reuse revokes the whole session family', async () => {
    const login = await h.login();
    const first = login.body.data.refreshToken;
    const r1 = await h.request('POST', '/auth/refresh', { body: { refreshToken: first } });
    assert.equal(r1.status, 200);
    const second = r1.body.data.refreshToken;
    assert.notEqual(second, first);
    const reuse = await h.request('POST', '/auth/refresh', { body: { refreshToken: first } });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, 'REFRESH_TOKEN_REUSED');
    const afterTheft = await h.request('POST', '/auth/refresh', { body: { refreshToken: second } });
    assert.equal(afterTheft.status, 401, 'legitimate token from the same family is revoked too');
  });
});

describe('Platform lifecycle and activation gating', () => {
  test('a new platform starts as DRAFT and cannot be activated before validation', async () => {
    const created = await h.request('POST', '/platform-management', { token: rootToken, body: { code: 'GAMMA', name: 'Gamma', business_timezone: 'UTC', enabled_modules: ['overview', 'settlement'] } });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, 'DRAFT');
    const id = created.body.data.id;
    const activate = await h.request('POST', `/platform-management/${id}/activate`, { token: rootToken });
    assert.equal(activate.status, 409);

    await h.request('PUT', `/platform-management/${id}/integration`, { token: rootToken, body: { integration: betaIntegration(), secrets: { api_key: BETA.apiKey } } });
    const stillBlocked = await h.request('POST', `/platform-management/${id}/activate`, { token: rootToken });
    assert.equal(stillBlocked.body.code, 'VALIDATION_REQUIRED');
  });
  test('HTTP 200 alone is not enough: wrong mappings fail validation', async () => {
    const created = await h.request('POST', '/platform-management', { token: rootToken, body: { code: 'DELTA', name: 'Delta', business_timezone: 'UTC', enabled_modules: ['overview', 'settlement'] } });
    const id = created.body.data.id;
    const broken = alphaIntegration();
    broken.mappings.daily.new_subscribers = { path: 'newSubs_WRONG' };
    await h.request('PUT', `/platform-management/${id}/integration`, { token: rootToken, body: { integration: broken, secrets: { username: ALPHA.email, password: ALPHA.password } } });
    const v = await h.request('POST', `/platform-management/${id}/validate`, { token: rootToken, body: { from: FROM, to: TO } });
    assert.equal(v.body.data.status, 'FAILED');
    assert.equal(v.body.data.checks.find(c => c.id === 'reachability').status, 'PASSED');
    assert.equal(v.body.data.checks.find(c => c.id === 'field_mapping').status, 'FAILED');
    assert.equal((await h.request('POST', `/platform-management/${id}/activate`, { token: rootToken })).status, 409);
  });
  test('enabled modules without mapped data fail the capability check', async () => {
    const created = await h.request('POST', '/platform-management', { token: rootToken, body: { code: 'EPSILON', name: 'Epsilon', business_timezone: 'UTC', enabled_modules: ['overview', 'renewals'] } });
    const id = created.body.data.id;
    await h.request('PUT', `/platform-management/${id}/integration`, { token: rootToken, body: { integration: betaIntegration(), secrets: { api_key: BETA.apiKey } } });
    const v = await h.request('POST', `/platform-management/${id}/validate`, { token: rootToken, body: { from: FROM, to: TO } });
    assert.equal(v.body.data.checks.find(c => c.id === 'capabilities').status, 'FAILED');
  });
  test('changing the configuration after validation requires re-validation', async () => {
    const id = beta.id;
    const changed = betaIntegration();
    changed.timeout_ms = 9000;
    await h.request('PUT', `/platform-management/${id}/integration`, { token: rootToken, body: { integration: changed } });
    const detail = await h.request('GET', `/platform-management/${id}`, { token: rootToken });
    assert.equal(detail.body.data.validation_current, false);
    assert.equal(detail.body.data.has_unpublished_changes, true);
    assert.equal(detail.body.data.status, 'ACTIVE', 'published configuration keeps serving reports');
    assert.equal((await h.request('POST', `/platform-management/${id}/activate`, { token: rootToken })).body.code, 'VALIDATION_REQUIRED');
    await h.request('PUT', `/platform-management/${id}/integration`, { token: rootToken, body: { integration: betaIntegration() } });
  });
  test('secrets are never returned by any API', async () => {
    const list = await h.request('GET', '/platform-management', { token: rootToken });
    const detail = await h.request('GET', `/platform-management/${alpha.id}`, { token: rootToken });
    const platforms = await h.request('GET', '/platforms', { token: rootToken });
    for (const res of [list, detail, platforms]) {
      for (const secret of [ALPHA.password, ALPHA.email, BETA.apiKey, ALPHA.token]) assert.equal(res.text.includes(secret), false, `leaked ${secret}`);
      assert.equal(res.text.includes('integration_secrets'), false);
    }
    assert.equal(detail.body.data.secrets_configured.password, true);
    const stored = await col(COLLECTIONS.platforms).findOne({ id: alpha.id });
    assert.equal(JSON.stringify(stored.integration_secrets).includes(ALPHA.password), false, 'stored encrypted');
  });
  test('unapproved hosts are rejected at inspection time', async () => {
    const created = await h.request('POST', '/platform-management', { token: rootToken, body: { code: 'ZETA', name: 'Zeta', business_timezone: 'UTC' } });
    const res = await h.request('POST', `/platform-management/${created.body.data.id}/inspect`, { token: rootToken, body: { integration: { ...betaIntegration(), base_url: 'https://evil.example.net' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ok, false);
    assert.equal(res.body.data.error.code, 'HOST_NOT_APPROVED');
  });
  test('inspection returns a sanitised preview, detected structure and pagination candidates', async () => {
    const res = await h.request('POST', `/platform-management/${alpha.id}/inspect`, { token: rootToken, body: { from: FROM, to: '2026-09-02', reportType: 'subscribers' } });
    const d = res.body.data;
    assert.equal(d.ok, true);
    assert.equal(d.status, 200);
    assert.ok(d.structure.containers.some(c => c.path === 'daily' && c.kind === 'array'));
    assert.ok(d.structure.paginationCandidates.some(c => c.path === 'total'));
    const firstRecord = d.preview.data[0];
    assert.match(firstRecord.msisdn, /•/, 'MSISDN masked in preview');
    assert.equal(res.text.includes(ALPHA.token), false);
  });
  test('only Super Admins can manage platforms', async () => {
    await h.createUser({ username: 'pa_alpha', roleName: 'Platform Admin', platformIds: [alpha.id] });
    const token = (await h.login('pa_alpha')).body.data.token;
    assert.equal((await h.request('GET', '/platform-management', { token })).status, 403);
    assert.equal((await h.request('POST', '/platform-management', { token, body: { code: 'X1', name: 'X', business_timezone: 'UTC' } })).status, 403);
    assert.equal((await h.request('PUT', `/platform-management/${alpha.id}/integration`, { token, body: { integration: alphaIntegration() } })).status, 403);
  });
  test('configuration changes, tests, validations and activations are audited', async () => {
    const logs = await h.request('GET', '/audit-logs?limit=100', { token: rootToken });
    const actions = new Set(logs.body.data.records.map(r => r.action));
    for (const a of ['CREATE_PLATFORM', 'UPDATE_INTEGRATION', 'VALIDATE_PLATFORM', 'ACTIVATE_PLATFORM', 'TEST_PLATFORM_API']) assert.ok(actions.has(a), a);
    const history = await h.request('GET', `/platform-management/${alpha.id}/history`, { token: rootToken });
    assert.ok(history.body.data.records.some(r => r.kind === 'VALIDATION' && r.ok));
  });
});

describe('Reports through the registered API integration', () => {
  test('activated platforms appear automatically in the selector', async () => {
    const res = await h.request('GET', '/platforms', { token: rootToken });
    const codes = res.body.data.map(p => p.code);
    assert.ok(codes.includes('ALPHA_GH') && codes.includes('BETA_NG'));
    assert.ok(!codes.includes('GAMMA'), 'draft platforms are not selectable');
    assert.equal(res.body.data.find(p => p.code === 'ALPHA_GH').integration_ready, true);
  });
  test('overview KPIs come from the API with provenance', async () => {
    const res = await h.request('GET', `/reports/overview?${custom}`, { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 200);
    const kpi = Object.fromEntries(res.body.data.kpis.map(k => [k.key, k]));
    const expectedNew = daysInRange(FROM, TO).reduce((s, d) => s + dayMetrics('alpha', d).newSubscribers, 0);
    const expectedRev = daysInRange(FROM, TO).reduce((s, d) => s + dayMetrics('alpha', d).grandCents, 0) / 100;
    assert.equal(kpi.new_subscribers.value, expectedNew);
    assert.equal(kpi.new_subscribers.provenance, 'api');
    assert.equal(kpi.grand_total.value, expectedRev);
    assert.equal(kpi.renewal_rate.provenance, 'calculated');
    assert.equal(kpi.subscriber_count.provenance, 'unavailable');
    assert.equal(res.body.data.settlement.rows.length, 14);
    assert.ok(res.body.data.reconciliation.every(r => r.matches));
    assert.equal(res.body.data.dataSource.host, ALPHA.host);
  });
  test('second platform with different parameters and envelope works through the same engine', async () => {
    const res = await h.request('GET', `/reports/settlement?${custom}`, { token: rootToken, headers: { 'x-platform-code': 'BETA_NG' } });
    assert.equal(res.status, 200);
    const s = res.body.data.settlement;
    assert.equal(s.rows.length, 14);
    assert.equal(s.columns.find(c => c.key === 'grand_total').label, 'Revenue');
    assert.equal(s.columns.find(c => c.key === 'activation_parking').available, false);
    const expected = daysInRange(FROM, TO).reduce((sum, d) => sum + dayMetrics('beta', d).grandCents, 0) / 100;
    assert.equal(s.totals.grand_total, expected);
  });
  test('upstream failures are returned as errors, never as zero-valued reports', async () => {
    h.intercept = req => (req.url.hostname === BETA.host ? { status: 500, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"status":"error"}') } : null);
    try {
      const res = await h.request('GET', '/reports/overview?range=custom&from=2026-08-01&to=2026-08-05&fresh=1', { token: rootToken, headers: { 'x-platform-code': 'BETA_NG' } });
      assert.equal(res.status, 502);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'UPSTREAM_ERROR');
      assert.equal(res.body.kpis, undefined);
    } finally {
      h.intercept = null;
    }
    const detail = await h.request('GET', `/platform-management/${beta.id}`, { token: rootToken });
    assert.equal(detail.body.data.integration_health.last_error_code, 'HTTP_500');
  });
  test('invalid date ranges are rejected', async () => {
    const res = await h.request('GET', '/reports/overview?range=custom&from=2026-09-10&to=2026-09-01', { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_DATE');
  });
  test('consolidated view aggregates only compatible metrics and keeps currencies apart', async () => {
    const res = await h.request('GET', `/reports/overview?${custom}`, { token: rootToken, headers: { 'x-platform-code': 'ALL' } });
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.scope, 'ALL');
    assert.deepEqual(d.revenue.map(r => r.currency).sort(), ['GHS', 'NGN']);
    const newSubs = d.totals.find(t => t.key === 'new_subscribers');
    const expected = daysInRange(FROM, TO).reduce((s, day) => s + dayMetrics('alpha', day).newSubscribers + dayMetrics('beta', day).newSubscribers, 0);
    assert.equal(newSubs.value, expected);
    assert.equal(newSubs.label, 'New subscribers', 'platform-specific column labels must not leak into consolidated totals');
    assert.equal(d.totals.some(t => t.key === 'active_subscribers' || t.key === 'renewal_rate'), false);
    assert.ok(d.rules.length >= 4);
  });
  test('record lists use the source pagination', async () => {
    const res = await h.request('GET', `/reports/records?reportType=renewals&${custom}&page=2&pageSize=50`, { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 200);
    const all = recordsFor('alpha', 'renewal', daysInRange(FROM, TO));
    assert.equal(res.body.data.pagination.total, all.length);
    assert.equal(res.body.data.rows[0].record_id, all[50].id);
  });
  test('unsupported reports say so explicitly', async () => {
    const res = await h.request('GET', `/reports/section/renewals?${custom}`, { token: rootToken, headers: { 'x-platform-code': 'BETA_NG' } });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'MODULE_DISABLED');
  });
});

describe('Platform isolation and RBAC', () => {
  let viewerToken;
  before(async () => {
    await h.createUser({ username: 'viewer_alpha', roleName: 'Viewer', platformIds: [alpha.id] });
    viewerToken = (await h.login('viewer_alpha')).body.data.token;
  });
  test('users only see and can only switch to their authorised platforms', async () => {
    const res = await h.request('GET', '/platforms', { token: viewerToken });
    assert.deepEqual(res.body.data.map(p => p.code), ['ALPHA_GH']);
    const denied = await h.request('GET', `/reports/overview?${custom}`, { token: viewerToken, headers: { 'x-platform-code': 'BETA_NG' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'PLATFORM_ACCESS_DENIED');
    const byId = await h.request('GET', `/reports/overview?${custom}`, { token: viewerToken, headers: { 'x-platform-id': String(beta.id) } });
    assert.equal(byId.status, 403);
    const all = await h.request('GET', `/reports/overview?${custom}`, { token: viewerToken, headers: { 'x-platform-code': 'ALL' } });
    assert.equal(all.status, 403);
  });
  test('viewers can read reports but cannot export', async () => {
    assert.equal((await h.request('GET', `/reports/overview?${custom}`, { token: viewerToken, headers: { 'x-platform-code': 'ALPHA_GH' } })).status, 200);
    assert.equal((await h.request('GET', `/export/settlement?${custom}`, { token: viewerToken, headers: { 'x-platform-code': 'ALPHA_GH' } })).status, 403);
  });
  test('expired access is rejected on every request, not just at login', async () => {
    const user = await h.createUser({ username: 'expiring', roleName: 'Analyst', platformIds: [alpha.id] });
    const token = (await h.login('expiring')).body.data.token;
    assert.equal((await h.request('GET', `/reports/overview?${custom}`, { token, headers: { 'x-platform-code': 'ALPHA_GH' } })).status, 200);
    await col(COLLECTIONS.access).updateMany({ user_id: user.id }, { $set: { end_date: new Date(Date.now() - 1000).toISOString() } });
    const res = await h.request('GET', `/reports/overview?${custom}`, { token, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 403);
  });
  test('upcoming-only users cannot sign in', async () => {
    await h.createUser({ username: 'future', roleName: 'Viewer', platformIds: [alpha.id], start: 5, end: 30 });
    const res = await h.login('future');
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PLATFORM_ACCESS_UPCOMING');
  });
  test('disabled platforms disappear from selectors and reject report requests', async () => {
    const created = await provisionPlatform(h, rootToken, {
      code: 'THETA', name: 'Theta', integration: betaIntegration(), secrets: { api_key: BETA.apiKey },
      modules: ['overview', 'settlement'], from: FROM, to: TO
    });
    await h.request('POST', `/platform-management/${created.id}/disable`, { token: rootToken });
    const list = await h.request('GET', '/platforms', { token: rootToken });
    assert.equal(list.body.data.some(p => p.code === 'THETA'), false);
    const res = await h.request('GET', `/reports/overview?${custom}`, { token: rootToken, headers: { 'x-platform-code': 'THETA' } });
    assert.equal(res.status, 404);
  });
  test('Platform Admins see only users of the platforms they administer', async () => {
    const token = (await h.login('pa_alpha')).body.data.token;
    const res = await h.request('GET', '/users', { token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.every(u => u.platforms.every(p => p.platform_id === alpha.id)));
    assert.equal((await h.request('POST', '/users', { token, body: { name: 'x', email: 'x@x.io', username: 'xxx', password: 'aaaaaaaaaaaa' } })).status, 403);
  });
});

describe('CSV exports', () => {
  test('settlement export respects platform and date range with exact totals', async () => {
    const res = await h.request('GET', `/export/settlement?${custom}&view=revenue`, { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.equal(res.headers.get('x-export-complete'), 'true');
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(lines[0], 'Date,New Subscriber Num,Activation Parking,Super Winnings Daily (GHS),Super Winnings on-demand Daily (GHS),Grand Total (GHS)');
    assert.equal(lines.length, 1 + 14 + 1);
    const m = dayMetrics('alpha', '2026-09-01');
    assert.equal(lines[1], `2026-09-01,${m.newSubscribers},${m.activationParking},${(m.dailyCents / 100).toFixed(2)},${(m.ondemandCents / 100).toFixed(2)},${(m.grandCents / 100).toFixed(2)}`);
    const total = daysInRange(FROM, TO).reduce((s, d) => s + dayMetrics('alpha', d).grandCents, 0);
    assert.ok(lines.at(-1).endsWith(`,${(total / 100).toFixed(2)}`));
  });
  test('record export pages through the whole source dataset without duplicates', async () => {
    const res = await h.request('GET', `/export/records?reportType=renewals&${custom}`, { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
    assert.equal(res.status, 200);
    const all = recordsFor('alpha', 'renewal', daysInRange(FROM, TO));
    assert.equal(Number(res.headers.get('x-export-rows')), all.length);
    assert.equal(res.headers.get('x-export-complete'), 'true');
    const body = res.text.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(body.length, all.length + 1);
    assert.equal(new Set(body.slice(1).map(l => l.split(',')[0])).size, all.length);
  });
  test('a failure on any page fails the export instead of returning a partial file', async () => {
    h.intercept = (req) => (req.url.hostname === ALPHA.host && req.url.searchParams.get('page') === '2' ? { status: 503, headers: {}, body: Buffer.from('') } : null);
    try {
      const res = await h.request('GET', `/export/records?reportType=renewals&${custom}`, { token: rootToken, headers: { 'x-platform-code': 'ALPHA_GH' } });
      assert.equal(res.status, 502);
      assert.equal(res.body.code, 'UPSTREAM_ERROR');
    } finally {
      h.intercept = null;
    }
  });
  test('exports are audited', async () => {
    const logs = await h.request('GET', '/audit-logs?action=EXPORT_SETTLEMENT_CSV', { token: rootToken });
    assert.ok(logs.body.data.records.length >= 1);
  });
});
