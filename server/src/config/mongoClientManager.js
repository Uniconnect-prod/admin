import { MongoClient } from 'mongodb';
import { config } from './index.js';

// Read-only proxy for MongoDB collections preventing any data mutations
export const FORBIDDEN_WRITE_METHODS = new Set([
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'bulkWrite',
  'drop',
  'createIndex',
  'createIndexes',
  'dropIndex',
  'dropIndexes',
  'rename'
]);

// In-memory client connection pool to avoid opening redundant connections
const clientPool = new Map();

/**
 * Mask sensitive credentials (username, password, auth keys) in MongoDB URIs
 */
export function maskMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  try {
    return uri.replace(
      /(mongodb(?:\+srv)?:\/\/)([^:@]+)(?::([^@]+))?@/i,
      (match, proto, user) => `${proto}${user}:****@`
    );
  } catch {
    return 'mongodb://****:****@masked-host';
  }
}

/**
 * Validate MongoDB URI format and enforce security rules
 */
export function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('MongoDB URI is required and must be a valid string.');
  }

  const trimmed = uri.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    throw new Error('Invalid connection protocol. URI must start with mongodb:// or mongodb+srv://');
  }

  // Basic SSRF sanity checks: block internal link-local or metadata services if attempted
  const lower = trimmed.toLowerCase();
  if (lower.includes('169.254.169.254') || lower.includes('metadata.google.internal')) {
    throw new Error('Access to cloud metadata IP addresses is forbidden.');
  }

  return trimmed;
}

/**
 * Creates a strictly read-only Proxy around a MongoDB Collection
 */
export function createReadOnlyCollectionProxy(collection, dbName, colName) {
  return new Proxy(collection, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && FORBIDDEN_WRITE_METHODS.has(prop)) {
        throw new Error(
          `[SECURITY_VIOLATION] Attempted write method '${prop}' on READ-ONLY source database '${dbName}.${colName}'. Operation aborted.`
        );
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}

/**
 * Creates a strictly read-only Proxy around a MongoDB Db instance
 */
export function createReadOnlyDbProxy(dbInstance, dbName) {
  return new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === 'collection') {
        return (colName, options) => {
          const col = target.collection(colName, options);
          return createReadOnlyCollectionProxy(col, dbName, colName);
        };
      }
      if (typeof prop === 'string' && (prop === 'dropDatabase' || prop === 'createCollection' || prop === 'dropCollection')) {
        throw new Error(
          `[SECURITY_VIOLATION] Attempted database mutation method '${prop}' on READ-ONLY database '${dbName}'. Operation aborted.`
        );
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}

/**
 * Returns a cached or newly created read-only MongoClient
 */
export async function getClientForUri(rawUri, options = {}) {
  const uri = validateMongoUri(rawUri || config.sourceMongoUri);
  const cacheKey = uri;

  if (clientPool.has(cacheKey)) {
    const existing = clientPool.get(cacheKey);
    try {
      // Test ping on existing client
      await existing.db('admin').command({ ping: 1 });
      return existing;
    } catch {
      // Stale connection, remove and reconnect
      clientPool.delete(cacheKey);
      try { await existing.close(); } catch {}
    }
  }

  const client = new MongoClient(uri, {
    readPreference: options.readPreference || 'secondaryPreferred',
    serverSelectionTimeoutMS: options.timeoutMS || 10000,
    connectTimeoutMS: options.timeoutMS || 15000,
    tls: options.tls !== false
  });

  await client.connect();
  clientPool.set(cacheKey, client);
  return client;
}

/**
 * Returns a strictly read-only Db instance for a given platform configuration
 */
export async function getReadOnlyDb(platform) {
  const uri = platform.connection?.mongo_uri || platform.mongo_uri || config.sourceMongoUri;
  const dbName = platform.database_name || platform.connection?.database_name || platform.name;

  if (!dbName) {
    throw new Error(`Platform '${platform.code || platform.id}' is missing a database_name.`);
  }

  const client = await getClientForUri(uri, {
    readPreference: platform.connection?.read_preference || 'secondaryPreferred',
    tls: platform.connection?.tls_enabled !== false
  });

  const rawDb = client.db(dbName);
  return createReadOnlyDbProxy(rawDb, dbName);
}

/**
 * Test connectivity, authentication, and round-trip latency to a MongoDB instance
 */
export async function testMongoConnection(rawUri, dbName = 'admin', options = {}) {
  const startTime = Date.now();
  let client = null;
  try {
    const uri = validateMongoUri(rawUri);
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: options.timeoutMS || 8000,
      connectTimeoutMS: options.timeoutMS || 10000
    });

    await client.connect();
    const pingResult = await client.db(dbName || 'admin').command({ ping: 1 });
    const latencyMs = Date.now() - startTime;

    // List available databases if credentials permit
    let accessibleDbs = [];
    try {
      const adminDb = client.db('admin');
      const dbs = await adminDb.admin().listDatabases();
      accessibleDbs = (dbs.databases || []).map(d => ({
        name: d.name,
        sizeOnDisk: d.sizeOnDisk,
        empty: d.empty
      }));
    } catch {
      // If user lacks listDatabases privileges, return specified dbName
      if (dbName) accessibleDbs = [{ name: dbName }];
    }

    // List collections in target database if specified
    let targetCollections = [];
    if (dbName) {
      try {
        const targetDb = client.db(dbName);
        const cols = await targetDb.listCollections().toArray();
        targetCollections = cols.map(c => c.name).sort();
      } catch (colErr) {
        // target collection listing error handled gracefully
      }
    }

    return {
      success: true,
      latencyMs,
      ping: pingResult.ok === 1 ? 'OK' : 'UNKNOWN',
      accessibleDatabases: accessibleDbs,
      collections: targetCollections,
      maskedUri: maskMongoUri(uri)
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: err.message || 'Connection failed',
      code: err.code || 'CONNECTION_FAILED'
    };
  } finally {
    if (client) {
      try { await client.close(); } catch {}
    }
  }
}

