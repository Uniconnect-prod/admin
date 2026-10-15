import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;
import {
  clone,
  matches,
  applyUpdate,
  applyProjection,
  sortDocs,
  seedFromFilter
} from './memoryStore.js';

/**
 * PostgreSQL store adapter implementing the same Collection interface
 * as MongoDB and memoryStore for the reporting admin database.
 */

function buildWhere(filter, params) {
  if (!filter || Object.keys(filter).length === 0) return '';
  const clauses = [];

  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      if (!Array.isArray(val) || val.length === 0) continue;
      const orClauses = [];
      for (const branch of val) {
        const branchWhere = buildWhere(branch, params);
        if (branchWhere) orClauses.push(`(${branchWhere})`);
      }
      if (orClauses.length > 0) {
        clauses.push(`(${orClauses.join(' OR ')})`);
      }
    } else if (key === '_id') {
      params.push(String(val));
      clauses.push(`_id = $${params.length}`);
    } else if (key === 'id' && (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val)))) {
      params.push(Number(val));
      clauses.push(`id = $${params.length}`);
    } else if (val === null) {
      clauses.push(`(data->>'${key}' IS NULL OR data->'${key}' = 'null'::jsonb)`);
    } else if (val instanceof RegExp) {
      params.push(val.source);
      clauses.push(`data->>'${key}' ~* $${params.length}`);
    } else if (typeof val === 'string') {
      params.push(val);
      clauses.push(`data->>'${key}' = $${params.length}`);
    } else if (typeof val === 'number') {
      params.push(val);
      clauses.push(`(data->>'${key}')::numeric = $${params.length}`);
    } else if (typeof val === 'boolean') {
      params.push(val);
      clauses.push(`(data->>'${key}')::boolean = $${params.length}`);
    } else if (typeof val === 'object' && val !== null) {
      if (val.$in && Array.isArray(val.$in)) {
        if (val.$in.length === 0) {
          clauses.push('FALSE');
        } else {
          params.push(val.$in.map(v => String(v)));
          clauses.push(`data->>'${key}' = ANY($${params.length}::text[])`);
        }
      } else if (val.$nin && Array.isArray(val.$nin)) {
        if (val.$nin.length > 0) {
          params.push(val.$nin.map(v => String(v)));
          clauses.push(`NOT (data->>'${key}' = ANY($${params.length}::text[]))`);
        }
      } else if (val.$ne !== undefined) {
        if (val.$ne === null) {
          clauses.push(`(data->>'${key}' IS NOT NULL AND data->'${key}' != 'null'::jsonb)`);
        } else {
          params.push(String(val.$ne));

          clauses.push(`(data->>'${key}' != $${params.length}::text OR data->'${key}' IS NULL)`);
        }
      } else if (val.$regex) {
        const pat = val.$regex instanceof RegExp ? val.$regex.source : String(val.$regex);
        params.push(pat);
        clauses.push(`data->>'${key}' ~* $${params.length}`);
      } else if (val.$gte !== undefined || val.$lte !== undefined || val.$gt !== undefined || val.$lt !== undefined) {
        if (val.$gte !== undefined) {
          params.push(val.$gte instanceof Date ? val.$gte.toISOString() : String(val.$gte));
          clauses.push(`(data->>'${key}')::timestamptz >= $${params.length}::timestamptz`);
        }
        if (val.$lte !== undefined) {
          params.push(val.$lte instanceof Date ? val.$lte.toISOString() : String(val.$lte));
          clauses.push(`(data->>'${key}')::timestamptz <= $${params.length}::timestamptz`);
        }
        if (val.$gt !== undefined) {
          params.push(val.$gt instanceof Date ? val.$gt.toISOString() : String(val.$gt));
          clauses.push(`(data->>'${key}')::timestamptz > $${params.length}::timestamptz`);
        }
        if (val.$lt !== undefined) {
          params.push(val.$lt instanceof Date ? val.$lt.toISOString() : String(val.$lt));
          clauses.push(`(data->>'${key}')::timestamptz < $${params.length}::timestamptz`);
        }
      } else if (val.$exists !== undefined) {
        if (val.$exists) {
          clauses.push(`data ? '${key}'`);
        } else {
          clauses.push(`NOT (data ? '${key}')`);
        }
      }
    }
  }

  return clauses.length ? clauses.join(' AND ') : '';
}

