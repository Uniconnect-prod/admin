import { platformRepository } from '../services/platformRepository.js';
import { testMongoConnection, discoverCollectionsAndSchema } from '../config/mongoClientManager.js';
import { universalAnalyticsEngine } from '../services/universalAnalyticsEngine.js';
import { logAudit } from '../middleware/auditLogger.js';
import { getReportingDb } from '../config/mongo.js';
import { config } from '../config/index.js';

export const platformManagementController = {
  /**
   * GET /api/platform-management
   * List all platforms with connection & configuration statuses
   */
  async getAll(req, res) {
    try {
      const { search, status, country } = req.query;
      let platforms = await platformRepository.listAll(true);

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        platforms = platforms.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.database_name && p.database_name.toLowerCase().includes(q))
        );
      }

      if (status && status !== 'ALL') {
        platforms = platforms.filter(p => (p.status || '').toUpperCase() === status.toUpperCase());
      }

      if (country && country !== 'ALL') {
        platforms = platforms.filter(p => (p.country || '').toLowerCase() === country.toLowerCase());
      }

      return res.status(200).json({
        success: true,
        data: platforms,
        meta: { total: platforms.length }
      });
    } catch (err) {
      console.error('[platformManagementController.getAll] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve platforms list.' });
    }
  },

  /**
   * GET /api/platform-management/:id
   * Get complete platform configuration (with masked secrets)
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const platform = await platformRepository.findByIdOrCode(id);

      if (!platform) {
        return res.status(404).json({ success: false, message: `Platform '${id}' not found.` });
      }

      return res.status(200).json({
        success: true,
        data: platformRepository.sanitizeForClient(platform)
      });
    } catch (err) {
      console.error('[platformManagementController.getById] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve platform configuration.' });
    }
  },

  /**
   * POST /api/platform-management
   * Register a new platform in DRAFT / INITIAL state
   */
  async create(req, res) {
    try {
      const { name, code, description, country, business_timezone, connection, collections, mappings, offers, enabled_modules } = req.body;

      if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Platform name and unique platform code are required.' });
      }

      const newPlat = await platformRepository.createPlatform(req.body);

      // Automatically give Super Admin access to this newly registered platform
      try {
        const rDb = getReportingDb();
        const accessCol = rDb.collection('admin_platform_access');
        const now = new Date();
        await accessCol.updateOne(
          { user_id: req.user.id, platform_id: newPlat.id },
          {
            $set: {
              id: newPlat.id,
              user_id: req.user.id,
              platform_id: newPlat.id,
              role_id: 1, // Super Admin
              start_date: now.toISOString(),
              end_date: new Date(Date.now() + 730 * 86400000).toISOString(),
              status: 'ACTIVE',
              created_by: req.user.id,
              created_at: now,
              updated_at: now
            }
          },
          { upsert: true }
        );
      } catch (accessErr) {
        console.warn('[platformManagementController.create] Access mapping warning:', accessErr.message);
      }

      await logAudit(req, 'CREATE_PLATFORM', 'Platform', newPlat.id, { name: newPlat.name, code: newPlat.code });

      return res.status(201).json({
        success: true,
        message: 'Platform registered successfully.',
        data: platformRepository.sanitizeForClient(newPlat)
      });
    } catch (err) {
      console.error('[platformManagementController.create] Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to create platform.' });
    }
  },

  /**
   * PUT /api/platform-management/:id
   * Update general platform details or configuration
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await platformRepository.updatePlatform(id, req.body);

      await logAudit(req, 'UPDATE_PLATFORM', 'Platform', id, { updatedFields: Object.keys(req.body) });

      return res.status(200).json({
        success: true,
        message: 'Platform configuration updated successfully.',
        data: platformRepository.sanitizeForClient(updated)
      });
    } catch (err) {
      console.error('[platformManagementController.update] Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to update platform.' });
    }
  },

  /**
   * DELETE /api/platform-management/:id
   * Soft-disable platform (no destructive loss of historical data)
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      await platformRepository.disablePlatform(id);

      await logAudit(req, 'DISABLE_PLATFORM', 'Platform', id);

      return res.status(200).json({
        success: true,
        message: 'Platform successfully deactivated and archived.'
      });
    } catch (err) {
      console.error('[platformManagementController.delete] Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to disable platform.' });
    }
  },

  /**
   * POST /api/platform-management/test-connection or POST /api/platform-management/:id/test-connection
   * Real-time connectivity and TLS authentication verification
   */
  async testConnection(req, res) {
    try {
      let mongoUri = req.body?.mongo_uri;
      let dbName = req.body?.database_name;
      const platformId = req.params?.id;

      if (platformId) {
        const plat = await platformRepository.findByIdOrCode(platformId);
        if (!plat) return res.status(404).json({ success: false, message: 'Platform not found.' });
        mongoUri = mongoUri || plat.connection?.mongo_uri || plat.mongo_uri || config.sourceMongoUri;
        dbName = dbName || plat.connection?.database_name || plat.database_name || plat.name;
      } else {
        mongoUri = mongoUri || config.sourceMongoUri;
      }

      if (!dbName) {
        return res.status(400).json({ success: false, message: 'Database name is required to test connection.' });
      }

      const testResult = await testMongoConnection(mongoUri, dbName, { timeoutMS: 9000 });

      // Update platform connection status if testing a saved platform
      if (platformId) {
        await platformRepository.updatePlatform(platformId, {
          connection: {
            status: testResult.success ? 'CONNECTED' : 'ERROR',
            last_tested_at: new Date(),
            last_error: testResult.success ? null : testResult.error
          }
        });
      }

      await logAudit(req, 'TEST_CONNECTION', 'Platform', platformId || 'UNSAVED', {
        database: dbName,
        success: testResult.success,
        latencyMs: testResult.latencyMs
      });

      return res.status(200).json({
        success: testResult.success,
        data: testResult
      });
    } catch (err) {
      console.error('[platformManagementController.testConnection] Error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Connection test failed.' });
    }
  },

  /**
   * POST /api/platform-management/discover-schema or POST /api/platform-management/:id/discover-schema
   * Discovers accessible collections, document counts, and automatically suggests canonical mappings
   */
  async discoverSchema(req, res) {
    try {
      let mongoUri = req.body?.mongo_uri;
      let dbName = req.body?.database_name;
      const sampleCols = req.body?.sample_collections || [];
      const platformId = req.params?.id;

      if (platformId) {
        const plat = await platformRepository.findByIdOrCode(platformId);
        if (!plat) return res.status(404).json({ success: false, message: 'Platform not found.' });
        mongoUri = mongoUri || plat.connection?.mongo_uri || plat.mongo_uri || config.sourceMongoUri;
        dbName = dbName || plat.connection?.database_name || plat.database_name || plat.name;
      } else {
        mongoUri = mongoUri || config.sourceMongoUri;
      }

      if (!dbName) {
        return res.status(400).json({ success: false, message: 'Database name is required for schema discovery.' });
      }

      const discoveryResult = await discoverCollectionsAndSchema(mongoUri, dbName, sampleCols);

      return res.status(200).json({
        success: true,
        data: discoveryResult
      });
    } catch (err) {
      console.error('[platformManagementController.discoverSchema] Error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to discover schema.' });
    }
  },

  /**
   * GET /api/platform-management/:id/collections
   */
  async getCollections(req, res) {
    try {
      const { id } = req.params;
      const plat = await platformRepository.findByIdOrCode(id);
      if (!plat) return res.status(404).json({ success: false, message: 'Platform not found.' });

      const mongoUri = plat.connection?.mongo_uri || plat.mongo_uri || config.sourceMongoUri;
      const dbName = plat.connection?.database_name || plat.database_name || plat.name;

      const discovery = await discoverCollectionsAndSchema(mongoUri, dbName, []);
      return res.status(200).json({
        success: true,
        data: discovery.collections
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PUT /api/platform-management/:id/mappings
   * Update collection and canonical field mappings
   */
  async updateMappings(req, res) {
    try {
      const { id } = req.params;
      const { collections, mappings } = req.body;

      if (!collections && !mappings) {
        return res.status(400).json({ success: false, message: 'Collections or mappings payload required.' });
      }

      const updated = await platformRepository.updatePlatform(id, {
        collections,
        mappings,
        status: 'NEEDS_VALIDATION'
      });

      await logAudit(req, 'UPDATE_MAPPINGS', 'Platform', id, { collections, mappings });

      return res.status(200).json({
        success: true,
        message: 'Platform collection and field mappings saved.',
        data: platformRepository.sanitizeForClient(updated)
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * PUT /api/platform-management/:id/offers
   * Update offer definitions & billing tiers
   */
  async updateOffers(req, res) {
    try {
      const { id } = req.params;
      const { offers } = req.body;

      if (!Array.isArray(offers)) {
        return res.status(400).json({ success: false, message: 'Offers must be an array.' });
      }

      const updated = await platformRepository.updatePlatform(id, { offers });

      await logAudit(req, 'UPDATE_OFFERS', 'Platform', id, { count: offers.length });

      return res.status(200).json({
        success: true,
        message: 'Offer configurations updated successfully.',
        data: platformRepository.sanitizeForClient(updated)
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/platform-management/:id/validate
   * Dry-run read-only validation runner: checks field existence, sample normalized records, anomalies
   */
  async validate(req, res) {
    try {
      const { id } = req.params;
      const plat = await platformRepository.findByIdOrCode(id);
      if (!plat) return res.status(404).json({ success: false, message: 'Platform not found.' });

      // Merge with any transient overrides sent in the request body (e.g. from the wizard Step 6)
      const mergedPlatform = {
        ...plat,
        ...(req.body || {})
      };

      const valResults = await universalAnalyticsEngine.validatePlatformData(mergedPlatform);

      // Save validation status
      await platformRepository.updatePlatform(id, {
        validation: {
          status: valResults.isValid ? 'PASSED' : 'FAILED',
          last_validated_at: new Date(),
          sample_counts: valResults.metricsPreview
        },
        status: valResults.isValid ? 'VALIDATING' : 'ERROR'
      });

      await logAudit(req, 'VALIDATE_PLATFORM', 'Platform', id, {
        isValid: valResults.isValid,
        metrics: valResults.metricsPreview
      });

      return res.status(200).json({
        success: true,
        data: valResults
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/platform-management/:id/activate
   * Final activation step
   */
  async activate(req, res) {
    try {
      const { id } = req.params;
      const plat = await platformRepository.findByIdOrCode(id);
      if (!plat) return res.status(404).json({ success: false, message: 'Platform not found.' });

      await platformRepository.activatePlatform(id);

      await logAudit(req, 'ACTIVATE_PLATFORM', 'Platform', id, { name: plat.name, code: plat.code });

      return res.status(200).json({
        success: true,
        message: `Platform '${plat.name}' (${plat.code}) is now ACTIVE and available across all reporting modules.`
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/platform-management/:id/disable
   */
  async disable(req, res) {
    try {
      const { id } = req.params;
      await platformRepository.disablePlatform(id);
      await logAudit(req, 'DISABLE_PLATFORM', 'Platform', id);
      return res.status(200).json({
        success: true,
        message: 'Platform has been disabled.'
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
};
