import { getReportingDb } from '../config/mongo.js';
import { maskMongoUri } from '../config/mongoClientManager.js';

/**
 * Repository service for administrative platform definitions and metadata stored in gh_reporting_admin
 */
export const platformRepository = {
  /**
   * Returns collection reference to admin_platforms
   */
  async getCollection() {
    const rDb = getReportingDb();
    return rDb.collection('admin_platforms');
  },

  /**
   * Get next auto-increment integer ID
   */
  async getNextId() {
    const col = await this.getCollection();
    const doc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
    return (doc[0]?.id || 0) + 1;
  },

  /**
   * Upgrades / enriches default platforms with collections, mappings, and offer schemas
   */
  async ensurePlatformSchemas() {
    try {
      const col = await this.getCollection();
      const platforms = await col.find({}).toArray();

      for (const p of platforms) {
        let needsUpdate = false;
        const updateFields = {};

        // 1. Connection
        if (!p.connection) {
          needsUpdate = true;
          updateFields.connection = {
            mongo_uri: p.mongo_uri || '',
            database_name: p.database_name || p.name,
            tls_enabled: true,
            read_preference: 'secondaryPreferred',
            status: 'CONNECTED',
            last_tested_at: new Date()
          };
        }

        // 2. Collections
        if (!p.collections) {
          needsUpdate = true;
          let subCol = 'users';
          let sdpCol = p.collection_sdp || 'sdplog';
          if (p.code === 'GHANAGAMEIUM' || p.name === 'ghanagameium') {
            subCol = 'subscriptions';
            sdpCol = 'sdplogs';
          }
          updateFields.collections = {
            subscribers: subCol,
            sdp_logs: sdpCol,
            callbacks: p.collection_callback || 'ghanacallbacklogs',
            deactivations: ''
          };
        }

        // 3. Mappings
        if (!p.mappings) {
          needsUpdate = true;
          updateFields.mappings = {
            msisdn: 'msisdn',
            timestamp: 'datetime',
            transaction_id: 'transactionId',
            command: 'command',
            status: 'status',
            subscription_status: 'subscriptionStatus',
            charge_amount: 'chargeAmount',
            offer_code: 'offerCode',
            failure_reason: 'reason',
            next_billing_date: 'nextBillingDate'
          };
        }

        // 4. Offers
        if (!p.offers || p.offers.length === 0) {
          needsUpdate = true;
          if (p.code === 'GHSUPERWININGS' || p.name === 'ghsuperwinings') {
            updateFields.offers = [
              { code: '9923310010', name: 'Super Winnings Daily', type: 'daily', price: 1.0, is_default: true },
              { code: '9923310009', name: 'Super Winnings on-demand Daily', type: 'ondemand', price: 1.0, is_default: false }
            ];
          } else if (p.code === 'GHANAGAMEIUM' || p.name === 'ghanagameium') {
            updateFields.offers = [
              { code: '9923310007', name: 'GameZone Daily', type: 'daily', price: 1.0, is_default: true }
            ];
          } else {
            updateFields.offers = [];
          }
        }

        // 5. Timezone & validation
        if (!p.business_timezone) {
          needsUpdate = true;
          updateFields.business_timezone = 'Africa/Accra';
        }

        if (!p.validation) {
          needsUpdate = true;
          updateFields.validation = {
            status: 'PASSED',
            last_validated_at: new Date()
          };
        }

        if (needsUpdate) {
          await col.updateOne({ _id: p._id }, { $set: updateFields });
        }
      }
    } catch (err) {
      console.warn('[platformRepository] ensurePlatformSchemas warning:', err.message);
    }
  },

  /**
   * Find platform by ID or Code
   */
  async findByIdOrCode(idOrCode) {
    if (!idOrCode) return null;
    const col = await this.getCollection();
    const str = String(idOrCode).trim();
    const idNum = parseInt(str, 10);

    const query = {
      $or: [
        { code: { $regex: `^${str}$`, $options: 'i' } },
        { name: { $regex: `^${str}$`, $options: 'i' } }
      ]
    };
    if (!isNaN(idNum)) {
      query.$or.push({ id: idNum });
    }

    return col.findOne(query);
  },

  /**
   * List all platforms (optionally sanitized of raw credentials for client responses)
   */
  async listAll(sanitize = true) {
    const col = await this.getCollection();
    const platforms = await col.find({}).sort({ id: 1 }).toArray();

    if (!sanitize) return platforms;

    return platforms.map(p => this.sanitizeForClient(p));
  },

  /**
   * Sanitize platform document: mask MongoDB URIs, format dates
   */
  sanitizeForClient(platform) {
    if (!platform) return null;
    const clone = { ...platform };

    // Mask connection URI
    if (clone.connection?.mongo_uri) {
      clone.connection = {
        ...clone.connection,
        mongo_uri_masked: maskMongoUri(clone.connection.mongo_uri),
        // Don't return raw URI
        mongo_uri: maskMongoUri(clone.connection.mongo_uri)
      };
    } else if (clone.mongo_uri) {
      clone.mongo_uri = maskMongoUri(clone.mongo_uri);
    }

    return clone;
  },

  /**
   * Create new platform
   */
  async createPlatform(data) {
    const col = await this.getCollection();
    const nextId = await this.getNextId();
    const cleanCode = String(data.code).trim().toUpperCase().replace(/\s+/g, '_');

    // Check if code already exists
    const existing = await col.findOne({ code: cleanCode });
    if (existing) {
      throw new Error(`Platform with code '${cleanCode}' already exists.`);
    }

    const now = new Date();
    const doc = {
      id: nextId,
      name: data.name.trim(),
      code: cleanCode,
      logo_url: data.logo_url || `/assets/platforms/${cleanCode.toLowerCase()}.svg`,
      accent_color: data.accent_color || '#00E5FF',
      description: data.description || '',
      status: data.status || 'DRAFT',
      country: data.country || 'Ghana',
      business_timezone: data.business_timezone || 'Africa/Accra',
      enabled_modules: data.enabled_modules || ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'],
      config_version: 1,
      connection: {
        mongo_uri: data.connection?.mongo_uri || data.mongo_uri || '',
        database_name: data.connection?.database_name || data.database_name || cleanCode.toLowerCase(),
        tls_enabled: data.connection?.tls_enabled !== false,
        read_preference: data.connection?.read_preference || 'secondaryPreferred',
        status: data.connection?.status || 'DISCONNECTED',
        last_tested_at: null,
        last_error: null
      },
      collections: {
        subscribers: data.collections?.subscribers || 'users',
        sdp_logs: data.collections?.sdp_logs || 'sdplog',
        callbacks: data.collections?.callbacks || 'ghanacallbacklogs',
        deactivations: data.collections?.deactivations || ''
      },
      mappings: {
        msisdn: data.mappings?.msisdn || 'msisdn',
        timestamp: data.mappings?.timestamp || 'datetime',
        transaction_id: data.mappings?.transaction_id || 'transactionId',
        command: data.mappings?.command || 'command',
        status: data.mappings?.status || 'status',
        subscription_status: data.mappings?.subscription_status || 'subscriptionStatus',
        charge_amount: data.mappings?.charge_amount || 'chargeAmount',
        offer_code: data.mappings?.offer_code || 'offerCode',
        failure_reason: data.mappings?.failure_reason || 'reason',
        next_billing_date: data.mappings?.next_billing_date || 'nextBillingDate'
      },
      offers: Array.isArray(data.offers) ? data.offers : [],
      validation: {
        status: 'PENDING',
        last_validated_at: null,
        sample_counts: null
      },
      created_at: now,
      updated_at: now
    };

    await col.insertOne(doc);
    return doc;
  },

  /**
   * Update platform configuration
   */
  async updatePlatform(idOrCode, updateData) {
    const col = await this.getCollection();
    const existing = await this.findByIdOrCode(idOrCode);
    if (!existing) {
      throw new Error(`Platform '${idOrCode}' not found.`);
    }

    const setObj = {
      updated_at: new Date()
    };

    if (updateData.name !== undefined) setObj.name = updateData.name;
    if (updateData.description !== undefined) setObj.description = updateData.description;
    if (updateData.logo_url !== undefined) setObj.logo_url = updateData.logo_url;
    if (updateData.accent_color !== undefined) setObj.accent_color = updateData.accent_color;
    if (updateData.country !== undefined) setObj.country = updateData.country;
    if (updateData.business_timezone !== undefined) setObj.business_timezone = updateData.business_timezone;
    if (updateData.enabled_modules !== undefined) setObj.enabled_modules = updateData.enabled_modules;
    if (updateData.status !== undefined) setObj.status = updateData.status;

    // Increment config version if structural changes made
    if (updateData.collections || updateData.mappings || updateData.offers) {
      setObj.config_version = (existing.config_version || 1) + 1;
    }

    // Connection updates
    if (updateData.connection) {
      // Don't overwrite with masked string
      const newUri = updateData.connection.mongo_uri && !updateData.connection.mongo_uri.includes('****')
        ? updateData.connection.mongo_uri
        : existing.connection?.mongo_uri;

      setObj.connection = {
        ...existing.connection,
        ...updateData.connection,
        mongo_uri: newUri
      };
    }

    // Collections
    if (updateData.collections) {
      setObj.collections = {
        ...existing.collections,
        ...updateData.collections
      };
    }

    // Mappings
    if (updateData.mappings) {
      setObj.mappings = {
        ...existing.mappings,
        ...updateData.mappings
      };
    }

    // Offers
    if (updateData.offers) {
      setObj.offers = updateData.offers;
    }

    // Validation
    if (updateData.validation) {
      setObj.validation = {
        ...existing.validation,
        ...updateData.validation
      };
    }

    await col.updateOne({ _id: existing._id }, { $set: setObj });
    return this.findByIdOrCode(existing.id);
  },

  /**
   * Soft disable platform
   */
  async disablePlatform(idOrCode) {
    const col = await this.getCollection();
    const existing = await this.findByIdOrCode(idOrCode);
    if (!existing) throw new Error(`Platform '${idOrCode}' not found.`);

    await col.updateOne(
      { _id: existing._id },
      { $set: { status: 'DISABLED', updated_at: new Date() } }
    );
    return true;
  },

  /**
   * Activate platform
   */
  async activatePlatform(idOrCode) {
    const col = await this.getCollection();
    const existing = await this.findByIdOrCode(idOrCode);
    if (!existing) throw new Error(`Platform '${idOrCode}' not found.`);

    await col.updateOne(
      { _id: existing._id },
      { $set: { status: 'ACTIVE', updated_at: new Date() } }
    );
    return true;
  }
};
