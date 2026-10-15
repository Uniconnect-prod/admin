import { config } from '../config/index.js';
import { createMemoryStore } from './memoryStore.js';
import { createPgStore } from './pgStore.js';

/**
 * Reporting administration store.
 *
 * Holds application-owned data only: admin users, roles, platform access windows,
 * platform/API integration configuration, encrypted integration secrets, audit logs,
 * connection history and refresh tokens. Platform reporting data is NOT stored here;
 * it is fetched from each platform's API at request time.
 */

let activeStore = null;

export async function initStore({ kind = config.reportingStore, uri = config.databaseUrl } = {}) {
  if (kind === 'memory') {
    activeStore = createMemoryStore();
    if (!config.isTest) {
      console.warn('[Store] Using IN-MEMORY reporting store. Data is lost on restart (development only).');
    }
  } else {
    activeStore = await createPgStore(uri || config.databaseUrl);
    await activeStore.ensureAllTables(Object.values(COLLECTIONS));
  }
  return activeStore;
}

export function setStore(store) {
  activeStore = store;
  return activeStore;
}

export function getStore() {
  if (!activeStore) throw new Error('[Store] Reporting store has not been initialised.');
  return activeStore;
}

export function col(name) {
  return getStore().collection(name);
}

export const COLLECTIONS = {
  users: 'admin_users',
  roles: 'admin_roles',
  access: 'admin_platform_access',
  platforms: 'admin_platforms',
  countries: 'admin_countries',
  audit: 'admin_audit_logs',
  refreshTokens: 'admin_refresh_tokens',
  integrationLogs: 'admin_integration_logs',
  settings: 'admin_settings',
  counters: 'admin_counters'
};

/**
 * Atomic integer id sequence. Falls back to max(id)+1 the first time a sequence is used,
 * so existing collections keep their current numbering.
 */
export async function nextSequence(collectionName) {
  const counters = col(COLLECTIONS.counters);
  const existing = await counters.findOne({ _id: collectionName });
  if (!existing) {
    const top = await col(collectionName).find({}).sort({ id: -1 }).limit(1).toArray();
    const start = Number(top[0]?.id) || 0;
    try {
      await counters.insertOne({ _id: collectionName, value: start });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  const updated = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return updated.value;
}
