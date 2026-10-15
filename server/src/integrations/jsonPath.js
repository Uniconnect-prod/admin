/**
 * Minimal, safe path resolution for configured response mappings.
 *
 * Supported syntax: dot segments and numeric indexes, e.g.
 *   "data", "result.rows", "summary.totals.grandTotal", "items[0].value", "data.0.value"
 * An empty path refers to the value itself (the response root).
 *
 * No expressions, wildcards, filters or code evaluation are supported by design.
 */

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const SEGMENT_RE = /^[A-Za-z0-9_$@\- ]{1,100}$/;

export function parsePath(path) {
  if (path === undefined || path === null) return [];
  const str = String(path).trim();
  if (str === '' || str === '$') return [];
  if (str.length > 300) throw new Error('Path is too long.');
  const cleaned = str.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1');
  const parts = cleaned.split('.');
  for (const p of parts) {
    if (!p || FORBIDDEN_SEGMENTS.has(p) || !SEGMENT_RE.test(p)) {
      throw new Error(`Invalid path segment '${p}' in '${str}'.`);
    }
  }
  return parts;
}

export function isValidPath(path) {
  try {
    parsePath(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns { found: boolean, value } so callers can distinguish "missing" from null.
 */
export function resolvePath(obj, path) {
  const parts = parsePath(path);
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return { found: false, value: undefined };
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return { found: false, value: undefined };
    cur = cur[part];
  }
  return { found: true, value: cur };
}

export function getPath(obj, path) {
  return resolvePath(obj, path).value;
}
