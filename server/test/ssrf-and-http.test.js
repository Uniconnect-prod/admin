import './helpers/env.js';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { isPrivateAddress, isBlockedHostname, checkUrlPolicy, hostMatches, createGuardedLookup, normalizeAllowlistEntry } from '../src/integrations/ssrfGuard.js';
import { safeRequest } from '../src/integrations/httpClient.js';

const policy = { allowedHosts: ['api.example.com', '*.partner.example.org'], allowPrivateHosts: [], allowHttpHosts: [] };

describe('SSRF guard: address classification', () => {
  test('blocks loopback, private, link-local, CGNAT, metadata and reserved IPv4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1']) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });
  test('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '41.66.200.10']) assert.equal(isPrivateAddress(ip), false, ip);
  });
  test('blocks private IPv6 and IPv4-mapped/NAT64/6to4 forms of private IPv4', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::a9fe:a9fe', '2002:7f00:0001::1', '2001:db8::1']) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });
  test('allows public IPv6', () => {
    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
    assert.equal(isPrivateAddress('2a00:1450:4001:81a::200e'), false);
  });
  test('treats non-IPs as unsafe', () => {
    assert.equal(isPrivateAddress('not-an-ip'), true);
  });
  test('blocks internal hostnames', () => {
    for (const h of ['localhost', 'api.localhost', 'metadata.google.internal', 'printer.local', 'svc.cluster.local', 'db.internal']) assert.equal(isBlockedHostname(h), true, h);
    assert.equal(isBlockedHostname('api.example.com'), false);
  });
});

