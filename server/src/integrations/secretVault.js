import crypto from 'crypto';
import { config } from '../config/index.js';
import { IntegrationError } from './errors.js';

/**
 * AES-256-GCM encryption for platform API credentials at rest.
 * The key comes from INTEGRATION_SECRET_KEY (32 bytes, base64 or hex) and never leaves
 * the server. Encrypted values are never returned by any API.
 */

export const SECRET_FIELDS = ['token', 'api_key', 'username', 'password'];

let overrideKey = null;

export function setSecretKeyForTests(key) {
  overrideKey = key;
}

function loadKey() {
  const raw = overrideKey ?? config.integrationSecretKey;
  if (!raw) throw new IntegrationError('SECRET_KEY_MISSING');
  let key = null;
  if (/^[0-9a-f]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    try {
      key = Buffer.from(raw, 'base64');
    } catch {
      key = null;
    }
  }
  if (!key || key.length !== 32) throw new IntegrationError('SECRET_KEY_MISSING', 'INTEGRATION_SECRET_KEY must decode to exactly 32 bytes.');
  return key;
}

export function isVaultConfigured() {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext) {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decryptSecret(envelope) {
  if (!envelope) return null;
  const key = loadKey();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new IntegrationError('SECRET_KEY_MISSING', 'Stored credentials could not be decrypted (was INTEGRATION_SECRET_KEY changed?).');
  }
}

/**
 * Merge submitted secret changes into the stored encrypted set.
 *  - undefined / not present: keep the stored value
 *  - null or '' with clear flag: remove
 *  - non-empty string: replace
 */
export function mergeSecrets(stored = {}, submitted = {}, clear = []) {
  const next = {};
  for (const field of SECRET_FIELDS) {
    if (clear.includes(field)) continue;
    const value = submitted[field];
    if (typeof value === 'string' && value.length > 0) {
      if (value.length > 4096) throw new IntegrationError('INVALID_CONFIGURATION', `Secret '${field}' is too long.`);
      next[field] = encryptSecret(value);
    } else if (stored[field]) {
      next[field] = stored[field];
    }
  }
  return next;
}

export function decryptAll(stored = {}) {
  const out = {};
  for (const field of SECRET_FIELDS) {
    if (stored[field]) out[field] = decryptSecret(stored[field]);
  }
  return out;
}
