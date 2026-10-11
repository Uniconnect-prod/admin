import { getReportingDb, connectMongo } from '../config/mongo.js';

/**
 * MongoDB-backed administrative storage adapter for gh_reporting_admin
 * Provides db.get(), db.all(), db.run(), db.query() emulation over native MongoDB collections
 * for application-owned authentication, admin users, roles, platform access, and audit logs.
 */

async function ensureConnected() {
  try {
    return getReportingDb();
  } catch {
    await connectMongo();
    return getReportingDb();
  }
}

// Helper to get auto-increment integer ID in MongoDB
async function getNextId(colName) {
  const rDb = await ensureConnected();
  const doc = await rDb.collection(colName).find({}).sort({ id: -1 }).limit(1).toArray();
  return (doc[0]?.id || 0) + 1;
}

export const db = {
  dialect: 'mongodb',

  async get(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows[0] || null;
  },

  async all(sql, params = []) {
    return this.query(sql, params);
  },

  async query(sql, params = []) {
    const rDb = await ensureConnected();
    const cleanSql = sql.trim();
    const lowerSql = cleanSql.toLowerCase();

    // -------------------------------------------------------------
    // 1. USERS COLLECTION
    // -------------------------------------------------------------
    if (lowerSql.includes('from users')) {
      const usersCol = rDb.collection('admin_users');

      // Check for login query: username or email
      if (lowerSql.includes('lower(username) = lower(?)') || lowerSql.includes('username = ?')) {
        const u = params[0] || params[1];
        const user = await usersCol.findOne({
          $or: [
            { username: { $regex: `^${String(u).trim()}$`, $options: 'i' } },
            { email: { $regex: `^${String(u).trim()}$`, $options: 'i' } }
          ],
          deleted_at: null
        });
        return user ? [user] : [];
      }

      // Check for user by ID
      if (lowerSql.includes('where id = ?') || lowerSql.includes('where u.id = ?')) {
        const idNum = parseInt(params[0], 10);
        const user = await usersCol.findOne({ id: idNum, deleted_at: null });
        return user ? [user] : [];
      }

      // List all users
      const users = await usersCol.find({ deleted_at: null }).sort({ id: 1 }).toArray();
      return users;
    }

    // -------------------------------------------------------------
    // 2. PLATFORM_ACCESS COLLECTION (with join to platforms and roles)
    // -------------------------------------------------------------
    if (lowerSql.includes('from platform_access') || lowerSql.includes('from user_platforms')) {
      const accessCol = rDb.collection('admin_platform_access');
      const platformsCol = rDb.collection('admin_platforms');
      const rolesCol = rDb.collection('admin_roles');

      const [allPlats, allRoles] = await Promise.all([
        platformsCol.find({}).toArray(),
        rolesCol.find({}).toArray()
      ]);

      const platMap = new Map(allPlats.map(p => [p.id, p]));
      const roleMap = new Map(allRoles.map(r => [r.id, r]));

      let filter = {};
      if (lowerSql.includes('pa.user_id = ? and pa.platform_id = ?') || lowerSql.includes('up.user_id = ? and up.platform_id = ?')) {
        filter = { user_id: parseInt(params[0], 10), platform_id: parseInt(params[1], 10) };
      } else if (lowerSql.includes('pa.user_id = ?') || lowerSql.includes('up.user_id = ?')) {
        filter = { user_id: parseInt(params[0], 10) };
      } else if (lowerSql.includes('pa.platform_id = ?')) {
        filter = { platform_id: parseInt(params[0], 10) };
      }

      const accessRows = await accessCol.find(filter).toArray();

      // Enrich rows with platform and role details
      const enriched = accessRows.map(row => {
        const plat = platMap.get(row.platform_id) || {};
        const role = roleMap.get(row.role_id) || {};

        return {
          id: row.id,
          user_id: row.user_id,
          platform_id: row.platform_id,
          platform_code: plat.code || 'UNKNOWN',
          platform_name: plat.name || 'Unknown',
          logo_url: plat.logo_url || '',
          enabled_modules: JSON.stringify(plat.enabled_modules || []),
          role_id: row.role_id,
          role_name: role.name || 'Viewer',
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.status || 'ACTIVE'
        };
      });

      return enriched;
    }

    // -------------------------------------------------------------
    // 3. PLATFORMS COLLECTION
    // -------------------------------------------------------------
    if (lowerSql.includes('from platforms')) {
      const platformsCol = rDb.collection('admin_platforms');

      if (lowerSql.includes('where (upper(code) = upper(?) or id = ?)') || lowerSql.includes('code = ?')) {
        const identifier = params[0];
        const idNum = parseInt(identifier, 10);
        const query = {
          $or: [
            { code: { $regex: `^${String(identifier).trim()}$`, $options: 'i' } }
          ],
          status: 'ACTIVE'
        };
        if (!isNaN(idNum)) {
          query.$or.push({ id: idNum });
        }
        const plat = await platformsCol.findOne(query);
        return plat ? [{
          ...plat,
          enabled_modules: Array.isArray(plat.enabled_modules) ? JSON.stringify(plat.enabled_modules) : plat.enabled_modules
        }] : [];
      }

      if (lowerSql.includes('where id = ?')) {
        const idNum = parseInt(params[0], 10);
        const plat = await platformsCol.findOne({ id: idNum });
        return plat ? [{
          ...plat,
          enabled_modules: Array.isArray(plat.enabled_modules) ? JSON.stringify(plat.enabled_modules) : plat.enabled_modules
        }] : [];
      }

      const plats = await platformsCol.find({}).sort({ id: 1 }).toArray();
      return plats.map(p => ({
        ...p,
        enabled_modules: Array.isArray(p.enabled_modules) ? JSON.stringify(p.enabled_modules) : p.enabled_modules
      }));
    }

    // -------------------------------------------------------------
    // 4. ROLES COLLECTION
    // -------------------------------------------------------------
    if (lowerSql.includes('from roles')) {
      const rolesCol = rDb.collection('admin_roles');
      if (lowerSql.includes('where id = ?')) {
        const idNum = parseInt(params[0], 10);
        const role = await rolesCol.findOne({ id: idNum });
        return role ? [role] : [];
      }
      return rolesCol.find({}).sort({ id: 1 }).toArray();
    }

    // -------------------------------------------------------------
    // 5. AUDIT LOGS COLLECTION
    // -------------------------------------------------------------
    if (lowerSql.includes('from audit_logs')) {
      const auditCol = rDb.collection('admin_audit_logs');
      if (lowerSql.includes('count(*) as total')) {
        const count = await auditCol.countDocuments();
        return [{ total: count }];
      }

      const logs = await auditCol.find({}).sort({ created_at: -1 }).limit(100).toArray();
      return logs.map(l => ({
        ...l,
        id: l.id || l._id.toString(),
        metadata: typeof l.metadata === 'object' ? JSON.stringify(l.metadata) : (l.metadata || '{}')
      }));
    }

    // Default fallback
    return [];
  },

  async run(sql, params = []) {
    const rDb = await ensureConnected();
    const cleanSql = sql.trim();
    const lowerSql = cleanSql.toLowerCase();

    // -------------------------------------------------------------
    // 1. INSERT INTO USERS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('insert into users')) {
      const usersCol = rDb.collection('admin_users');
      const nextId = await getNextId('admin_users');
      const now = new Date();
      // VALUES (?, ?, ?, ?, ?, ?) -> name, email, username, password_hash, status, country
      const userDoc = {
        id: nextId,
        name: params[0],
        email: params[1],
        username: params[2],
        password_hash: params[3],
        status: params[4] || 'ACTIVE',
        country: params[5] || 'Ghana',
        last_login_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      await usersCol.insertOne(userDoc);
      return { lastID: nextId, changes: 1 };
    }

    // -------------------------------------------------------------
    // 2. UPDATE USERS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('update users')) {
      const usersCol = rDb.collection('admin_users');
      const now = new Date();

      // Last login update: SET last_login_at = ? WHERE id = ?
      if (lowerSql.includes('set last_login_at = ?')) {
        const idNum = parseInt(params[1], 10);
        await usersCol.updateOne({ id: idNum }, { $set: { last_login_at: params[0], updated_at: now } });
        return { changes: 1 };
      }

      // Password reset: SET password_hash = ? WHERE id = ?
      if (lowerSql.includes('set password_hash = ?')) {
        const idNum = parseInt(params[1], 10);
        await usersCol.updateOne({ id: idNum }, { $set: { password_hash: params[0], updated_at: now } });
        return { changes: 1 };
      }

      // Soft delete: SET deleted_at = ... WHERE id = ?
      if (lowerSql.includes('deleted_at')) {
        const idNum = parseInt(params[params.length - 1], 10);
        await usersCol.updateOne({ id: idNum }, { $set: { deleted_at: now, status: 'INACTIVE', updated_at: now } });
        return { changes: 1 };
      }

      // Profile edit: name, email, username, status, country, updated_at
      if (lowerSql.includes('set name = ?')) {
        const hasCountry = lowerSql.includes('country = ?') || lowerSql.includes('country = coalesce');
        const idNum = parseInt(params[params.length - 1], 10);
        const setDoc = {
          name: params[0],
          email: params[1],
          username: params[2],
          status: params[3],
          updated_at: now
        };
        if (hasCountry && params.length >= 6) {
          setDoc.country = params[4];
        }
        await usersCol.updateOne({ id: idNum }, { $set: setDoc });
        return { changes: 1 };
      }
    }

    // -------------------------------------------------------------
    // 3. INSERT INTO PLATFORM_ACCESS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('insert into platform_access') || lowerSql.startsWith('insert or ignore into user_platforms') || lowerSql.startsWith('insert into user_platforms')) {
      const accessCol = rDb.collection('admin_platform_access');
      const nextId = await getNextId('admin_platform_access');
      const now = new Date();

      const isUserPlatforms = lowerSql.includes('user_platforms');
      
      let doc;
      if (isUserPlatforms) {
        // query from platformController: INSERT OR IGNORE INTO user_platforms (user_id, platform_id, role_id) VALUES (?, ?, 1)
        doc = {
          id: nextId,
          user_id: parseInt(params[0], 10),
          platform_id: parseInt(params[1], 10),
          role_id: 1, // hardcoded in the SQL string in platformController
          start_date: now.toISOString(),
          end_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'ACTIVE',
          created_by: 1,
          created_at: now,
          updated_at: now
        };
      } else {
        // query: insert into platform_access ... [user_id, platform_id, role_id, start_date, end_date, status, created_by]
        doc = {
          id: nextId,
          user_id: parseInt(params[0], 10),
          platform_id: parseInt(params[1], 10),
          role_id: parseInt(params[2], 10),
          start_date: params[3],
          end_date: params[4],
          status: params[5] || 'ACTIVE',
          created_by: params[6] || 1,
          created_at: now,
          updated_at: now
        };
      }

      await accessCol.updateOne(
        { user_id: doc.user_id, platform_id: doc.platform_id },
        { $set: doc },
        { upsert: true }
      );
      return { lastID: nextId, changes: 1 };
    }

    // -------------------------------------------------------------
    // 4. UPDATE PLATFORM_ACCESS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('update platform_access')) {
      const accessCol = rDb.collection('admin_platform_access');
      const now = new Date();

      if (lowerSql.includes('set status = ? where user_id = ?')) {
        const statusVal = params[0];
        const userId = parseInt(params[1], 10);
        await accessCol.updateMany({ user_id: userId }, { $set: { status: statusVal, updated_at: now } });
        return { changes: 1 };
      }

      // [role_id, start_date, end_date, status, user_id, platform_id]
      const userId = parseInt(params[4], 10);
      const platId = parseInt(params[5], 10);
      await accessCol.updateOne(
        { user_id: userId, platform_id: platId },
        {
          $set: {
            role_id: parseInt(params[0], 10),
            start_date: params[1],
            end_date: params[2],
            status: params[3],
            updated_at: now
          }
        },
        { upsert: true }
      );
      return { changes: 1 };
    }

    // -------------------------------------------------------------
    // 5. DELETE FROM PLATFORM_ACCESS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('delete from platform_access')) {
      const accessCol = rDb.collection('admin_platform_access');
      if (lowerSql.includes('where user_id = ? and platform_id = ?')) {
        await accessCol.deleteOne({ user_id: parseInt(params[0], 10), platform_id: parseInt(params[1], 10) });
      } else if (lowerSql.includes('where user_id = ?')) {
        await accessCol.deleteMany({ user_id: parseInt(params[0], 10) });
      }
      return { changes: 1 };
    }

    // -------------------------------------------------------------
    // 6. INSERT INTO AUDIT_LOGS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('insert into audit_logs')) {
      const auditCol = rDb.collection('admin_audit_logs');
      // [userId, platformId, action, entity, entityId, metadata, ipAddress]
      let parsedMeta = {};
      try { parsedMeta = JSON.parse(params[5] || '{}'); } catch { parsedMeta = { raw: params[5] }; }

      const doc = {
        user_id: params[0] ? parseInt(params[0], 10) : null,
        platform_id: params[1] ? parseInt(params[1], 10) : null,
        action: params[2],
        entity: params[3],
        entity_id: params[4],
        metadata: parsedMeta,
        ip_address: params[6],
        created_at: new Date()
      };
      await auditCol.insertOne(doc);
      return { changes: 1 };
    }

    // -------------------------------------------------------------
    // 7. PLATFORMS UPDATE
    // -------------------------------------------------------------
    if (lowerSql.startsWith('update platforms')) {
      const platformsCol = rDb.collection('admin_platforms');
      if (lowerSql.includes('status = ? where id = ?')) {
        await platformsCol.updateOne(
          { id: parseInt(params[1], 10) },
          { $set: { status: params[0], updated_at: new Date() } }
        );
        return { changes: 1 };
      }
      if (lowerSql.includes('set name = coalesce')) {
        // [name, logo_url, description, status, enabled_modules, country, mongo_uri, database_name, collection_sdp, collection_callback, id]
        await platformsCol.updateOne(
          { id: parseInt(params[10], 10) },
          {
            $set: {
              ...(params[0] && { name: params[0] }),
              ...(params[1] && { logo_url: params[1] }),
              ...(params[2] && { description: params[2] }),
              ...(params[3] && { status: params[3] }),
              enabled_modules: params[4],
              ...(params[5] && { country: params[5] }),
              ...(params[6] && { mongo_uri: params[6] }),
              ...(params[7] && { database_name: params[7] }),
              ...(params[8] && { collection_sdp: params[8] }),
              ...(params[9] && { collection_callback: params[9] }),
              updated_at: new Date()
            }
          }
        );
        return { changes: 1 };
      }
    }

    // -------------------------------------------------------------
    // 8. INSERT INTO PLATFORMS
    // -------------------------------------------------------------
    if (lowerSql.startsWith('insert into platforms')) {
      const platformsCol = rDb.collection('admin_platforms');
      const nextId = await getNextId('admin_platforms');
      const doc = {
        id: nextId,
        name: params[0],
        code: params[1],
        logo_url: params[2],
        description: params[3],
        status: 'ACTIVE',
        enabled_modules: params[4],
        country: params[5] || '',
        mongo_uri: params[6] || '',
        database_name: params[7] || '',
        collection_sdp: params[8] || '',
        collection_callback: params[9] || '',
        created_at: new Date(),
        updated_at: new Date()
      };
      await platformsCol.insertOne(doc);
      return { lastID: nextId, changes: 1 };
    }

    return { changes: 0 };
  },

  async exec(sql) {
    // No-op for MongoDB
    return true;
  }
};
