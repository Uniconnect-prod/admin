import { DAILY_FIELDS, SUMMARY_FIELDS } from './canonicalFields.js';

const has = (obj, key) => Boolean(obj && obj[key]);

/**
 * Which canonical metrics and reports a (published) integration configuration can serve.
 * Drives which KPI cards, report sections and navigation items are shown, and which
 * metrics are reported as "unavailable" with the missing data named.
 */
export function describeCapabilities(config) {
  const m = config?.mappings || {};
  const daily = Object.keys(m.daily || {}).filter(k => k !== 'report_date');
  const summary = Object.keys(m.summary || {});
  const records = Object.keys(m.records || {});
  const rt = config?.report_types || {};
  const recordsConfigured = records.length > 0 && Boolean(config?.response?.records_path);
  const recordReports = {
    all: recordsConfigured && (Boolean(rt.all) || Boolean(rt.overview)),
    overview: recordsConfigured && (Boolean(rt.overview) || Boolean(rt.all)),
    subscribers: recordsConfigured && Boolean(rt.subscribers),
    renewals: recordsConfigured && Boolean(rt.renewals),
    churn: recordsConfigured && Boolean(rt.churn)
  };
  const any = (...keys) => keys.some(k => daily.includes(k) || summary.includes(k));
  const currencyFields = Object.keys(DAILY_FIELDS).filter(k => DAILY_FIELDS[k].kind === 'currency');

  return {
    daily,
    summary,
    records,
    recordReports,
    hasDailyRows: has(m.daily, 'report_date'),
    derived: {
      grand_total: !any('grand_total') && any('daily_revenue') && any('ondemand_revenue'),
      transaction_count: !any('transaction_count') && any('daily_transactions') && any('ondemand_transactions'),
      renewal_rate: any('renewal_count') && any('failed_renewal_count')
    },
    modules: {
      overview: true,
      settlement: has(m.daily, 'report_date') && daily.length > 0,
      revenue: currencyFields.some(k => daily.includes(k) || summary.includes(k)),
      subscribers: any('new_subscribers', 'subscriber_count', 'active_subscribers', 'activation_parking'),
      renewals: any('renewal_count', 'failed_renewal_count', 'successful_charges', 'failed_charges') || recordReports.renewals,
      churn: any('deactivations') || recordReports.churn,
      subscriber_records: recordReports.subscribers
    }
  };
}

export const ALL_SUMMARY_KEYS = Object.keys(SUMMARY_FIELDS);
