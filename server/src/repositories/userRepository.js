import { col, COLLECTIONS, nextSequence } from '../store/index.js';
import { exactCaseInsensitive } from '../utils/errors.js';

const PUBLIC_FIELDS = { password_hash: 0 };

function users() {
  return col(COLLECTIONS.users);
}

export const userRepository = {
  async findForLogin(identifier) {
    const re = exactCaseInsensitive(identifier);
    return users().findOne({ $or: [{ username: re }, { email: re }], deleted_at: null });
  },

  async findById(id, { includePassword = false } = {}) {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) return null;
    return users().findOne({ id: idNum, deleted_at: null }, includePassword ? {} : { projection: PUBLIC_FIELDS });
  },

  async list() {
    return users().find({ deleted_at: null }, { projection: PUBLIC_FIELDS }).sort({ id: 1 }).toArray();
  },

  async existsWithEmailOrUsername(email, username, excludeId = null) {
    const filter = {
      deleted_at: null,
      $or: [{ email: exactCaseInsensitive(email) }, { username: exactCaseInsensitive(username) }]
    };
    const found = await users().findOne(filter, { projection: { id: 1 } });
    return Boolean(found && found.id !== excludeId);
  },

  async create({ name, email, username, password_hash, status = 'ACTIVE', country = null, is_super_admin = false }) {
    const now = new Date();
    const id = await nextSequence(COLLECTIONS.users);
    const doc = {
      id,
      name,
      email,
      username,
      password_hash,
      status,
      country,
      is_super_admin: Boolean(is_super_admin),
      last_login_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };
    await users().insertOne(doc);
    const { password_hash: _omit, ...publicDoc } = doc;
    return publicDoc;
  },

  async update(id, fields) {
    const allowed = ['name', 'email', 'username', 'status', 'country', 'is_super_admin'];
    const set = { updated_at: new Date() };
    for (const key of allowed) if (fields[key] !== undefined) set[key] = fields[key];
    await users().updateOne({ id: parseInt(id, 10), deleted_at: null }, { $set: set });
    return this.findById(id);
  },

  async setPasswordHash(id, passwordHash) {
    await users().updateOne({ id: parseInt(id, 10) }, { $set: { password_hash: passwordHash, updated_at: new Date() } });
  },

  async touchLogin(id) {
    await users().updateOne({ id: parseInt(id, 10) }, { $set: { last_login_at: new Date() } });
  },

  async softDelete(id) {
    const now = new Date();
    await users().updateOne({ id: parseInt(id, 10) }, { $set: { deleted_at: now, status: 'INACTIVE', updated_at: now } });
  },

  async namesByIds(ids) {
    const unique = [...new Set(ids.filter(v => v !== null && v !== undefined))];
    if (!unique.length) return new Map();
    const rows = await users().find({ id: { $in: unique } }, { projection: { id: 1, name: 1, email: 1 } }).toArray();
    return new Map(rows.map(r => [r.id, r]));
  }
};
