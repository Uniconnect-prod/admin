import { MongoClient } from 'mongodb';
import { config } from './index.js';

let sourceClient = null;
let reportingClient = null;
let reportingDbInstance = null;

// Read-only proxy for source database collections
const FORBIDDEN_WRITE_METHODS = new Set([
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

function createReadOnlyCollectionProxy(collection, dbName, colName) {
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

export async function connectMongo(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Mongo] Connecting to LIVE SOURCE MongoDB in STRICT READ-ONLY mode (Attempt ${attempt}/${retries})...`);
      sourceClient = new MongoClient(config.sourceMongoUri, {
        readPreference: 'secondaryPreferred',
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 20000
      });
      await sourceClient.connect();
      console.log('✅ [Mongo] Source MongoDB connected successfully (READ-ONLY)');

      console.log('[Mongo] Connecting to REPORTING ADMIN MongoDB...');
      reportingClient = new MongoClient(config.reportingMongoUri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 20000
      });
      await reportingClient.connect();
      reportingDbInstance = reportingClient.db();
      console.log(`✅ [Mongo] Reporting Admin MongoDB connected to '${reportingDbInstance.databaseName}'`);

      // Initialize application metadata in reportingDb (non-blocking if writes are disabled/quota exceeded)
      try {
        await initReportingAdminDb();
      } catch (adminErr) {
        console.warn('⚠️ [Mongo] Reporting admin metadata sync skipped (cluster storage quota):', adminErr.message);
      }
      return;
    } catch (err) {
      console.error(`❌ [Mongo] Connection attempt ${attempt} failed:`, err.message);
      if (attempt === retries) throw err;
      console.log(`[Mongo] Retrying connection in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Returns a strictly read-only collection proxy from the source database cluster.
 * E.g. getSourceCol('ghsuperwinings', 'sdplog')
 */
export function getSourceCol(dbName, colName) {
  if (!sourceClient) {
    throw new Error('Source MongoDB client is not connected.');
  }
  const db = sourceClient.db(dbName);
  const col = db.collection(colName);
  return createReadOnlyCollectionProxy(col, dbName, colName);
}

/**
 * Returns the reporting admin database instance
 */
export function getReportingDb() {
  if (!reportingDbInstance) {
    throw new Error('Reporting Admin MongoDB client is not connected.');
  }
  return reportingDbInstance;
}

/**
 * Initialize default administrative metadata in gh_reporting_admin
 */
async function initReportingAdminDb() {
  const rDb = getReportingDb();

  // Create collections if they do not exist
  const existingCols = (await rDb.listCollections().toArray()).map(c => c.name);

  // 1. Roles
  const rolesCol = rDb.collection('admin_roles');
  const roleCount = await rolesCol.countDocuments();
  if (roleCount === 0) {
    console.log('[Mongo] Seeding initial administrative roles...');
    await rolesCol.insertMany([
      { id: 1, name: 'Super Admin', description: 'Universal access across all platforms and administrative modules' },
      { id: 2, name: 'Platform Admin', description: 'Full access to assigned platforms, subscribers, and reporting' },
      { id: 3, name: 'Author', description: 'Content authoring, quiz upload, and assigned reporting' },
      { id: 4, name: 'Analyst', description: 'Data analysis and export permissions on assigned platforms' },
      { id: 5, name: 'Viewer', description: 'Read-only access to assigned platform dashboards' }
    ]);
  }

  // 2. Platforms (seeded only if empty)
  const platformsCol = rDb.collection('admin_platforms');
  const platformCount = await platformsCol.countDocuments();
  if (platformCount === 0) {
    console.log('[Mongo] Initializing default platforms...');
    await platformsCol.insertMany([
      {
        id: 1,
        name: 'ghsuperwinings',
        code: 'GHSUPERWININGS',
        logo_url: '/assets/platforms/ghsuperwinings.svg',
        description: 'SuperWinnings interactive SMS/Web trivia portal with daily cash prizes.',
        status: 'ACTIVE',
        enabled_modules: ['Subscribers', 'Renewals', 'Churn', 'Quiz', 'Revenue', 'Reports'],
        country: 'Ghana',
        database_name: 'ghsuperwinings',
        collection_sdp: 'sdplog',
        collection_callback: 'ghanacallbacklogs',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        name: 'ghanagameium',
        code: 'GHANAGAMEIUM',
        logo_url: '/assets/platforms/ghanagameium.svg',
        description: 'GhanaGameium mobile gaming portal.',
        status: 'ACTIVE',
        enabled_modules: ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'],
        country: 'Ghana',
        database_name: 'ghanagameium',
        collection_sdp: 'sdplogs',
        collection_callback: 'ghanacallbacklogs',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        name: 'crazymuzik',
        code: 'CRAZYMUZIK',
        logo_url: '/assets/platforms/crazymuzik.svg',
        description: 'CrazyMuzik streaming and artist discovery portal.',
        status: 'ACTIVE',
        enabled_modules: ['Subscribers', 'Renewals', 'Churn', 'Revenue', 'Reports'],
        country: 'Ghana',
        database_name: 'crazymuzik',
        collection_sdp: 'sdplog',
        collection_callback: 'ghanacallbacklogs',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  }

  // 3. Admin Users
  const usersCol = rDb.collection('admin_users');
  const userCount = await usersCol.countDocuments();
  if (userCount === 0) {
    console.log('[Mongo] Seeding initial administrative operators...');
    const now = new Date();
    await usersCol.insertMany([
      {
        id: 1,
        name: 'Main Admin',
        email: 'main_admin@enterprise.com',
        username: 'main_admin',
        password_hash: '$2a$10$uY5ZtyAYNbB4viIQOwuk3.W0ORovQpDE4vr/uM/Sxp2SURl997WVC',
        status: 'ACTIVE',
        last_login_at: now,
        created_at: now,
        updated_at: now,
        deleted_at: null
      },
      {
        id: 12,
        name: 'Rahul Sharma',
        email: 'rahul@ghsnapflix.com',
        username: 'ghsnapflix_rahul',
        password_hash: '$2a$10$uY5ZtyAYNbB4viIQOwuk3.W0ORovQpDE4vr/uM/Sxp2SURl997WVC',
        status: 'ACTIVE',
        last_login_at: now,
        created_at: now,
        updated_at: now,
        deleted_at: null
      }
    ]);
  }

  // 4. Platform Access Windows (seeded only if empty)
  const accessCol = rDb.collection('admin_platform_access');
  const accessCount = await accessCol.countDocuments();
  if (accessCount === 0) {
    const allP = await platformsCol.find({}).toArray();
    const now = new Date();
    const accessDocs = allP.map(p => ({
      id: p.id,
      user_id: 1,
      platform_id: p.id,
      role_id: 1,
      start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
      end_date: new Date(Date.now() + 730 * 86400000).toISOString(),
      status: 'ACTIVE',
      created_by: 1,
      created_at: now,
      updated_at: now
    }));
    if (accessDocs.length > 0) {
      await accessCol.insertMany(accessDocs);
    }
  }

  // Ensure unique indexes on admin collections
  await usersCol.createIndex({ username: 1 }, { unique: true }).catch(() => {});
  await usersCol.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  await usersCol.createIndex({ id: 1 }, { unique: true }).catch(() => {});
  await platformsCol.createIndex({ id: 1 }, { unique: true }).catch(() => {});
  await platformsCol.createIndex({ code: 1 }, { unique: true }).catch(() => {});
  await accessCol.createIndex({ user_id: 1, platform_id: 1 }).catch(() => {});
  await rDb.collection('admin_audit_logs').createIndex({ created_at: -1 }).catch(() => {});

  console.log('✅ [Mongo] Reporting Admin metadata initialized successfully.');
}

export async function closeMongo() {
  if (sourceClient) await sourceClient.close();
  if (reportingClient) await reportingClient.close();
}