/**
 * Masks sensitive document fields (passwords, tokens, hashes, auth codes)
 */
function maskSensitiveValues(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj;
  if (Array.isArray(obj)) return obj.slice(0, 5).map(item => maskSensitiveValues(item, depth + 1));

  const SENSITIVE_KEY_REGEX = /pass|secret|token|hash|auth|credit|cvv|pin/i;
  const result = {};

  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '********';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = maskSensitiveValues(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Inspect sample document structures and automatically infer canonical field mapping suggestions
 */
export async function discoverCollectionsAndSchema(rawUri, dbName, sampleCollectionNames = []) {
  const uri = validateMongoUri(rawUri);
  const client = await getClientForUri(uri);
  const db = client.db(dbName);

  // List all collections in target database
  const allCols = await db.listCollections().toArray();
  const collectionsSummary = [];

  for (const colInfo of allCols) {
    const colName = colInfo.name;
    // Skip internal system collections
    if (colName.startsWith('system.')) continue;

    let docCount = 0;
    try {
      docCount = await db.collection(colName).estimatedDocumentCount();
    } catch {
      try { docCount = await db.collection(colName).countDocuments({}, { maxTimeMS: 3000 }); } catch {}
    }

    collectionsSummary.push({
      name: colName,
      type: colInfo.type || 'collection',
      documentCount: docCount
    });
  }

  // Sort by count descending
  collectionsSummary.sort((a, b) => b.documentCount - a.documentCount);

  // If specific collections requested, sample and suggest field mappings
  const samplesByCollection = {};
  const suggestedMappings = {};

  const targetCols = sampleCollectionNames.length > 0
    ? sampleCollectionNames
    : collectionsSummary.slice(0, 4).map(c => c.name);

  for (const cName of targetCols) {
    try {
      const col = db.collection(cName);
      const rawSamples = await col.find({}).sort({ _id: -1 }).limit(3).toArray();
      const masked = rawSamples.map(d => maskSensitiveValues(d));
      samplesByCollection[cName] = masked;

      // Extract all top-level and 2nd-level paths
      if (rawSamples.length > 0) {
        const paths = extractFieldPaths(rawSamples[0]);
        inferFieldMappings(paths, suggestedMappings, cName);
      }
    } catch (err) {
      samplesByCollection[cName] = { error: err.message };
    }
  }

  return {
    database: dbName,
    collections: collectionsSummary,
    samples: samplesByCollection,
    suggestedMappings
  };
}

/**
 * Extracts dot-notation paths from a document (up to 2 levels deep)
 */
function extractFieldPaths(doc, prefix = '', depth = 0) {
  if (!doc || typeof doc !== 'object' || depth > 2) return [];
  const paths = [];

  for (const [key, val] of Object.entries(doc)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.push(fullPath);
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      paths.push(...extractFieldPaths(val, fullPath, depth + 1));
    }
  }
  return paths;
}

/**
 * Inactive field inferencing based on standard telecom & VAS reporting terminology
 */
function inferFieldMappings(paths, suggestions, colName) {
  const isSubscriberCol = /user|subscriber|sub|account/i.test(colName);
  const isSdpOrBillingCol = /sdp|billing|charge|trans|log|payment|renew/i.test(colName);
  const isCallbackCol = /callback|park|redirect|notify/i.test(colName);

  for (const p of paths) {
    const key = p.split('.').pop().toLowerCase();

    // MSISDN / Subscriber identifier
    if (!suggestions.msisdn && (/msisdn|phone|mobile|tel|user_id|userid/i.test(key))) {
      suggestions.msisdn = p;
    }

    // Timestamp
    if (!suggestions.timestamp && (/datetime|date_time|created_at|timestamp|event_time|date/i.test(key))) {
      suggestions.timestamp = p;
    }

    // Transaction ID
    if (!suggestions.transaction_id && (/transactionid|trans_id|requestid|tx_id|reference|sessionid/i.test(key))) {
      suggestions.transaction_id = p;
    }

    // Command / Action
    if (!suggestions.command && (/command|action|operation|event_type|type/i.test(key))) {
      suggestions.command = p;
    }

    // Status / Result
    if (!suggestions.status && (/status|result_code|statuscode|res_code|state/i.test(key))) {
      suggestions.status = p;
    }

    // Subscription Status
    if (!suggestions.subscription_status && (/subscriptionstatus|sub_status|membership_status/i.test(key))) {
      suggestions.subscription_status = p;
    }

    // Charge Amount / Revenue
    if (!suggestions.charge_amount && (/chargeamount|charge_amount|amount|price|cost|revenue/i.test(key))) {
      suggestions.charge_amount = p;
    }

    // Offer Code / Product ID
    if (!suggestions.offer_code && (/offercode|offer_code|product_id|productid|plan_id|bundle/i.test(key))) {
      suggestions.offer_code = p;
    }

    // Failure Reason
    if (!suggestions.failure_reason && (/failurereason|failure_reason|errormessage|error_msg|reason/i.test(key))) {
      suggestions.failure_reason = p;
    }

    // Next Billing Date
    if (!suggestions.next_billing_date && (/nextbillingdate|next_billing_date|expiry_date|renewal_date/i.test(key))) {
      suggestions.next_billing_date = p;
    }
  }

  // Suggest collection roles
  if (!suggestions.collections) suggestions.collections = {};
  if (isSubscriberCol && !suggestions.collections.subscribers) suggestions.collections.subscribers = colName;
  if (isSdpOrBillingCol && !suggestions.collections.sdp_logs) suggestions.collections.sdp_logs = colName;
  if (isCallbackCol && !suggestions.collections.callbacks) suggestions.collections.callbacks = colName;
}

/**
 * Gracefully close all cached MongoClient instances in the pool
 */
export async function closeAllPoolClients() {
  for (const [key, client] of clientPool.entries()) {
    try {
      await client.close();
    } catch (e) {
      console.warn(`[mongoClientManager] Error closing client for ${maskMongoUri(key)}:`, e.message);
    }
  }
  clientPool.clear();
}
