/**
 * Documented, declarative value transforms for mapped API fields.
 * Every parser returns { ok, value, error } and treats null/undefined/'' as a MISSING
 * value (value: null) — never as zero.
 */

export const FIELD_TYPES = ['decimal', 'integer', 'string', 'date', 'datetime', 'boolean'];
export const DATE_FORMATS = ['auto', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD/MM/YY', 'DD-MM-YYYY', 'YYYYMMDD', 'iso_datetime', 'epoch_ms', 'epoch_s'];

const isBlank = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function parseDecimal(value, { decimalSeparator = '.' } = {}) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, value: null, error: 'Not a finite number' };
  }
  if (typeof value !== 'string') return { ok: false, value: null, error: `Expected a number, got ${Array.isArray(value) ? 'array' : typeof value}` };
  let s = value.trim().replace(/^[A-Za-z₵$€£₦]{1,4}\s*/, '').replace(/\s*[A-Za-z₵$€£₦]{1,4}$/, '').replace(/\s/g, '');
  if (decimalSeparator === ',') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return { ok: false, value: null, error: `'${value}' is not a number` };
  const n = Number(s);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value: null, error: `'${value}' is not a finite number` };
}

export function parseInteger(value, opts) {
  const res = parseDecimal(value, opts);
  if (!res.ok || res.value === null) return res;
  if (!Number.isInteger(res.value)) return { ok: false, value: null, error: `'${value}' is not a whole number` };
  return res;
}

export function parseBoolean(value) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value === 'boolean') return { ok: true, value };
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return { ok: true, value: true };
  if (['false', '0', 'no', 'n'].includes(s)) return { ok: true, value: false };
  return { ok: false, value: null, error: `'${value}' is not a boolean` };
}

function isRealDate(y, m, d) {
  if (!(y >= 1970 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = n => String(n).padStart(2, '0');
const dayKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function dayKeyInTimezone(date, timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = t => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Parse a date value into a 'YYYY-MM-DD' business-day key.
 * Datetimes (ISO strings with a time component or epochs) are converted into the
 * platform's business timezone before taking the calendar day.
 */
export function parseDateKey(value, format = 'auto', timezone = 'UTC') {
  if (isBlank(value)) return { ok: true, value: null };
  const s = typeof value === 'string' ? value.trim() : value;
  const fail = () => ({ ok: false, value: null, error: `'${value}' does not match date format ${format}` });
  const fromParts = (y, m, d) => (isRealDate(y, m, d) ? { ok: true, value: dayKey(y, m, d) } : fail());

  const fromInstant = (ms) => {
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return fail();
    return { ok: true, value: dayKeyInTimezone(dt, timezone) };
  };

  let m;
  switch (format) {
    case 'YYYY-MM-DD':
      m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
      return m ? fromParts(+m[1], +m[2], +m[3]) : fail();
    case 'DD/MM/YYYY':
      m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s));
      return m ? fromParts(+m[3], +m[2], +m[1]) : fail();
    case 'MM/DD/YYYY':
      m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s));
      return m ? fromParts(+m[3], +m[1], +m[2]) : fail();
    case 'DD/MM/YY':
      m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(String(s));
      return m ? fromParts(2000 + +m[3], +m[2], +m[1]) : fail();
    case 'DD-MM-YYYY':
      m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s));
      return m ? fromParts(+m[3], +m[2], +m[1]) : fail();
    case 'YYYYMMDD':
      m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s));
      return m ? fromParts(+m[1], +m[2], +m[3]) : fail();
    case 'epoch_ms': {
      const n = Number(s);
      return Number.isFinite(n) ? fromInstant(n) : fail();
    }
    case 'epoch_s': {
      const n = Number(s);
      return Number.isFinite(n) ? fromInstant(n * 1000) : fail();
    }
    case 'iso_datetime': {
      if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(s)) return fail();
      return fromInstant(Date.parse(s));
    }
    case 'auto':
    default: {
      if (typeof s === 'string') {
        m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (m) return fromParts(+m[1], +m[2], +m[3]);
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fromInstant(Date.parse(s));
      }
      return { ok: false, value: null, error: `'${value}' is not an unambiguous date; configure an explicit date format` };
    }
  }
}

export function parseDateTime(value, format = 'auto') {
  if (isBlank(value)) return { ok: true, value: null };
  let ms;
  if (format === 'epoch_ms') ms = Number(value);
  else if (format === 'epoch_s') ms = Number(value) * 1000;
  else ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) return { ok: false, value: null, error: `'${value}' is not a valid timestamp` };
  return { ok: true, value: new Date(ms).toISOString() };
}

/**
 * Apply a field mapping definition { type, format, decimal_separator } to a raw value.
 */
export function transformValue(raw, field = {}, timezone = 'UTC') {
  switch (field.type) {
    case 'integer': return parseInteger(raw, { decimalSeparator: field.decimal_separator });
    case 'decimal': return parseDecimal(raw, { decimalSeparator: field.decimal_separator });
    case 'date': return parseDateKey(raw, field.format || 'auto', timezone);
    case 'datetime': return parseDateTime(raw, field.format || 'auto');
    case 'boolean': return parseBoolean(raw);
    case 'string':
    default:
      if (isBlank(raw)) return { ok: true, value: null };
      if (typeof raw === 'object') return { ok: false, value: null, error: 'Expected a scalar value, got an object' };
      return { ok: true, value: String(raw) };
  }
}

// ---------------------------------------------------------------------------
// Exact money arithmetic
// ---------------------------------------------------------------------------

const SCALE = 1_000_000n; // micro-units

function decimalStringToMicros(str) {
  const m = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(str);
  if (!m) return null;
  const sign = m[1] === '-' ? -1n : 1n;
  const whole = BigInt(m[2] || '0');
  const frac = (m[3] || '').padEnd(7, '0');
  let micros = whole * SCALE + BigInt(frac.slice(0, 6));
  if (Number(frac[6]) >= 5) micros += 1n; // round half up at the 7th decimal
  return sign * micros;
}

export function toMicros(value) {
  if (value === null || value === undefined) return null;
  const str = typeof value === 'number' ? String(value) : String(value).trim();
  if (/e/i.test(str)) return BigInt(Math.round(Number(str) * 1e6));
  return decimalStringToMicros(str);
}

export function microsToNumber(micros, decimals = 2) {
  if (micros === null || micros === undefined) return null;
  const factor = 10n ** BigInt(6 - decimals);
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  let units = abs / factor;
  if ((abs % factor) * 2n >= factor) units += 1n; // round half up
  const n = Number(units) / 10 ** decimals;
  return negative ? -n : n;
}

/**
 * Sum decimal values exactly. Returns null when there are no non-null values,
 * so "no data" is never presented as 0.
 */
export function sumExact(values, decimals = 2) {
  let total = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const micros = toMicros(v);
    if (micros === null) continue;
    total = (total ?? 0n) + micros;
  }
  return total === null ? null : microsToNumber(total, decimals);
}

export function sumIntegers(values) {
  let total = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    total = (total ?? 0) + v;
  }
  return total;
}
