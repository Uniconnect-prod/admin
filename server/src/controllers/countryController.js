import { getReportingDb, connectMongo } from '../config/mongo.js';
import { logAudit } from '../middleware/auditLogger.js';

async function getCountriesCol() {
  try {
    const db = getReportingDb();
    return { col: db.collection('admin_countries'), rDb: db };
  } catch {
    await connectMongo();
    const db = getReportingDb();
    return { col: db.collection('admin_countries'), rDb: db };
  }
}

async function getNextCountryId(col) {
  const top = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return (top[0]?.id || 0) + 1;
}

const DEFAULT_FALLBACK_COUNTRIES = [
  { id: 1, name: 'Ghana', code: 'GH', currency: 'GHS', default_timezone: 'Africa/Accra', status: 'ACTIVE' },
  { id: 2, name: 'Nigeria', code: 'NG', currency: 'NGN', default_timezone: 'Africa/Lagos', status: 'ACTIVE' },
  { id: 3, name: 'Kenya', code: 'KE', currency: 'KES', default_timezone: 'Africa/Nairobi', status: 'ACTIVE' },
  { id: 4, name: 'Uganda', code: 'UG', currency: 'UGX', default_timezone: 'Africa/Kampala', status: 'ACTIVE' },
  { id: 5, name: 'South Africa', code: 'ZA', currency: 'ZAR', default_timezone: 'Africa/Johannesburg', status: 'ACTIVE' }
];

