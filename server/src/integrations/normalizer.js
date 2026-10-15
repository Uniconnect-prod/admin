import { IntegrationError } from './errors.js';
import { resolvePath, getPath } from './jsonPath.js';
import { transformValue, parseInteger, parseBoolean } from './transforms.js';

/**
 * Converts a raw platform API response into the canonical reporting model using only the
 * saved configuration. It is deliberately strict:
 *  - a configured container (daily rows / records / summary) that is missing or of the wrong
 *    type is an UNEXPECTED_SCHEMA error, never an empty report;
 *  - a mapped value that is present but cannot be parsed is an error (no silent coercion);
 *  - a mapped value that is absent/null stays null and is reported as unavailable — never 0.
 */

function checkSuccess(json, response) {
  if (!response.success_path) return;
  const { found, value } = resolvePath(json, response.success_path);
  const expected = response.success_value;
  const ok = found && (value === expected || String(value) === String(expected));
  if (!ok) {
    const msg = response.error_message_path ? getPath(json, response.error_message_path) : null;
    throw new IntegrationError('API_REPORTED_FAILURE', typeof msg === 'string' ? `Platform message: "${msg.slice(0, 200)}"` : null);
  }
}

function newFieldStats(mapping) {
  const stats = {};
  for (const key of Object.keys(mapping || {})) stats[key] = { found: 0, missing: 0, nulls: 0, invalid: 0, errors: [] };
  return stats;
}

function mapObject(source, mapping, stats, timezone, location) {
  const values = {};
  for (const [key, field] of Object.entries(mapping || {})) {
    const { found, value } = resolvePath(source, field.path);
    if (!found) {
      stats[key].missing += 1;
      values[key] = null;
      continue;
    }
    if (value === null || value === undefined || value === '') {
      stats[key].nulls += 1;
      values[key] = null;
      continue;
    }
    const res = transformValue(value, field, timezone);
    if (!res.ok) {
      stats[key].invalid += 1;
      if (stats[key].errors.length < 3) stats[key].errors.push(`${location}: ${res.error}`);
      values[key] = null;
      continue;
    }
    stats[key].found += 1;
    values[key] = res.value;
  }
  return values;
}

function resolveArray(json, path, label) {
  const { found, value } = resolvePath(json, path);
  if (!found) throw new IntegrationError('UNEXPECTED_SCHEMA', `${label} were not found at '${path}'.`);
  if (!Array.isArray(value)) throw new IntegrationError('UNEXPECTED_SCHEMA', `${label} at '${path}' is not an array.`);
  return value;
}

function assertNoInvalid(stats, group) {
  for (const [key, s] of Object.entries(stats)) {
    if (s.invalid > 0) {
      throw new IntegrationError('UNEXPECTED_SCHEMA', `Field '${group}.${key}' has ${s.invalid} value(s) that could not be parsed (${s.errors[0]}).`, { fieldErrors: { [`${group}.${key}`]: s.errors } });
    }
  }
}

/**
 * @param json      parsed response body
 * @param config    integration configuration
 * @param options   { timezone, parts: ['daily','summary','records'], strict = true }
 */
export function normalizeResponse(json, config, { timezone = 'UTC', parts = ['daily', 'summary', 'records'], strict = true } = {}) {
  const response = config.response || {};
  const mappings = config.mappings || {};
  checkSuccess(json, response);

  const result = {
    daily: { present: false, rows: [] },
    summary: { present: false, values: {} },
    records: { present: false, rows: [] },
    pagination: {},
    fieldStats: { daily: newFieldStats(mappings.daily), summary: newFieldStats(mappings.summary), records: newFieldStats(mappings.records) }
  };

  // Daily rows ---------------------------------------------------------------
  const dailyKeys = Object.keys(mappings.daily || {});
  if (parts.includes('daily') && dailyKeys.length && response.daily_path) {
    const raw = resolveArray(json, response.daily_path, 'Daily rows');
    const seen = new Set();
    raw.forEach((row, i) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new IntegrationError('UNEXPECTED_SCHEMA', `Daily row ${i} is not an object.`);
      }
      const values = mapObject(row, mappings.daily, result.fieldStats.daily, timezone, `daily[${i}]`);
      if (!values.report_date) {
        if (strict) throw new IntegrationError('MISSING_REQUIRED_FIELDS', `Daily row ${i} has no valid report date.`);
        return;
      }
      if (seen.has(values.report_date)) {
        throw new IntegrationError('UNEXPECTED_SCHEMA', `The API returned more than one row for ${values.report_date}. Rows must be one per business day.`);
      }
      seen.add(values.report_date);
      result.daily.rows.push(values);
    });
    if (strict) assertNoInvalid(result.fieldStats.daily, 'daily');
    result.daily.present = true;
    result.daily.rows.sort((a, b) => a.report_date.localeCompare(b.report_date));
  }

  // Summary ------------------------------------------------------------------
  if (parts.includes('summary') && Object.keys(mappings.summary || {}).length) {
    const { found, value } = resolvePath(json, response.summary_path || '');
    if (!found || value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new IntegrationError('UNEXPECTED_SCHEMA', `Summary object not found at '${response.summary_path || '(root)'}'.`);
    }
    result.summary.values = mapObject(value, mappings.summary, result.fieldStats.summary, timezone, 'summary');
    if (strict) assertNoInvalid(result.fieldStats.summary, 'summary');
    result.summary.present = true;
  }

  // Records ------------------------------------------------------------------
  if (parts.includes('records') && response.records_path && Object.keys(mappings.records || {}).length) {
    const raw = resolveArray(json, response.records_path, 'Records');
    raw.forEach((row, i) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new IntegrationError('UNEXPECTED_SCHEMA', `Record ${i} is not an object.`);
      }
      result.records.rows.push(mapObject(row, mappings.records, result.fieldStats.records, timezone, `records[${i}]`));
    });
    if (strict) assertNoInvalid(result.fieldStats.records, 'records');
    result.records.present = true;
  }

  // Pagination metadata ------------------------------------------------------
  const pg = config.pagination || {};
  const readInt = (path) => {
    if (!path) return null;
    const { found, value } = resolvePath(json, path);
    if (!found || value === null) return null;
    const res = parseInteger(value);
    if (!res.ok) throw new IntegrationError('PAGINATION_ERROR', `Pagination value at '${path}' is not a whole number.`);
    return res.value;
  };
  result.pagination.total = readInt(pg.total_path);
  result.pagination.totalPages = readInt(pg.total_pages_path);
  if (pg.has_more_path) {
    const { found, value } = resolvePath(json, pg.has_more_path);
    result.pagination.hasMore = found ? parseBoolean(value).value : null;
  }
  if (pg.next_cursor_path) {
    const { found, value } = resolvePath(json, pg.next_cursor_path);
    result.pagination.nextCursor = found && value !== null && value !== '' ? String(value) : null;
  }

  return result;
}
