/**
 * SYNTHETIC mock platform APIs for automated tests and local development ONLY.
 * The numbers are generated deterministically and do not represent any real platform.
 *
 * Two deliberately different API styles are simulated:
 *
 *  ALPHA  (GHSuperWinnings-like)
 *    POST /api/admin/login            {email, password} → {success, token}
 *    GET  /api/admin/dashboard        ?fromDate&toDate&report=all|success|renewal|churn&page&limit
 *    Bearer token auth; envelope { success, summary, daily[], data[], total }
 *
 *  BETA   (different vendor conventions)
 *    GET  /v2/reports/kpis            ?start_date=DD/MM/YYYY&end_date=DD/MM/YYYY&type=…&offset&per_page
 *    X-Api-Key header; envelope { status:'ok', result:{ rows[], totals{}, items[] }, meta:{ total_count } }
 *    Amounts are strings with thousands separators ("1,234.50").
 */

export const ALPHA = {
  host: 'alpha.example.test',
  email: 'reporting@alpha.example.test',
  password: 'alpha-test-password',
  token: 'alpha-token-123'
};

export const BETA = {
  host: 'beta.example.test',
  apiKey: 'beta-key-456'
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pad = n => String(n).padStart(2, '0');

export function daysInRange(from, to) {
  const out = [];
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  for (let t = Date.UTC(y1, m1 - 1, d1); t <= Date.UTC(y2, m2 - 1, d2); t += 86400000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

/**
 * Deterministic synthetic day metrics (amounts held in integer cents to stay exact).
 */
export function dayMetrics(platform, date) {
  const h = hash(`${platform}:${date}`);
  const dailyTx = 40 + (h % 160);
  const ondemandTx = (h >>> 8) % 9;
  const dailyCents = dailyTx * 100 - ((h >>> 4) % 3) * 21;
  const ondemandCents = ondemandTx * 79;
  return {
    date,
    newSubscribers: 5 + ((h >>> 12) % 120),
    activationParking: (h >>> 16) % 40,
    renewals: 30 + ((h >>> 3) % 150),
    failedRenewals: (h >>> 6) % 60,
    deactivations: (h >>> 10) % 25,
    activeSubscribers: 4000 + ((h >>> 2) % 500),
    dailyTx,
    ondemandTx,
    dailyCents,
    ondemandCents,
    grandCents: dailyCents + ondemandCents
  };
}

export function recordsFor(platform, report, days) {
  const out = [];
  for (const date of days) {
    const m = dayMetrics(platform, date);
    const n = report === 'churn' ? m.deactivations : report === 'renewal' ? Math.min(m.renewals, 12) : Math.min(m.newSubscribers, 12);
    for (let i = 0; i < n; i++) {
      const h = hash(`${platform}:${report}:${date}:${i}`);
      out.push({
        id: `${platform}-${report}-${date}-${i}`,
        msisdn: `233${String(200000000 + (h % 99999999)).padStart(9, '0')}`,
        createdAt: `${date}T${pad(h % 24)}:${pad((h >>> 5) % 60)}:00.000Z`,
        offerCode: i % 5 === 0 ? '9923310009' : '9923310010',
        status: report === 'churn' ? 'deactivated' : 'success',
        type: report === 'churn' ? 'churn' : report === 'renewal' ? 'renewal' : 'new',
        chargingAmount: report === 'churn' ? 0 : (i % 5 === 0 ? 0.79 : 1),
        reason: report === 'churn' ? 'USER_INIT_REQUEST' : '-'
      });
    }
  }
  return out;
}

const json = (status, body, headers = {}) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  body: Buffer.from(JSON.stringify(body))
});

const fromDmy = s => (/^\d{2}\/\d{2}\/\d{4}$/.test(s || '') ? `${s.slice(6)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : null);
const toDmy = s => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const cents = c => Number((c / 100).toFixed(2));
const fmtThousands = c => (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function handleAlpha({ method, url, headers, body }) {
  if (url.pathname === '/api/admin/login' && method === 'POST') {
    let parsed = {};
    try { parsed = JSON.parse(body || '{}'); } catch { return json(400, { success: false, message: 'Bad JSON' }); }
    if (parsed.email === ALPHA.email && parsed.password === ALPHA.password) return json(200, { success: true, token: ALPHA.token });
    return json(401, { success: false, message: 'Invalid admin credentials' });
  }
  if (url.pathname === '/api/admin/dashboard' && method === 'GET') {
    if (headers.authorization !== `Bearer ${ALPHA.token}`) return json(401, { success: false, message: 'No token provided' });
    const q = url.searchParams;
    const from = q.get('fromDate');
    const to = q.get('toDate');
    if (!from || !to) return json(400, { success: false, message: 'fromDate and toDate are required' });
    const report = q.get('report') || 'all';
    const page = Math.max(1, Number(q.get('page') || 1));
    const limit = Math.min(Number(q.get('limit') || 50), report === 'renewal' || report === 'churn' ? 500 : 50);
    const days = daysInRange(from, to);
    const metrics = days.map(d => dayMetrics('alpha', d));
    const recordType = report === 'all' ? 'success' : report;
    const records = recordsFor('alpha', recordType, days);
    const sum = k => metrics.reduce((s, m) => s + m[k], 0);
    return json(200, {
      success: true,
      timezone: 'Africa/Accra',
      currency: 'GHS',
      summary: {
        newSubscriptions: sum('newSubscribers'),
        renewals: sum('renewals'),
        failed: sum('failedRenewals'),
        churn: sum('deactivations'),
        totalGhsAmount: cents(sum('grandCents'))
      },
      daily: metrics.map(m => ({
        date: m.date,
        newSubscriptions: m.newSubscribers,
        activationParking: m.activationParking,
        dailyRevenueGhs: cents(m.dailyCents),
        ondemandRevenueGhs: cents(m.ondemandCents),
        totalGhs: cents(m.grandCents),
        dailyTransactions: m.dailyTx,
        ondemandTransactions: m.ondemandTx,
        renewals: m.renewals,
        failedRenewals: m.failedRenewals,
        churn: m.deactivations,
        activeSubscribers: m.activeSubscribers
      })),
      data: records.slice((page - 1) * limit, page * limit),
      total: records.length,
      page,
      limit
    });
  }
  return json(404, { success: false, message: 'Not found' });
}

function handleBeta({ method, url, headers }) {
  if (url.pathname !== '/v2/reports/kpis' || method !== 'GET') return json(404, { status: 'error', error: { message: 'unknown route' } });
  if (headers['x-api-key'] !== BETA.apiKey) return json(403, { status: 'error', error: { message: 'invalid api key' } });
  const q = url.searchParams;
  const from = fromDmy(q.get('start_date'));
  const to = fromDmy(q.get('end_date'));
  if (!from || !to) return json(400, { status: 'error', error: { message: 'start_date/end_date must be DD/MM/YYYY' } });
  const type = q.get('type') || 'kpi';
  const offset = Math.max(0, Number(q.get('offset') || 0));
  const perPage = Math.min(Number(q.get('per_page') || 25), 100);
  const days = daysInRange(from, to);
  const metrics = days.map(d => dayMetrics('beta', d));
  const items = type === 'kpi' ? [] : recordsFor('beta', type === 'cancellations' ? 'churn' : 'success', days);
  const sum = k => metrics.reduce((s, m) => s + m[k], 0);
  return json(200, {
    status: 'ok',
    result: {
      rows: metrics.map(m => ({
        day: toDmy(m.date),
        subs: { new: String(m.newSubscribers), active: m.activeSubscribers },
        cancellations: m.deactivations,
        revenue: { amount: fmtThousands(m.grandCents), currency: 'NGN' }
      })),
      totals: { new_subs: sum('newSubscribers'), revenue: fmtThousands(sum('grandCents')) },
      items: items.slice(offset, offset + perPage).map(r => ({ ref: r.id, phone: r.msisdn, at: r.createdAt, state: r.status }))
    },
    meta: { total_count: items.length }
  });
}

/**
 * Pure request handler: ({ method, url: URL, headers, body }) → { status, headers, body: Buffer }
 */
export function mockPlatformHandler(req) {
  const host = req.url.hostname;
  if (host === ALPHA.host || req.url.pathname.startsWith('/api/admin')) return handleAlpha(req);
  if (host === BETA.host || req.url.pathname.startsWith('/v2/')) return handleBeta(req);
  return json(404, { message: 'unknown mock host' });
}

/**
 * Integration configurations matching the two mock APIs (used by tests and local demos).
 */
export function alphaIntegration(baseUrl = `https://${ALPHA.host}/api`) {
  return {
    base_url: baseUrl,
    auth: { type: 'login_token', login_path: '/admin/login', username_field: 'email', password_field: 'password', token_source: 'json', token_path: 'token', token_ttl_seconds: 600 },
    endpoints: { report: { path: '/admin/dashboard', method: 'GET' } },
    params: { from: 'fromDate', to: 'toDate', report_type: 'report', page: 'page', limit: 'limit' },
    date_param_format: 'YYYY-MM-DD',
    report_types: { overview: 'all', subscribers: 'success', renewals: 'renewal', churn: 'churn' },
    pagination: { strategy: 'page', applies_to: 'records', page_start: 1, page_size: 50, max_pages: 50, total_path: 'total' },
    response: { success_path: 'success', success_value: true, error_message_path: 'message', daily_path: 'daily', records_path: 'data', summary_path: 'summary' },
    mappings: {
      daily: {
        report_date: { path: 'date', format: 'YYYY-MM-DD' },
        new_subscribers: { path: 'newSubscriptions', label: 'New Subscriber Num' },
        activation_parking: { path: 'activationParking', label: 'Activation Parking' },
        daily_revenue: { path: 'dailyRevenueGhs', label: 'Super Winnings Daily' },
        ondemand_revenue: { path: 'ondemandRevenueGhs', label: 'Super Winnings on-demand Daily' },
        grand_total: { path: 'totalGhs', label: 'Grand Total' },
        daily_transactions: { path: 'dailyTransactions' },
        ondemand_transactions: { path: 'ondemandTransactions' },
        renewal_count: { path: 'renewals' },
        failed_renewal_count: { path: 'failedRenewals' },
        deactivations: { path: 'churn' },
        active_subscribers: { path: 'activeSubscribers' }
      },
      summary: {
        new_subscribers: { path: 'newSubscriptions' },
        renewal_count: { path: 'renewals' },
        failed_renewal_count: { path: 'failed' },
        deactivations: { path: 'churn' },
        grand_total: { path: 'totalGhsAmount' }
      },
      records: {
        record_id: { path: 'id' },
        msisdn: { path: 'msisdn' },
        event_time: { path: 'createdAt', format: 'auto' },
        event_type: { path: 'type' },
        status: { path: 'status' },
        offer_code: { path: 'offerCode' },
        amount: { path: 'chargingAmount' },
        reason: { path: 'reason' }
      }
    }
  };
}

export function betaIntegration(baseUrl = `https://${BETA.host}`) {
  return {
    base_url: baseUrl,
    auth: { type: 'api_key', header_name: 'X-Api-Key' },
    endpoints: { report: { path: '/v2/reports/kpis', method: 'GET' } },
    params: { from: 'start_date', to: 'end_date', report_type: 'type', offset: 'offset', limit: 'per_page' },
    date_param_format: 'DD/MM/YYYY',
    report_types: { overview: 'kpi', subscribers: 'subscriptions', churn: 'cancellations' },
    pagination: { strategy: 'offset', applies_to: 'records', page_size: 25, max_pages: 50, total_path: 'meta.total_count' },
    response: { success_path: 'status', success_value: 'ok', error_message_path: 'error.message', daily_path: 'result.rows', records_path: 'result.items', summary_path: 'result.totals' },
    currency_decimals: 2,
    mappings: {
      daily: {
        report_date: { path: 'day', format: 'DD/MM/YYYY' },
        new_subscribers: { path: 'subs.new' },
        active_subscribers: { path: 'subs.active' },
        deactivations: { path: 'cancellations' },
        grand_total: { path: 'revenue.amount', label: 'Revenue' }
      },
      summary: {
        new_subscribers: { path: 'new_subs' },
        grand_total: { path: 'revenue' }
      },
      records: {
        record_id: { path: 'ref' },
        msisdn: { path: 'phone' },
        event_time: { path: 'at', format: 'auto' },
        status: { path: 'state' }
      }
    }
  };
}

/**
 * Fake transport for the connector: routes requests to the mock handler without network I/O.
 * `intercept` may return a response to simulate failures.
 */
export function createMockTransport({ intercept = null, calls = [] } = {}) {
  return async ({ method, url, headers, body, signal }) => {
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    const req = { method, url: new URL(url.toString()), headers: Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: body ? String(body) : '' };
    calls.push(req);
    if (intercept) {
      const res = await intercept(req, calls.length);
      if (res) return res;
    }
    return mockPlatformHandler(req);
  };
}
