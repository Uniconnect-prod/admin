import './env.js';
import bcrypt from 'bcryptjs';
import { initStore, getStore, col, COLLECTIONS } from '../../src/store/index.js';
import { seedReferenceData } from '../../src/store/seed.js';
import { createApp } from '../../src/app.js';
import { userRepository } from '../../src/repositories/userRepository.js';
import { accessRepository } from '../../src/repositories/accessRepository.js';
import { settingsRepository } from '../../src/repositories/settingsRepository.js';
import { setConnectorTransport, clearResponseCache, resetRateLimits } from '../../src/integrations/connector.js';
import { clearTokenCache } from '../../src/integrations/authStrategies.js';
import { createMockTransport, ALPHA, BETA } from '../fixtures/mockPlatformApi.js';

export const PASSWORD = 'correct-horse-battery';

/**
 * Boots the real Express app on an ephemeral port against a fresh in-memory store,
 * with outbound platform calls routed to the synthetic mock APIs.
 */
export async function startHarness({ intercept = null } = {}) {
  await initStore({ kind: 'memory' });
  await seedReferenceData({ log: false });
  clearResponseCache();
  clearTokenCache();
  resetRateLimits();
  const calls = [];
  setConnectorTransport(createMockTransport({ intercept: (req, n) => (harness.intercept ? harness.intercept(req, n) : intercept?.(req, n)), calls }));
  await settingsRepository.setOutboundAllowlist([ALPHA.host, BETA.host], 0);

  const hash = await bcrypt.hash(PASSWORD, 4);
  const admin = await userRepository.create({ name: 'Root Admin', email: 'root@example.test', username: 'root', password_hash: hash, is_super_admin: true });

  const app = createApp({ disableRateLimits: true });
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const harness = {
    baseUrl,
    calls,
    admin,
    intercept: null,
    async request(method, path, { token, body, headers = {} } = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* CSV or empty */ }
      return { status: res.status, body: json, text, headers: res.headers };
    },
    async login(username = 'root', password = PASSWORD) {
      const res = await this.request('POST', '/auth/login', { body: { username, password } });
      return res;
    },
    async createUser({ username, roleName = 'Viewer', platformIds = [], start = -1, end = 30 }) {
      const user = await userRepository.create({ name: username, email: `${username}@example.test`, username, password_hash: hash });
      const role = await col(COLLECTIONS.roles).findOne({ name: roleName });
      const day = 86400000;
      await accessRepository.replaceForUser(user.id, platformIds.map(pid => ({
        platform_id: pid,
        role_id: role.id,
        start_date: new Date(Date.now() + start * day),
        end_date: new Date(Date.now() + end * day),
        status: 'ACTIVE'
      })), admin.id);
      return user;
    },
    async close() {
      await new Promise(resolve => server.close(resolve));
      await getStore().close();
    }
  };
  return harness;
}

/**
 * Create, configure, validate and activate a platform through the public API.
 */
export async function provisionPlatform(h, token, { code, name, integration, secrets, modules, timezone = 'Africa/Accra', currency = 'GHS', country = 'Ghana', from, to }) {
  const created = await h.request('POST', '/platform-management', {
    token,
    body: { code, name, business_timezone: timezone, currency, country, enabled_modules: modules }
  });
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
  const id = created.body.data.id;
  const saved = await h.request('PUT', `/platform-management/${id}/integration`, { token, body: { integration, secrets } });
  if (saved.status !== 200) throw new Error(`save failed: ${JSON.stringify(saved.body)}`);
  const validated = await h.request('POST', `/platform-management/${id}/validate`, { token, body: { from, to } });
  if (validated.body?.data?.status !== 'PASSED') throw new Error(`validation failed: ${JSON.stringify(validated.body?.data?.checks?.filter(c => c.status === 'FAILED'))}`);
  const activated = await h.request('POST', `/platform-management/${id}/activate`, { token });
  if (activated.status !== 200) throw new Error(`activation failed: ${JSON.stringify(activated.body)}`);
  return activated.body.data;
}
