import { col, COLLECTIONS, nextSequence } from '../store/index.js';
import { exactCaseInsensitive } from '../utils/errors.js';

export const REPORTING_MODULES = ['overview', 'settlement', 'revenue', 'subscribers', 'renewals', 'churn', 'subscriber_records'];

const LEGACY_MODULE_MAP = {
  Subscribers: ['subscribers', 'subscriber_records'],
  Renewals: ['renewals'],
  Churn: ['churn'],
  Revenue: ['revenue'],
  Reports: ['overview', 'settlement']
};

export function normalizeModules(modules) {
  if (!Array.isArray(modules)) return ['overview', 'settlement'];
  const out = new Set();
  for (const m of modules) {
    if (REPORTING_MODULES.includes(m)) out.add(m);
    else if (LEGACY_MODULE_MAP[m]) LEGACY_MODULE_MAP[m].forEach(x => out.add(x));
  }
  out.add('overview');
  return REPORTING_MODULES.filter(m => out.has(m));
}

export function normalizeStatus(status) {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'DISABLED' || status === 'INACTIVE') return 'DISABLED';
  return 'DRAFT';
}

function platforms() {
  return col(COLLECTIONS.platforms);
}

function hasLegacyMongoSource(p) {
  return Boolean(p.connection?.mongo_uri || p.mongo_uri || p.database_name || p.connection?.database_name);
}

/**
 * Explicit allow-list projection for Super Admin views. Secrets and legacy database
 * connection strings are never included.
 */
export function toAdminView(p) {
  if (!p) return null;
  const secrets = p.integration_secrets || {};
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description || '',
    logo_url: p.logo_url || '',
    accent_color: p.accent_color || '#2A58FF',
    country: p.country || null,
    business_timezone: p.business_timezone || 'UTC',
    currency: p.currency || null,
    enabled_modules: normalizeModules(p.enabled_modules),
    status: normalizeStatus(p.status),
    integration: p.integration || null,
    secrets_configured: {
      token: Boolean(secrets.token),
      api_key: Boolean(secrets.api_key),
      username: Boolean(secrets.username),
      password: Boolean(secrets.password)
    },
    secrets_updated_at: secrets.updated_at || null,
    published: p.published_integration
      ? {
          at: p.published_at || null,
          by: p.published_by || null,
          config_hash: p.published_config_hash || null
        }
      : null,
    validation: p.validation || { status: 'NOT_RUN' },
    integration_health: p.integration_health || null,
    legacy_source: hasLegacyMongoSource(p)
      ? { type: 'mongodb', database_name: p.connection?.database_name || p.database_name || null, note: 'Legacy direct-database source. Not used for reporting.' }
      : null,
    config_version: p.config_version || 1,
    created_at: p.created_at || null,
    updated_at: p.updated_at || null
  };
}

export const platformRepository = {
  async findByIdOrCode(idOrCode, { raw = true } = {}) {
    if (idOrCode === undefined || idOrCode === null || idOrCode === '') return null;
    const str = String(idOrCode).trim();
    const or = [{ code: exactCaseInsensitive(str) }];
    if (/^\d+$/.test(str)) or.push({ id: parseInt(str, 10) });
    const doc = await platforms().findOne({ $or: or });
    return raw ? doc : toAdminView(doc);
  },

  async findById(id) {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) return null;
    return platforms().findOne({ id: idNum });
  },

  async listAll() {
    return platforms().find({}).sort({ id: 1 }).toArray();
  },

  async listActive() {
    const all = await this.listAll();
    return all.filter(p => normalizeStatus(p.status) === 'ACTIVE');
  },

  async create(data, createdBy) {
    const code = String(data.code).trim().toUpperCase();
    const existing = await platforms().findOne({ code: exactCaseInsensitive(code) });
    if (existing) {
      const err = new Error(`A platform with code '${code}' already exists.`);
      err.code = 'DUPLICATE_CODE';
      throw err;
    }
    const now = new Date();
    const doc = {
      id: await nextSequence(COLLECTIONS.platforms),
      code,
      name: data.name,
      description: data.description || '',
      logo_url: data.logo_url || '',
      accent_color: data.accent_color || '#2A58FF',
      country: data.country || null,
      business_timezone: data.business_timezone || 'UTC',
      currency: data.currency || null,
      enabled_modules: normalizeModules(data.enabled_modules),
      status: 'DRAFT',
      integration: data.integration || null,
      integration_secrets: {},
      published_integration: null,
      validation: { status: 'NOT_RUN' },
      integration_health: {},
      config_version: 1,
      created_by: createdBy,
      created_at: now,
      updated_at: now
    };
    await platforms().insertOne(doc);
    return doc;
  },

  async updateDetails(id, fields) {
    const allowed = ['name', 'description', 'logo_url', 'accent_color', 'country', 'business_timezone', 'currency'];
    const set = { updated_at: new Date() };
    for (const key of allowed) if (fields[key] !== undefined) set[key] = fields[key];
    if (fields.enabled_modules !== undefined) set.enabled_modules = normalizeModules(fields.enabled_modules);
    await platforms().updateOne({ id: parseInt(id, 10) }, { $set: set });
    return this.findById(id);
  },

  async saveIntegrationDraft(id, integration) {
    await platforms().updateOne(
      { id: parseInt(id, 10) },
      { $set: { integration, updated_at: new Date() }, $inc: { config_version: 1 } }
    );
    return this.findById(id);
  },

  async saveSecrets(id, secrets) {
    await platforms().updateOne(
      { id: parseInt(id, 10) },
      { $set: { integration_secrets: { ...secrets, updated_at: new Date() }, updated_at: new Date() }, $inc: { config_version: 1 } }
    );
    return this.findById(id);
  },

  async saveValidation(id, validation) {
    await platforms().updateOne({ id: parseInt(id, 10) }, { $set: { validation, updated_at: new Date() } });
  },

  async publish(id, { integration, configHash, userId }) {
    const now = new Date();
    await platforms().updateOne(
      { id: parseInt(id, 10) },
      {
        $set: {
          status: 'ACTIVE',
          published_integration: integration,
          published_config_hash: configHash,
          published_at: now,
          published_by: userId,
          updated_at: now
        }
      }
    );
    return this.findById(id);
  },

  async setStatus(id, status) {
    await platforms().updateOne({ id: parseInt(id, 10) }, { $set: { status, updated_at: new Date() } });
    return this.findById(id);
  },

  async recordHealth(id, health) {
    const set = {};
    for (const [k, v] of Object.entries(health)) set[`integration_health.${k}`] = v;
    await platforms().updateOne({ id: parseInt(id, 10) }, { $set: set });
  },

  async delete(id) {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) return false;
    await platforms().deleteOne({ id: idNum });
    await col(COLLECTIONS.access).deleteMany({ platform_id: idNum });
    await col(COLLECTIONS.integrationLogs).deleteMany({ platform_id: idNum });
    return true;
  }
};