describe('SSRF guard: URL policy', () => {
  test('accepts approved https hosts, including wildcard entries', () => {
    assert.equal(checkUrlPolicy('https://api.example.com/v1/x', policy).hostname, 'api.example.com');
    assert.equal(checkUrlPolicy('https://eu.partner.example.org/data', policy).hostname, 'eu.partner.example.org');
  });
  test('rejects hosts that are not approved', () => {
    assert.throws(() => checkUrlPolicy('https://evil.example.net/', policy), { code: 'HOST_NOT_APPROVED' });
    assert.throws(() => checkUrlPolicy('https://partner.example.org/', policy), { code: 'HOST_NOT_APPROVED' });
  });
  test('rejects plain http, credentials in URL, odd ports and junk', () => {
    assert.throws(() => checkUrlPolicy('http://api.example.com/', policy), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://user:pw@api.example.com/', policy), { code: 'INVALID_URL' });
    assert.throws(() => checkUrlPolicy('https://api.example.com:8443/', policy), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('not a url', policy), { code: 'INVALID_URL' });
    assert.throws(() => checkUrlPolicy('file:///etc/passwd', policy), { code: 'BLOCKED_DESTINATION' });
  });
  test('rejects private IP literals and decimal/hex encodings of loopback even if approved', () => {
    const p = { ...policy, allowedHosts: [...policy.allowedHosts, '127.0.0.1', '169.254.169.254'] };
    assert.throws(() => checkUrlPolicy('https://127.0.0.1/', p), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://2130706433/', p), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://0x7f.0.0.1/', p), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://169.254.169.254/latest/meta-data', p), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://[::1]/', p), { code: 'BLOCKED_DESTINATION' });
    assert.throws(() => checkUrlPolicy('https://localhost/', { ...p, allowedHosts: ['localhost'] }), { code: 'BLOCKED_DESTINATION' });
  });
  test('explicit private exceptions and http hosts are honoured', () => {
    const p = { allowedHosts: [], allowPrivateHosts: ['127.0.0.1:5055'], allowHttpHosts: ['127.0.0.1:5055'] };
    assert.equal(checkUrlPolicy('http://127.0.0.1:5055/api', p).allowPrivate, true);
    assert.throws(() => checkUrlPolicy('http://127.0.0.1:5056/api', p), { code: 'BLOCKED_DESTINATION' });
  });
  test('host matching and allow-list normalisation', () => {
    assert.equal(hostMatches('*.example.com', 'a.example.com', 443), true);
    assert.equal(hostMatches('*.example.com', 'example.com', 443), false);
    assert.equal(hostMatches('api.example.com:8443', 'api.example.com', 8443), true);
    assert.equal(hostMatches('api.example.com:8443', 'api.example.com', 443), false);
    assert.equal(normalizeAllowlistEntry(' API.Example.com '), 'api.example.com');
    assert.equal(normalizeAllowlistEntry('https://api.example.com'), null);
    assert.equal(normalizeAllowlistEntry('api.example.com/path'), null);
  });
  test('guarded DNS lookup rejects names resolving to private addresses (DNS rebinding)', async () => {
    const fakeResolver = (host, opts, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    const lookup = createGuardedLookup({ resolver: fakeResolver });
    await assert.rejects(new Promise((resolve, reject) => lookup('rebind.example.com', {}, (err, addr) => (err ? reject(err) : resolve(addr)))), { code: 'EBLOCKEDDEST' });
    const okLookup = createGuardedLookup({ resolver: (h, o, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]) });
    const addr = await new Promise((resolve, reject) => okLookup('ok.example.com', {}, (err, a) => (err ? reject(err) : resolve(a))));
    assert.equal(addr, '93.184.216.34');
  });
});

describe('HTTP client against a real local server', () => {
  let server;
  let port;
  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/ok') { res.setHeader('content-type', 'application/json'); return res.end('{"ok":true}'); }
      if (req.url === '/slow') return setTimeout(() => res.end('{}'), 2000);
      if (req.url === '/big') { res.setHeader('content-type', 'application/json'); return res.end(`"${'x'.repeat(50000)}"`); }
      if (req.url === '/bomb') {
        res.setHeader('content-encoding', 'gzip');
        return res.end(zlib.gzipSync(Buffer.alloc(200000, 32)));
      }
      if (req.url === '/redirect-internal') { res.statusCode = 302; res.setHeader('location', 'http://169.254.169.254/latest'); return res.end(); }
      if (req.url === '/redirect-self') { res.statusCode = 302; res.setHeader('location', '/ok'); return res.end(); }
      if (req.url === '/echo-auth') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ auth: req.headers.authorization || null })); }
      res.statusCode = 404;
      res.end();
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });
  after(() => new Promise(r => server.close(r)));

  const localPolicy = () => ({ allowedHosts: [], allowPrivateHosts: [`127.0.0.1:${port}`], allowHttpHosts: [`127.0.0.1:${port}`] });
  const spec = (path, extra = {}) => ({ method: 'GET', url: `http://127.0.0.1:${port}${path}`, timeoutMs: 1000, maxBytes: 20000, ...extra });

  test('loopback is blocked unless explicitly excepted', async () => {
    await assert.rejects(safeRequest(spec('/ok'), { policy: { allowedHosts: ['127.0.0.1'], allowPrivateHosts: [], allowHttpHosts: [] } }), { code: 'BLOCKED_DESTINATION' });
    const res = await safeRequest(spec('/ok'), { policy: localPolicy() });
    assert.equal(res.status, 200);
    assert.equal(res.body.toString(), '{"ok":true}');
  });
  test('enforces the timeout', async () => {
    await assert.rejects(safeRequest(spec('/slow', { timeoutMs: 200 }), { policy: localPolicy() }), { code: 'TIMEOUT' });
  });
  test('enforces the response size limit, including after decompression', async () => {
    await assert.rejects(safeRequest(spec('/big'), { policy: localPolicy() }), { code: 'RESPONSE_TOO_LARGE' });
    await assert.rejects(safeRequest(spec('/bomb'), { policy: localPolicy() }), { code: 'RESPONSE_TOO_LARGE' });
  });
  test('re-validates every redirect hop', async () => {
    await assert.rejects(safeRequest(spec('/redirect-internal'), { policy: localPolicy() }), err => ['BLOCKED_DESTINATION', 'HOST_NOT_APPROVED'].includes(err.code));
    const res = await safeRequest(spec('/redirect-self'), { policy: localPolicy() });
    assert.equal(res.status, 200);
    assert.equal(res.redirected, true);
  });
  test('only GET and POST are permitted', async () => {
    await assert.rejects(safeRequest(spec('/ok', { method: 'DELETE' }), { policy: localPolicy() }), { code: 'INVALID_CONFIGURATION' });
  });
  test('connection refused is classified', async () => {
    const p = { allowedHosts: [], allowPrivateHosts: ['127.0.0.1:1'], allowHttpHosts: ['127.0.0.1:1'] };
    await assert.rejects(safeRequest({ method: 'GET', url: 'http://127.0.0.1:1/', timeoutMs: 1000, maxBytes: 1000 }, { policy: p }), { code: 'CONNECTION_ERROR' });
  });
  test('abort signal cancels the request', async () => {
    const ac = new AbortController();
    const pending = safeRequest(spec('/slow', { signal: ac.signal, timeoutMs: 5000 }), { policy: localPolicy() });
    setTimeout(() => ac.abort(), 50);
    await assert.rejects(pending, { name: 'AbortError' });
  });
});
