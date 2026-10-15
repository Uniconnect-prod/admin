import crypto from 'crypto';

/**
 * In-memory implementation of the subset of the MongoDB collection API used by the
 * repositories. Used by the automated tests and by REPORTING_STORE=memory local runs,
 * so the reporting admin database can be exercised without a live cluster.
 */

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function getPath(doc, path) {
  if (!path.includes('.')) return doc?.[path];
  let cur = doc;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setPath(doc, path, value) {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

export function unsetPath(doc, path) {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (!cur) return;
  }
  delete cur[parts[parts.length - 1]];
}

function comparable(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

function valuesEqual(a, b) {
  if (a instanceof Date || b instanceof Date) return comparable(a) === comparable(b);
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function matchOperand(actual, expected) {
  if (expected instanceof RegExp) {
    const values = Array.isArray(actual) ? actual : [actual];
    return values.some(v => typeof v === 'string' && expected.test(v));
  }
  if (expected !== null && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
    const keys = Object.keys(expected);
    if (keys.length > 0 && keys.every(k => k.startsWith('$'))) {
      return keys.every(op => matchOperator(actual, op, expected[op], expected));
    }
  }
  if (Array.isArray(actual) && !Array.isArray(expected)) {
    return actual.some(v => valuesEqual(v, expected));
  }
  return valuesEqual(actual, expected);
}

function compare(actual, expected, fn) {
  const values = Array.isArray(actual) ? actual : [actual];
  return values.some(v => v !== undefined && v !== null && fn(comparable(v), comparable(expected)));
}

function matchOperator(actual, op, operand, all) {
  switch (op) {
    case '$eq': return matchOperand(actual, operand);
    case '$ne': return !matchOperand(actual, operand);
    case '$in': return operand.some(o => matchOperand(actual, o));
    case '$nin': return !operand.some(o => matchOperand(actual, o));
    case '$gt': return compare(actual, operand, (a, b) => a > b);
    case '$gte': return compare(actual, operand, (a, b) => a >= b);
    case '$lt': return compare(actual, operand, (a, b) => a < b);
    case '$lte': return compare(actual, operand, (a, b) => a <= b);
    case '$exists': return operand ? actual !== undefined : actual === undefined;
    case '$regex': {
      const re = operand instanceof RegExp ? operand : new RegExp(operand, all.$options || '');
      return matchOperand(actual, re);
    }
    case '$options': return true;
    default:
      throw new Error(`memoryStore: unsupported operator ${op}`);
  }
}

export function matches(doc, filter = {}) {
  for (const [key, expected] of Object.entries(filter || {})) {
    if (key === '$or') {
      if (!expected.some(f => matches(doc, f))) return false;
    } else if (key === '$and') {
      if (!expected.every(f => matches(doc, f))) return false;
    } else if (key === '$nor') {
      if (expected.some(f => matches(doc, f))) return false;
    } else if (!matchOperand(getPath(doc, key), expected)) {
      return false;
    }
  }
  return true;
}

export function applyProjection(doc, projection) {
  if (!projection || Object.keys(projection).length === 0) return doc;
  const includes = Object.entries(projection).filter(([, v]) => v);
  if (includes.length > 0) {
    const out = {};
    if (projection._id !== 0) out._id = doc._id;
    for (const [k] of includes) {
      const v = getPath(doc, k);
      if (v !== undefined) setPath(out, k, v);
    }
    return out;
  }
  const out = clone(doc);
  for (const [k, v] of Object.entries(projection)) if (!v) unsetPath(out, k);
  return out;
}

export function sortDocs(docs, spec) {
  const entries = Object.entries(spec || {});
  if (!entries.length) return docs;
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = comparable(getPath(a, field));
      const bv = comparable(getPath(b, field));
      if (av === bv) continue;
      if (av === undefined || av === null) return -1 * dir;
      if (bv === undefined || bv === null) return 1 * dir;
      return (av < bv ? -1 : 1) * dir;
    }
    return 0;
  });
}

class MemoryCursor {
  constructor(source, projection) {
    this._source = source;
    this._projection = projection;
    this._sort = null;
    this._skip = 0;
    this._limit = 0;
  }
  sort(spec) { this._sort = spec; return this; }
  skip(n) { this._skip = n; return this; }
  limit(n) { this._limit = n; return this; }
  project(p) { this._projection = p; return this; }
  async toArray() {
    let docs = this._sort ? sortDocs(this._source, this._sort) : this._source;
    docs = docs.slice(this._skip, this._limit ? this._skip + this._limit : undefined);
    return docs.map(d => applyProjection(clone(d), this._projection));
  }
}

