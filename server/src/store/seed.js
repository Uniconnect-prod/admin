import bcrypt from 'bcryptjs';
import { col, COLLECTIONS, nextSequence } from './index.js';
import { config } from '../config/index.js';

export const DEFAULT_ROLES = [
  { id: 1, name: 'Super Admin', description: 'All platforms, platform configuration, user administration and audit logs' },
  { id: 2, name: 'Platform Admin', description: 'Full reporting access to assigned platforms, exports and read-only user list' },
  { id: 3, name: 'Author', description: 'Reporting access to assigned platforms (legacy content role)' },
  { id: 4, name: 'Analyst', description: 'Reporting and CSV export on assigned platforms' },
  { id: 5, name: 'Viewer', description: 'Read-only dashboards and reports on assigned platforms' }
];

const DEFAULT_COUNTRIES = [
  { id: 1, name: 'Ghana', code: 'GH', currency: 'GHS', default_timezone: 'Africa/Accra' },
  { id: 2, name: 'Nigeria', code: 'NG', currency: 'NGN', default_timezone: 'Africa/Lagos' },
  { id: 3, name: 'Kenya', code: 'KE', currency: 'KES', default_timezone: 'Africa/Nairobi' },
  { id: 4, name: 'Uganda', code: 'UG', currency: 'UGX', default_timezone: 'Africa/Kampala' },
  { id: 5, name: 'South Africa', code: 'ZA', currency: 'ZAR', default_timezone: 'Africa/Johannesburg' }
];

async function safeIndex(collection, spec, options) {
  try {
    await collection.createIndex(spec, options);
  } catch (err) {
    console.warn(`[Seed] Index ${JSON.stringify(spec)} skipped: ${err.message}`);
  }
}

/**
 * Idempotent bootstrap of reference data. Never modifies existing users or platforms.
 */
export async function seedReferenceData({ log = !config.isTest } = {}) {
  const roles = col(COLLECTIONS.roles);
  if ((await roles.countDocuments({})) === 0) {
    await roles.insertMany(DEFAULT_ROLES);
    if (log) console.log('[Seed] Roles created.');
  }

  const countries = col(COLLECTIONS.countries);
  if ((await countries.countDocuments({})) === 0) {
    const now = new Date();
    await countries.insertMany(DEFAULT_COUNTRIES.map(c => ({ ...c, status: 'ACTIVE', created_at: now, updated_at: now })));
    if (log) console.log('[Seed] Country profiles created.');
  }

  const users = col(COLLECTIONS.users);
  await safeIndex(users, { username: 1 }, { unique: true });
  await safeIndex(users, { email: 1 }, { unique: true });
  await safeIndex(users, { id: 1 }, { unique: true });
  await safeIndex(col(COLLECTIONS.platforms), { id: 1 }, { unique: true });
  await safeIndex(col(COLLECTIONS.platforms), { code: 1 }, { unique: true });
  await safeIndex(col(COLLECTIONS.access), { user_id: 1, platform_id: 1 });
  await safeIndex(countries, { id: 1 }, { unique: true });
  await safeIndex(countries, { code: 1 }, { unique: true });
  await safeIndex(col(COLLECTIONS.audit), { created_at: -1 });
  await safeIndex(col(COLLECTIONS.refreshTokens), { jti: 1 }, { unique: true });
  await safeIndex(col(COLLECTIONS.integrationLogs), { platform_id: 1, created_at: -1 });

  if ((await users.countDocuments({})) === 0) {
    const { username, email, name, password } = config.seedSuperAdmin;
    if (!password || password.length < 10) {
      console.warn('[Seed] No users exist. Set SEED_SUPER_ADMIN_PASSWORD (min 10 chars) to create the first Super Admin.');
      return;
    }
    const now = new Date();
    const id = await nextSequence(COLLECTIONS.users);
    await users.insertOne({
      id,
      name,
      email,
      username,
      password_hash: await bcrypt.hash(password, 12),
      status: 'ACTIVE',
      is_super_admin: true,
      country: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });
    if (log) console.log(`[Seed] First Super Admin '${username}' created from SEED_SUPER_ADMIN_* settings.`);
  }
}
