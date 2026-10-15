export function setIn(obj, path, value) {
  const parts = path.split('.');
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    cur[key] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

export function getIn(obj, path, fallback = '') {
  const v = path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  return v === undefined || v === null ? fallback : v;
}

export function errorsToMap(errors = []) {
  const map = {};
  for (const e of errors) if (!map[e.field]) map[e.field] = e.message;
  return map;
}

export const COMMON_TIMEZONES = [
  'Africa/Accra', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Johannesburg', 'Africa/Cairo', 'Africa/Abidjan',
  'Africa/Dar_es_Salaam', 'Africa/Kinshasa', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'UTC'
];

export const MODULE_OPTIONS = [
  { id: 'overview', label: 'Overview dashboard', locked: true },
  { id: 'settlement', label: 'Daily settlement report' },
  { id: 'revenue', label: 'Revenue analytics' },
  { id: 'subscribers', label: 'Subscriber analytics' },
  { id: 'renewals', label: 'Renewals & billing' },
  { id: 'churn', label: 'Deactivations & churn' },
  { id: 'subscriber_records', label: 'Subscriber list' }
];

export const STEPS = [
  { id: 'details', label: 'Platform details', short: 'Details' },
  { id: 'api', label: 'API configuration', short: 'API' },
  { id: 'params', label: 'Request parameters', short: 'Parameters' },
  { id: 'inspect', label: 'Response inspection', short: 'Inspect' },
  { id: 'mapping', label: 'Field mapping', short: 'Mapping' },
  { id: 'validate', label: 'Validate & activate', short: 'Activate' }
];

/**
 * Collect candidate paths from an inspection result to suggest mapping paths.
 */
export function pathSuggestions(inspection) {
  const containers = inspection?.structure?.containers || [];
  const arrays = containers.filter(c => c.kind === 'array');
  const objects = containers.filter(c => c.kind === 'object');
  return {
    containers: containers.map(c => ({ path: c.path, kind: c.kind, length: c.length })),
    itemFields: Object.fromEntries(arrays.map(a => [a.path, a.itemFields || []])),
    objectFields: Object.fromEntries(objects.map(o => [o.path, o.fields || []]))
  };
}