export function applyUpdate(doc, update, isInsert) {
  for (const [op, fields] of Object.entries(update)) {
    switch (op) {
      case '$set':
        for (const [k, v] of Object.entries(fields)) setPath(doc, k, clone(v));
        break;
      case '$setOnInsert':
        if (isInsert) for (const [k, v] of Object.entries(fields)) setPath(doc, k, clone(v));
        break;
      case '$unset':
        for (const k of Object.keys(fields)) unsetPath(doc, k);
        break;
      case '$inc':
        for (const [k, v] of Object.entries(fields)) setPath(doc, k, (getPath(doc, k) || 0) + v);
        break;
      case '$push':
        for (const [k, v] of Object.entries(fields)) {
          const arr = getPath(doc, k) || [];
          arr.push(clone(v));
          setPath(doc, k, arr);
        }
        break;
      default:
        throw new Error(`memoryStore: unsupported update operator ${op}`);
    }
  }
}

export function seedFromFilter(filter) {
  const doc = {};
  for (const [k, v] of Object.entries(filter || {})) {
    if (k.startsWith('$')) continue;
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && Object.keys(v).some(x => x.startsWith('$'))) continue;
    setPath(doc, k, clone(v));
  }
  return doc;
}

export class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
    this.uniqueIndexes = [];
  }

  _checkUnique(candidate, ignoreId) {
    for (const fields of this.uniqueIndexes) {
      const clash = this.docs.find(d => d._id !== ignoreId && fields.every(f => {
        const a = getPath(d, f);
        const b = getPath(candidate, f);
        return a !== undefined && b !== undefined && valuesEqual(a, b);
      }));
      if (clash) {
        const err = new Error(`E11000 duplicate key error collection: ${this.name} index: ${fields.join('_')}`);
        err.code = 11000;
        throw err;
      }
    }
  }

  find(filter = {}, options = {}) {
    return new MemoryCursor(this.docs.filter(d => matches(d, filter)), options.projection);
  }

  async findOne(filter = {}, options = {}) {
    const doc = this.docs.find(d => matches(d, filter));
    return doc ? applyProjection(clone(doc), options.projection) : null;
  }

  async insertOne(doc) {
    const copy = clone(doc);
    if (copy._id === undefined) copy._id = crypto.randomBytes(12).toString('hex');
    if (this.docs.some(d => valuesEqual(d._id, copy._id))) {
      const err = new Error(`E11000 duplicate key error collection: ${this.name} index: _id_`);
      err.code = 11000;
      throw err;
    }
    this._checkUnique(copy);
    this.docs.push(copy);
    return { acknowledged: true, insertedId: copy._id };
  }

  async insertMany(docs) {
    const ids = [];
    for (const d of docs) ids.push((await this.insertOne(d)).insertedId);
    return { acknowledged: true, insertedCount: ids.length, insertedIds: ids };
  }

  async updateOne(filter, update, options = {}) {
    const idx = this.docs.findIndex(d => matches(d, filter));
    if (idx === -1) {
      if (!options.upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      const doc = seedFromFilter(filter);
      applyUpdate(doc, update, true);
      const res = await this.insertOne(doc);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: res.insertedId };
    }
    const updated = clone(this.docs[idx]);
    applyUpdate(updated, update, false);
    this._checkUnique(updated, updated._id);
    this.docs[idx] = updated;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter, update) {
    let count = 0;
    for (let i = 0; i < this.docs.length; i++) {
      if (matches(this.docs[i], filter)) {
        const updated = clone(this.docs[i]);
        applyUpdate(updated, update, false);
        this.docs[i] = updated;
        count++;
      }
    }
    return { acknowledged: true, matchedCount: count, modifiedCount: count };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const before = await this.findOne(filter);
    await this.updateOne(filter, update, options);
    if (options.returnDocument === 'after') {
      if (before) return this.findOne({ _id: before._id });
      return this.findOne(filter);
    }
    return before;
  }

  async deleteOne(filter) {
    const idx = this.docs.findIndex(d => matches(d, filter));
    if (idx === -1) return { acknowledged: true, deletedCount: 0 };
    this.docs.splice(idx, 1);
    return { acknowledged: true, deletedCount: 1 };
  }

  async deleteMany(filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter(d => !matches(d, filter));
    return { acknowledged: true, deletedCount: before - this.docs.length };
  }

  async countDocuments(filter = {}) {
    return this.docs.filter(d => matches(d, filter)).length;
  }

  async estimatedDocumentCount() {
    return this.docs.length;
  }

  async createIndex(spec, options = {}) {
    if (options.unique) this.uniqueIndexes.push(Object.keys(spec));
    return Object.keys(spec).join('_');
  }
}

export function createMemoryStore() {
  const collections = new Map();
  return {
    kind: 'memory',
    collection(name) {
      if (!collections.has(name)) collections.set(name, new MemoryCollection(name));
      return collections.get(name);
    },
    async ping() { return true; },
    async close() { collections.clear(); }
  };
}
