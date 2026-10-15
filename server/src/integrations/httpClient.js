import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { IntegrationError } from './errors.js';
import { checkUrlPolicy, createGuardedLookup } from './ssrfGuard.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = 'UniSolution-Reporting-Connector/2.0';

function mapNodeError(err) {
  const code = err?.code || '';
  if (err?.name === 'AbortError' || code === 'ABORT_ERR') return err;
  if (err instanceof IntegrationError) return err;
  if (code === 'EBLOCKEDDEST') return new IntegrationError('BLOCKED_DESTINATION', 'The host resolves to a private or reserved address.');
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA') return new IntegrationError('DNS_ERROR');
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return new IntegrationError('TIMEOUT');
  if (/^(CERT_|ERR_TLS_|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_SSL)/.test(code)) return new IntegrationError('TLS_ERROR');
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ECONNABORTED'].includes(code)) {
    return new IntegrationError('CONNECTION_ERROR');
  }
  return new IntegrationError('CONNECTION_ERROR');
}

/**
 * Default transport: Node http/https with a guarded DNS lookup, an overall deadline,
 * streaming size enforcement (also after decompression) and abort support.
 */
export function nodeTransport({ method, url, headers, body, timeoutMs = 15000, maxBytes, signal, allowPrivate }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener?.('abort', onAbort);
      fn(value);
    };

    const req = lib.request(url, {
      method,
      headers,
      lookup: createGuardedLookup({ allowPrivate }),
      agent: false
    });

    const deadline = setTimeout(() => {
      req.destroy();
      finish(reject, new IntegrationError('TIMEOUT', `No complete response within ${timeoutMs} ms.`));
    }, timeoutMs);

    const onAbort = () => {
      req.destroy();
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      finish(reject, abortErr);
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener?.('abort', onAbort, { once: true });

    req.on('error', err => finish(reject, mapNodeError(err)));
    req.on('response', res => {
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.destroy();
        req.destroy();
        return finish(reject, new IntegrationError('RESPONSE_TOO_LARGE', `Declared size ${declared} bytes exceeds ${maxBytes}.`));
      }
      let stream = res;
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      const chunks = [];
      let size = 0;
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          req.destroy();
          finish(reject, new IntegrationError('RESPONSE_TOO_LARGE', `Response exceeded ${maxBytes} bytes.`));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('error', err => finish(reject, mapNodeError(err)));
      stream.on('end', () => finish(resolve, { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });

    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

function sameOrigin(a, b) {
  return a.protocol === b.protocol && a.host === b.host;
}

/**
 * Perform one guarded outbound request.
 *
 * spec: { method, url, headers, body, timeoutMs, maxBytes, followRedirects, signal, sensitiveHeaders }
 * ctx:  { policy, transport }
 */
export async function safeRequest(spec, { policy, transport = nodeTransport, maxRedirects = 3 } = {}) {
  const method = String(spec.method || 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw new IntegrationError('INVALID_CONFIGURATION', `HTTP method ${method} is not permitted.`);

  let current = checkUrlPolicy(spec.url, policy);
  let headers = { 'user-agent': USER_AGENT, accept: 'application/json', 'accept-encoding': 'gzip, deflate, br', ...(spec.headers || {}) };
  let body = spec.body;
  if (body !== undefined && body !== null && !headers['content-length']) headers['content-length'] = Buffer.byteLength(body);
  let currentMethod = method;
  const started = Date.now();

  for (let hop = 0; ; hop++) {
    let res;
    try {
      res = await transport({
        method: currentMethod,
        url: current.url,
        headers,
        body,
        timeoutMs: spec.timeoutMs,
        maxBytes: spec.maxBytes,
        signal: spec.signal,
        allowPrivate: current.allowPrivate
      });
    } catch (err) {
      throw mapNodeError(err);
    }

    if (REDIRECT_STATUSES.has(res.status) && res.headers?.location && spec.followRedirects !== false && currentMethod === 'GET') {
      if (hop >= maxRedirects) throw new IntegrationError('TOO_MANY_REDIRECTS');
      let nextUrl;
      try {
        nextUrl = new URL(res.headers.location, current.url).toString();
      } catch {
        throw new IntegrationError('INVALID_URL', 'Redirect location is not a valid URL.');
      }
      const next = checkUrlPolicy(nextUrl, policy);
      if (!sameOrigin(current.url, next.url)) {
        // Never forward credentials to a different origin.
        const drop = new Set(['authorization', 'cookie', ...(spec.sensitiveHeaders || []).map(h => h.toLowerCase())]);
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !drop.has(k.toLowerCase())));
      }
      current = next;
      continue;
    }

    return {
      status: res.status,
      headers: res.headers || {},
      body: res.body || Buffer.alloc(0),
      bytes: res.body ? res.body.length : 0,
      durationMs: Date.now() - started,
      finalUrl: current.url,
      redirected: hop > 0
    };
  }
}

export function parseJsonBody(response) {
  const text = response.body.toString('utf8').replace(/^﻿/, '');
  if (!text.trim()) throw new IntegrationError('INVALID_JSON', 'The response body was empty.');
  try {
    return JSON.parse(text);
  } catch {
    const ct = String(response.headers['content-type'] || '');
    throw new IntegrationError('INVALID_JSON', ct.includes('html') ? 'Received an HTML page instead of JSON (check the endpoint path and authentication).' : null);
  }
}
