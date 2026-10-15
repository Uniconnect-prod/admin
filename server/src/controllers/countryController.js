import { col, COLLECTIONS, nextSequence } from '../store/index.js';
import { platformRepository } from '../repositories/platformRepository.js';
import { logAudit } from '../middleware/auditLogger.js';
import { badRequest, notFound, conflict, exactCaseInsensitive, escapeRegex } from '../utils/errors.js';

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function countries() {
  return col(COLLECTIONS.countries);
}

function shape(c, platforms) {
  const linked = platforms.filter(p => {
    const pc = (p.country || '').toLowerCase();
    return pc && (pc === (c.name || '').toLowerCase() || pc === (c.code || '').toLowerCase());
  });
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    currency: c.currency || null,
    default_timezone: c.default_timezone || 'UTC',
    status: c.status || 'ACTIVE',
    platformCount: linked.length,
    platforms: linked.map(p => ({ id: p.id, name: p.name, code: p.code, status: p.status })),
    created_at: c.created_at || null,
    updated_at: c.updated_at || null
  };
}

function validate(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80) throw badRequest('Country name is required (2–80 characters).');
    out.name = body.name.trim();
  }
  if (!partial || body.code !== undefined) {
    if (typeof body.code !== 'string' || !/^[A-Za-z]{2,3}$/.test(body.code.trim())) throw badRequest('Country code must be a 2–3 letter ISO code (e.g. GH).');
    out.code = body.code.trim().toUpperCase();
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency.trim())) throw badRequest('Currency must be a 3-letter ISO code (e.g. GHS).');
    out.currency = body.currency.trim().toUpperCase();
  }
  if (body.default_timezone !== undefined) {
    if (typeof body.default_timezone !== 'string' || !isValidTimezone(body.default_timezone.trim())) throw badRequest('Timezone must be a valid IANA timezone (e.g. Africa/Accra).');
    out.default_timezone = body.default_timezone.trim();
  }
  if (body.status !== undefined) out.status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return out;
}

export const countryController = {
  async getAllCountries(req, res) {
    const { search, status } = req.query;
    const filter = {};
    if (status && status !== 'ALL') filter.status = String(status).toUpperCase();
    if (search && String(search).trim()) {
      const re = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: re }, { code: re }, { currency: re }];
    }
    const [rows, platforms] = await Promise.all([countries().find(filter).sort({ name: 1 }).toArray(), platformRepository.listAll()]);
    res.json({ success: true, data: rows.map(c => shape(c, platforms)) });
  },

  async getCountryById(req, res) {
    const c = await countries().findOne({ id: parseInt(req.params.id, 10) });
    if (!c) throw notFound('Country not found.');
    res.json({ success: true, data: shape(c, await platformRepository.listAll()) });
  },

  async createCountry(req, res) {
    const data = validate(req.body || {}, false);
    const dup = await countries().findOne({ $or: [{ name: exactCaseInsensitive(data.name) }, { code: data.code }] });
    if (dup) throw conflict(`Country '${data.name}' or code '${data.code}' already exists.`);
    const now = new Date();
    const doc = {
      id: await nextSequence(COLLECTIONS.countries),
      name: data.name,
      code: data.code,
      currency: data.currency || null,
      default_timezone: data.default_timezone || 'UTC',
      status: data.status || 'ACTIVE',
      created_at: now,
      updated_at: now
    };
    await countries().insertOne(doc);
    await logAudit(req, 'CREATE_COUNTRY', 'Country', doc.id, { name: doc.name, code: doc.code }, { platformId: null });
    res.status(201).json({ success: true, message: `Country '${doc.name}' created.`, data: shape(doc, []) });
  },

  async updateCountry(req, res) {
    const id = parseInt(req.params.id, 10);
    const existing = await countries().findOne({ id });
    if (!existing) throw notFound('Country not found.');
    const data = validate(req.body || {}, true);
    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      if (await countries().findOne({ id: { $ne: id }, name: exactCaseInsensitive(data.name) })) throw conflict(`Country name '${data.name}' is already used.`);
    }
    if (data.code && data.code !== existing.code) {
      if (await countries().findOne({ id: { $ne: id }, code: data.code })) throw conflict(`Country code '${data.code}' is already used.`);
    }
    await countries().updateOne({ id }, { $set: { ...data, updated_at: new Date() } });
    if (data.name && data.name !== existing.name) {
      await col(COLLECTIONS.platforms).updateMany({ country: existing.name }, { $set: { country: data.name, updated_at: new Date() } });
    }
    await logAudit(req, 'UPDATE_COUNTRY', 'Country', id, data, { platformId: null });
    res.json({ success: true, message: 'Country updated.', data: shape(await countries().findOne({ id }), await platformRepository.listAll()) });
  },

  async deleteCountry(req, res) {
    const id = parseInt(req.params.id, 10);
    const existing = await countries().findOne({ id });
    if (!existing) throw notFound('Country not found.');
    const linked = shape(existing, await platformRepository.listAll()).platformCount;
    if (linked > 0) {
      await countries().updateOne({ id }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
      await logAudit(req, 'DEACTIVATE_COUNTRY', 'Country', id, { linkedPlatforms: linked }, { platformId: null });
      return res.json({ success: true, message: `'${existing.name}' has ${linked} linked platform(s), so it was deactivated instead of deleted.` });
    }
    await countries().deleteOne({ id });
    await logAudit(req, 'DELETE_COUNTRY', 'Country', id, { name: existing.name }, { platformId: null });
    res.json({ success: true, message: `'${existing.name}' deleted.` });
  }
};