function buildOrderBy(spec) {
  if (!spec || Object.keys(spec).length === 0) return '';
  const parts = [];
  for (const [field, dir] of Object.entries(spec)) {
    const direction = Number(dir) < 0 ? 'DESC' : 'ASC';
    if (field === 'id') {
      parts.push(`id ${direction} NULLS LAST`);
    } else if (field === 'created_at') {
      parts.push(`created_at ${direction} NULLS LAST`);
    } else {
      parts.push(`(data->>'${field}') ${direction} NULLS LAST`);
    }
  }
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

class PgCursor {
  constructor(collection, filter, projection) {
    this._col = collection;
    this._filter = filter;
    this._projection = projection;
    this._sort = null;
    this._skip = 0;
    this._limit = 0;
  }

  sort(spec) {
    this._sort = spec;
    return this;
  }

  skip(n) {
    this._skip = Math.max(0, parseInt(n, 10) || 0);
    return this;
  }

  limit(n) {
    this._limit = Math.max(0, parseInt(n, 10) || 0);
    return this;
  }

  project(p) {
    this._projection = p;
    return this;
  }

  async toArray() {
    const params = [];
    const where = buildWhere(this._filter, params);
    let sql = `SELECT data FROM ${this._col.tableName}`;
    if (where) sql += ` WHERE ${where}`;

    const orderBy = buildOrderBy(this._sort);
    if (orderBy) sql += ` ${orderBy}`;

    if (this._limit > 0) {
      params.push(this._limit);
      sql += ` LIMIT $${params.length}`;
    }
    if (this._skip > 0) {
      params.push(this._skip);
      sql += ` OFFSET $${params.length}`;
    }

    const res = await this._col.pool.query(sql, params);
    let docs = res.rows.map(r => r.data);

    // Apply any in-memory filter refinement if complex non-SQL operators were passed
    if (this._filter && Object.keys(this._filter).length > 0) {
      docs = docs.filter(d => matches(d, this._filter));
    }

    if (this._projection) {
      docs = docs.map(d => applyProjection(clone(d), this._projection));
    }

    return docs;
  }
}

class PgCollection {
  constructor(tableName, pool) {
    this.tableName = tableName;
    this.pool = pool;
  }

  async _ensureTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        _id TEXT PRIMARY KEY,
        id NUMERIC,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS "${this.tableName}_id_idx" ON ${this.tableName} (id);
      CREATE INDEX IF NOT EXISTS "${this.tableName}_created_at_idx" ON ${this.tableName} (created_at);
    `);
  }

  find(filter = {}, { projection = null } = {}) {
    return new PgCursor(this, filter, projection);
  }

  async findOne(filter = {}, { projection = null } = {}) {
    const docs = await this.find(filter, { projection }).limit(1).toArray();
    return docs[0] || null;
  }

  async insertOne(doc) {
    const cloned = clone(doc);
    const _id = String(cloned._id || crypto.randomUUID());
    cloned._id = _id;
    const id = Number.isFinite(Number(cloned.id)) ? Number(cloned.id) : null;
    const createdAt = cloned.created_at ? new Date(cloned.created_at) : new Date();
    const updatedAt = cloned.updated_at ? new Date(cloned.updated_at) : null;

    await this.pool.query(
      `INSERT INTO ${this.tableName} (_id, id, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (_id) DO UPDATE SET data = $3, id = $2, updated_at = $5`,
      [_id, id, JSON.stringify(cloned), createdAt, updatedAt]
    );

    return { acknowledged: true, insertedId: _id };
  }

  async insertMany(docs) {
    for (const d of docs) {
      await this.insertOne(d);
    }
    return {
      acknowledged: true,
      insertedCount: docs.length,
      insertedIds: docs.map((d, i) => d._id || i)
    };
  }

  async updateOne(filter, update, options = {}) {
    const existing = await this.findOne(filter);
    if (!existing) {
      if (options.upsert) {
        const newDoc = seedFromFilter(filter);
        if (!newDoc._id) newDoc._id = crypto.randomUUID();
        applyUpdate(newDoc, update, true);
        await this.insertOne(newDoc);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: newDoc._id };
      }
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    const updated = clone(existing);
    applyUpdate(updated, update, false);
    const id = Number.isFinite(Number(updated.id)) ? Number(updated.id) : null;
    const updatedAt = new Date();
    updated.updated_at = updatedAt.toISOString();

    await this.pool.query(
      `UPDATE ${this.tableName} SET data = $2, id = $3, updated_at = $4 WHERE _id = $1`,
      [existing._id, JSON.stringify(updated), id, updatedAt]
    );

    return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async updateMany(filter, update, options = {}) {
    const docs = await this.find(filter).toArray();
    for (const doc of docs) {
      const updated = clone(doc);
      applyUpdate(updated, update, false);
      const id = Number.isFinite(Number(updated.id)) ? Number(updated.id) : null;
      const updatedAt = new Date();
      updated.updated_at = updatedAt.toISOString();
      await this.pool.query(
        `UPDATE ${this.tableName} SET data = $2, id = $3, updated_at = $4 WHERE _id = $1`,
        [doc._id, JSON.stringify(updated), id, updatedAt]
      );
    }
    return { acknowledged: true, matchedCount: docs.length, modifiedCount: docs.length };
  }

  async deleteOne(filter) {
    const doc = await this.findOne(filter);
    if (!doc) return { acknowledged: true, deletedCount: 0 };
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE _id = $1`, [doc._id]);
    return { acknowledged: true, deletedCount: 1 };
  }

  async deleteMany(filter) {
    const docs = await this.find(filter).toArray();
    if (docs.length === 0) return { acknowledged: true, deletedCount: 0 };
    const ids = docs.map(d => d._id);
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE _id = ANY($1::text[])`, [ids]);
    return { acknowledged: true, deletedCount: ids.length };
  }

  async countDocuments(filter = {}) {
    const params = [];
    const where = buildWhere(filter, params);
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}` + (where ? ` WHERE ${where}` : '');
    const res = await this.pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  async createIndex(spec, options = {}) {
    for (const key of Object.keys(spec)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      const idxName = `${this.tableName}_${safeKey}_idx`.slice(0, 60);
      const unique = options.unique ? 'UNIQUE' : '';
      try {
        if (key === 'id') {
          await this.pool.query(`CREATE ${unique} INDEX IF NOT EXISTS "${idxName}" ON ${this.tableName} (id);`);
        } else if (key === 'created_at') {
          await this.pool.query(`CREATE INDEX IF NOT EXISTS "${idxName}" ON ${this.tableName} (created_at);`);
        } else {
          await this.pool.query(`CREATE ${unique} INDEX IF NOT EXISTS "${idxName}" ON ${this.tableName} ((data->>'${safeKey}'));`);
        }
      } catch {
        // Safe to ignore duplicate index or conflict
      }
    }
  }

  async findOneAndUpdate(filter, update, options = {}) {
    // Atomic optimization for atomic counters
    if (filter._id && update.$inc && Object.keys(update).length === 1) {
      const incKey = Object.keys(update.$inc)[0];
      const incVal = Number(update.$inc[incKey]) || 1;
      const res = await this.pool.query(
        `INSERT INTO ${this.tableName} (_id, id, data, created_at, updated_at)
         VALUES ($1, NULL, jsonb_build_object('_id', $1::text, '${incKey}', $2::numeric), NOW(), NOW())
         ON CONFLICT (_id) DO UPDATE
         SET data = jsonb_set(${this.tableName}.data, '{${incKey}}', to_jsonb(COALESCE((${this.tableName}.data->>'${incKey}')::numeric, 0) + $2::numeric)),
             updated_at = NOW()
         RETURNING data;`,
        [String(filter._id), incVal]
      );
      if (res.rows[0]) return res.rows[0].data;
    }

    const before = await this.findOne(filter);
    await this.updateOne(filter, update, options);
    if (options.returnDocument === 'after') {
      if (before) return this.findOne({ _id: before._id });
      return this.findOne(filter);
    }
    return before;
  }
}

export async function createPgStore(connectionString) {
  if (!connectionString) {
    throw new Error('[Store] PostgreSQL connection string is required.');
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Verify connection
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT current_database() as db, version() as v');
    console.log(`[Store] Reporting admin PostgreSQL connected to '${res.rows[0].db}'.`);
  } finally {
    client.release();
  }

  const collections = new Map();

  function getCollection(name) {
    const safeName = String(name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!collections.has(safeName)) {
      const col = new PgCollection(safeName, pool);
      collections.set(safeName, col);
    }
    return collections.get(safeName);
  }

  return {
    kind: 'postgres',
    collection: (name) => getCollection(name),
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async close() {
      await pool.end();
    },
    async ensureAllTables(names) {
      for (const name of names) {
        await getCollection(name)._ensureTable();
      }
    }
  };
}
