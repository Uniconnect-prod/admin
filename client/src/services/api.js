import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const BASE_API_URL = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

const STORAGE = {
  token: 'token',
  refresh: 'refreshToken',
  user: 'user',
  platform: 'activePlatform',
  platforms: 'availablePlatforms'
};

export const session = {
  get token() { return localStorage.getItem(STORAGE.token); },
  get refreshToken() { return localStorage.getItem(STORAGE.refresh); },
  setTokens(token, refreshToken) {
    localStorage.setItem(STORAGE.token, token);
    if (refreshToken) localStorage.setItem(STORAGE.refresh, refreshToken);
  },
  read(key) {
    try { return JSON.parse(localStorage.getItem(STORAGE[key]) || 'null'); } catch { return null; }
  },
  write(key, value) {
    if (value === null || value === undefined) localStorage.removeItem(STORAGE[key]);
    else localStorage.setItem(STORAGE[key], JSON.stringify(value));
  },
  clear() {
    Object.values(STORAGE).forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('selectedCountry');
  }
};

const api = axios.create({ baseURL: BASE_API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = session.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // The active platform is sent on every request; the server re-validates access each time.
  if (!config.headers['x-platform-code']) {
    const platform = session.read('platform');
    if (platform?.code) config.headers['x-platform-code'] = platform.code;
    if (platform?.isAll && platform.country) config.headers['x-country'] = platform.country;
  }
  return config;
});

let refreshInFlight = null;
let onSessionEnded = () => { window.location.assign('/login?expired=1'); };

export function setSessionEndedHandler(fn) {
  onSessionEnded = fn;
}

async function refreshAccessToken() {
  // Single-flight: refresh tokens are single-use, so concurrent 401s must share one refresh.
  if (!refreshInFlight) {
    const refreshToken = session.refreshToken;
    refreshInFlight = (async () => {
      if (!refreshToken) throw new Error('No refresh token');
      const res = await axios.post(`${BASE_API_URL}/auth/refresh`, { refreshToken });
      session.setTokens(res.data.data.token, res.data.data.refreshToken);
      return res.data.data.token;
    })().finally(() => {
      setTimeout(() => { refreshInFlight = null; }, 0);
    });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  response => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthRoute = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (status === 401 && !original?._retry && !isAuthRoute && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN')) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        session.clear();
        onSessionEnded();
      }
    } else if (status === 401 && !isAuthRoute && ['ACCOUNT_INACTIVE', 'AUTH_REQUIRED'].includes(code)) {
      session.clear();
      onSessionEnded();
    }
    return Promise.reject(error);
  }
);

export function isCancel(err) {
  return axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';
}

/**
 * Normalise an API error into { code, message, detail, status }.
 */
export function describeError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return null;
  if (!err.response) {
    return { code: 'NETWORK_ERROR', status: 0, message: 'Cannot reach the reporting server. Check your connection and try again.' };
  }
  const data = err.response.data || {};
  return {
    code: data.code || `HTTP_${err.response.status}`,
    status: err.response.status,
    message: data.message || fallback,
    detail: data.detail || null,
    details: data.details || null,
    retryAfterSeconds: data.retryAfterSeconds || null,
    fromPlatformApi: data.source === 'platform_api'
  };
}

/**
 * Download a server-generated CSV. Returns export metadata from response headers.
 */
export async function downloadCsv(path, params) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : 'export.csv';
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {
    filename,
    rows: Number(res.headers['x-export-rows'] || 0),
    complete: res.headers['x-export-complete'] !== 'false',
    reportedTotal: res.headers['x-export-reported-total'] ? Number(res.headers['x-export-reported-total']) : null,
    duplicatesSkipped: Number(res.headers['x-export-duplicates-skipped'] || 0)
  };
}

/**
 * Blob error bodies (from CSV downloads) need to be parsed before describeError can read them.
 */
export async function describeBlobError(err) {
  if (err?.response?.data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await err.response.data.text());
    } catch {
      /* not JSON */
    }
  }
  return describeError(err);
}

export default api;