export const countryController = {
  /**
   * List all countries with attached platform count
   */
  async getAllCountries(req, res) {
    try {
      const { col, rDb } = await getCountriesCol();
      const { search, status } = req.query;

      let filter = {};
      if (status && status !== 'ALL') {
        filter.status = status.toUpperCase();
      }
      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [{ name: regex }, { code: regex }, { currency: regex }];
      }

      let countries = [];
      try {
        countries = await col.find(filter).sort({ name: 1 }).toArray();
      } catch (findErr) {
        console.warn('[CountryController] Find error (using fallbacks):', findErr.message);
      }

      if (!countries || countries.length === 0) {
        countries = DEFAULT_FALLBACK_COUNTRIES.filter(c => {
          if (status && status !== 'ALL' && c.status !== status.toUpperCase()) return false;
          if (search) {
            const s = search.toLowerCase();
            return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
          }
          return true;
        });
      }

      // Get count of platforms for each country
      const platformsCol = rDb.collection('admin_platforms');
      let allPlatforms = [];
      try {
        allPlatforms = await platformsCol.find({}).toArray();
      } catch {
        allPlatforms = [];
      }

      const enriched = countries.map(c => {
        const cNameLower = (c.name || '').toLowerCase();
        const cCodeLower = (c.code || '').toLowerCase();
        const matchingPlats = allPlatforms.filter(p => {
          const pCountry = (p.country || '').toLowerCase();
          return pCountry === cNameLower || pCountry === cCodeLower;
        });

        return {
          id: c.id,
          name: c.name,
          code: c.code,
          currency: c.currency || 'GHS',
          default_timezone: c.default_timezone || 'Africa/Accra',
          status: c.status || 'ACTIVE',
          platformCount: matchingPlats.length,
          platforms: matchingPlats.map(p => ({ id: p.id, name: p.name, code: p.code, status: p.status })),
          created_at: c.created_at,
          updated_at: c.updated_at
        };
      });

      return res.status(200).json({ success: true, data: enriched });
    } catch (err) {
      console.error('[CountryController] getAllCountries error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve countries list.' });
    }
  },

  /**
   * Get country by ID
   */
  async getCountryById(req, res) {
    try {
      const { id } = req.params;
      const { col, rDb } = await getCountriesCol();
      const country = await col.findOne({ id: parseInt(id, 10) });

      if (!country) {
        return res.status(404).json({ success: false, message: 'Country not found.' });
      }

      const platformsCol = rDb.collection('admin_platforms');
      const platforms = await platformsCol.find({
        country: { $regex: `^${country.name}$`, $options: 'i' }
      }).toArray();

      return res.status(200).json({
        success: true,
        data: {
          ...country,
          platforms
        }
      });
    } catch (err) {
      console.error('[CountryController] getCountryById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve country details.' });
    }
  },

  /**
   * Create new country
   */
  async createCountry(req, res) {
    try {
      const { name, code, currency, default_timezone, status } = req.body;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: 'Country Name and Country Code (e.g. GH, NG, KE) are required.'
        });
      }

      const cleanName = name.trim();
      const cleanCode = code.trim().toUpperCase();

      const { col } = await getCountriesCol();

      // Check duplicate
      const existing = await col.findOne({
        $or: [
          { name: { $regex: `^${cleanName}$`, $options: 'i' } },
          { code: cleanCode }
        ]
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Country '${cleanName}' or code '${cleanCode}' already exists.`
        });
      }

      const nextId = await getNextCountryId(col);
      const now = new Date();

      const newCountry = {
        id: nextId,
        name: cleanName,
        code: cleanCode,
        currency: (currency || 'GHS').trim().toUpperCase(),
        default_timezone: default_timezone?.trim() || 'Africa/Accra',
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        created_at: now,
        updated_at: now
      };

      await col.insertOne(newCountry);
      await logAudit(req, 'CREATE_COUNTRY', 'Country', nextId, { name: cleanName, code: cleanCode });

      return res.status(201).json({
        success: true,
        message: `Country '${cleanName}' created successfully.`,
        data: newCountry
      });
    } catch (err) {
      console.error('[CountryController] createCountry error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create country.' });
    }
  },

  /**
   * Update country details
   */
  async updateCountry(req, res) {
    try {
      const { id } = req.params;
      const countryId = parseInt(id, 10);
      const { name, code, currency, default_timezone, status } = req.body;

      const { col, rDb } = await getCountriesCol();
      const existing = await col.findOne({ id: countryId });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Country not found.' });
      }

      const updateDoc = { updated_at: new Date() };

      if (name && name.trim()) {
        const cleanName = name.trim();
        // Check uniqueness if changed
        if (cleanName.toLowerCase() !== existing.name.toLowerCase()) {
          const duplicate = await col.findOne({
            id: { $ne: countryId },
            name: { $regex: `^${cleanName}$`, $options: 'i' }
          });
          if (duplicate) {
            return res.status(409).json({ success: false, message: `Country name '${cleanName}' already taken.` });
          }
        }
        updateDoc.name = cleanName;

        // Propagate name change to associated platforms
        if (cleanName !== existing.name) {
          const platformsCol = rDb.collection('admin_platforms');
          await platformsCol.updateMany(
            { country: existing.name },
            { $set: { country: cleanName, updated_at: new Date() } }
          );
        }
      }

      if (code && code.trim()) {
        const cleanCode = code.trim().toUpperCase();
        if (cleanCode !== existing.code) {
          const duplicate = await col.findOne({
            id: { $ne: countryId },
            code: cleanCode
          });
          if (duplicate) {
            return res.status(409).json({ success: false, message: `Country code '${cleanCode}' already taken.` });
          }
        }
        updateDoc.code = cleanCode;
      }

      if (currency !== undefined) updateDoc.currency = currency.trim().toUpperCase();
      if (default_timezone !== undefined) updateDoc.default_timezone = default_timezone.trim();
      if (status !== undefined) updateDoc.status = status;

      await col.updateOne({ id: countryId }, { $set: updateDoc });
      await logAudit(req, 'UPDATE_COUNTRY', 'Country', countryId, updateDoc);

      const updated = await col.findOne({ id: countryId });
      return res.status(200).json({
        success: true,
        message: 'Country updated successfully.',
        data: updated
      });
    } catch (err) {
      console.error('[CountryController] updateCountry error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update country.' });
    }
  },

  /**
   * Delete or deactivate country
   */
  async deleteCountry(req, res) {
    try {
      const { id } = req.params;
      const countryId = parseInt(id, 10);
      const { col, rDb } = await getCountriesCol();

      const country = await col.findOne({ id: countryId });
      if (!country) {
        return res.status(404).json({ success: false, message: 'Country not found.' });
      }

      // Check if platforms are attached
      const platformsCol = rDb.collection('admin_platforms');
      const attachedPlatforms = await platformsCol.countDocuments({
        $or: [
          { country: country.name },
          { country: country.code }
        ]
      });

      if (attachedPlatforms > 0) {
        // Deactivate instead of hard delete to preserve foreign integrity
        await col.updateOne({ id: countryId }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
        await logAudit(req, 'DEACTIVATE_COUNTRY', 'Country', countryId, { attachedPlatforms });
        return res.status(200).json({
          success: true,
          message: `Country '${country.name}' has ${attachedPlatforms} active platform(s) linked. It has been deactivated instead of deleted.`
        });
      }

      await col.deleteOne({ id: countryId });
      await logAudit(req, 'DELETE_COUNTRY', 'Country', countryId, { name: country.name });

      return res.status(200).json({
        success: true,
        message: `Country '${country.name}' deleted successfully.`
      });
    } catch (err) {
      console.error('[CountryController] deleteCountry error:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete country.' });
    }
  }
};
