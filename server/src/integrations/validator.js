import { IntegrationError, classifyHttpStatus } from './errors.js';
import { checkUrlPolicy } from './ssrfGuard.js';
import { resolveAuthHeaders } from './authStrategies.js';
import { buildReportRequest } from './requestBuilder.js';
import { parseJsonBody } from './httpClient.js';
import { normalizeResponse } from './normalizer.js';
import { describeCapabilities } from './capabilities.js';
import { DAILY_FIELDS } from './canonicalFields.js';
import { sumExact, sumIntegers } from './transforms.js';
import { normalizeModules } from '../repositories/platformRepository.js';

/**
 * Full validation run for a draft integration. Activation is only allowed when no check
 * has FAILED. An HTTP 200 on its own is never sufficient: structure, mappings, data types,
 * date semantics, pagination and module capabilities are all verified against real data.
 */

const MODULE_LABELS = {
  settlement: 'Daily Settlement Report',
  revenue: 'Revenue Analytics',
  subscribers: 'Subscriber Analytics',
  renewals: 'Renewals and Billing',
  churn: 'Deactivations and Churn',
  subscriber_records: 'Subscriber list'
};

function check(id, label, status, message, detail = null) {
  return { id, label, status, message, detail };
}

function fieldMappingChecks(group, stats, rowCount) {
  const problems = [];
  const warnings = [];
  for (const [key, s] of Object.entries(stats)) {
    if (s.invalid > 0) problems.push(`${group}.${key}: ${s.invalid} unparseable value(s) — ${s.errors[0]}`);
    else if (rowCount > 0 && s.found === 0 && s.nulls === 0) problems.push(`${group}.${key}: path not present in any of ${rowCount} row(s)`);
    else if (rowCount > 0 && s.found === 0 && s.nulls > 0) warnings.push(`${group}.${key}: present but null in every row`);
    else if (s.missing > 0) warnings.push(`${group}.${key}: missing in ${s.missing} of ${rowCount} row(s)`);
  }
  return { problems, warnings };
}

export async function validateIntegration({ client, platform, from, to, configErrors = [] }) {
  const checks = [];
  const finish = () => {
    const failed = checks.filter(c => c.status === 'FAILED').length;
    return {
      status: failed === 0 ? 'PASSED' : 'FAILED',
      canActivate: failed === 0,
      ranAt: new Date().toISOString(),
      sampleRange: { from, to },
      summary: {
        passed: checks.filter(c => c.status === 'PASSED').length,
        failed,
        warnings: checks.filter(c => c.status === 'WARNING').length
      },
      checks
    };
  };

  // 1. Configuration -----------------------------------------------------------
  if (configErrors.length) {
    checks.push(check('config', 'Configuration', 'FAILED', `${configErrors.length} configuration error(s).`, configErrors));
    return finish();
  }
  checks.push(check('config', 'Configuration', 'PASSED', 'Configuration is complete and well-formed.'));
  const cfg = client.config;

  // 2. Destination -------------------------------------------------------------
  try {
    const dest = checkUrlPolicy(cfg.base_url, client.policy);
    checks.push(check('destination', 'Approved destination', 'PASSED', `${dest.hostname} is approved for outbound requests.`));
  } catch (err) {
    checks.push(check('destination', 'Approved destination', 'FAILED', err.userMessage || err.message, err.detail));
    return finish();
  }

  // 3. Authentication ----------------------------------------------------------
  if (cfg.auth.type === 'none') {
    checks.push(check('authentication', 'Authentication', 'WARNING', 'No authentication is configured. Confirm the API is meant to be public.'));
  } else {
    try {
      await resolveAuthHeaders({ cacheKey: client.authKey, config: cfg, secrets: client.secrets, request: spec => client.rawRequest(spec, 'LOGIN'), forceRefresh: true });
      checks.push(check('authentication', 'Authentication', 'PASSED', cfg.auth.type === 'login_token' ? 'Signed in and obtained a token.' : 'Credentials are saved.'));
    } catch (err) {
      checks.push(check('authentication', 'Authentication', 'FAILED', err.userMessage || err.message, err.detail));
      return finish();
    }
  }

  // 4–5. Reachability and response format (overview request) -------------------
  const pg = cfg.pagination || {};
  const overviewReq = {
    reportType: 'overview',
    from,
    to,
    page: pg.strategy === 'page' ? pg.page_start : undefined,
    limit: pg.strategy !== 'none' ? pg.page_size : undefined,
    offset: pg.strategy === 'offset' ? 0 : undefined
  };
  let built;
  try {
    built = buildReportRequest(cfg, overviewReq, client.timezone);
  } catch (err) {
    checks.push(check('required_params', 'Request parameters', 'FAILED', err.userMessage || err.message, err.detail));
    return finish();
  }
  checks.push(check('required_params', 'Request parameters', 'PASSED', `Request sends: ${Object.keys(built.query).join(', ') || '(no parameters)'}.`, built.query));

  let response;
  try {
    response = await client.executeRaw(built, { kind: 'VALIDATION' });
  } catch (err) {
    checks.push(check('reachability', 'API reachability', 'FAILED', err.userMessage || err.message, err.detail));
    return finish();
  }
  const statusError = classifyHttpStatus(response.status);
  if (statusError === 'AUTH_FAILED' || statusError === 'FORBIDDEN_UPSTREAM') {
    const authCheck = checks.find(c => c.id === 'authentication');
    authCheck.status = 'FAILED';
    authCheck.message = `The report endpoint rejected the credentials (HTTP ${response.status}).`;
    return finish();
  }
  if (statusError || response.status < 200 || response.status >= 300) {
    checks.push(check('reachability', 'API reachability', 'FAILED', `Endpoint returned HTTP ${response.status}.`));
    return finish();
  }
  checks.push(check('reachability', 'API reachability', 'PASSED', `HTTP ${response.status} in ${response.durationMs} ms (${response.bytes} bytes).`));

  let json;
  try {
    json = parseJsonBody(response);
  } catch (err) {
    checks.push(check('response_format', 'Response format', 'FAILED', err.userMessage || err.message, err.detail));
    return finish();
  }

  // 6. Structure ------------------------------------------------------------------
  let normalized;
  try {
    normalized = normalizeResponse(json, cfg, { timezone: client.timezone, parts: ['daily', 'summary'], strict: false });
    checks.push(check('response_format', 'Response format', 'PASSED', cfg.response.success_path ? `Valid JSON; '${cfg.response.success_path}' indicates success.` : 'Valid JSON.'));
  } catch (err) {
    const label = err.code === 'API_REPORTED_FAILURE' ? 'response_format' : 'structure';
    checks.push(check(label, label === 'structure' ? 'Response structure' : 'Response format', 'FAILED', err.userMessage || err.message, err.detail));
    return finish();
  }

  const dailyRows = normalized.daily.rows;
  const hasDailyMapping = Object.keys(cfg.mappings.daily || {}).length > 0;
  const hasSummaryMapping = Object.keys(cfg.mappings.summary || {}).length > 0;
  const structureNotes = [];
  if (hasDailyMapping) structureNotes.push(`${dailyRows.length} daily row(s) at '${cfg.response.daily_path}'`);
  if (hasSummaryMapping) structureNotes.push(`summary object at '${cfg.response.summary_path || '(root)'}'`);
  if (!hasDailyMapping && !hasSummaryMapping) {
    checks.push(check('structure', 'Response structure', 'WARNING', 'No daily or summary fields are mapped; only record-level reports will be available.'));
  } else {
    checks.push(check('structure', 'Response structure', 'PASSED', `Found ${structureNotes.join(' and ')}.`));
  }

  // 7–8. Field mappings and data types ---------------------------------------------
  const mappingProblems = [];
  const mappingWarnings = [];
  if (hasDailyMapping) {
    if (dailyRows.length === 0) {
      mappingProblems.push('No daily rows were returned for the sample range, so daily mappings could not be verified. Choose a date range that has data.');
    }
    const r = fieldMappingChecks('daily', normalized.fieldStats.daily, dailyRows.length);
    mappingProblems.push(...r.problems);
    mappingWarnings.push(...r.warnings);
  }
  if (hasSummaryMapping) {
    const r = fieldMappingChecks('summary', normalized.fieldStats.summary, 1);
    mappingProblems.push(...r.problems);
    mappingWarnings.push(...r.warnings);
  }
  if (mappingProblems.length) {
    checks.push(check('field_mapping', 'Field mappings', 'FAILED', `${mappingProblems.length} mapping problem(s).`, [...mappingProblems, ...mappingWarnings]));
  } else if (mappingWarnings.length) {
    checks.push(check('field_mapping', 'Field mappings', 'WARNING', 'All mapped fields were found, with notes.', mappingWarnings));
  } else if (hasDailyMapping || hasSummaryMapping) {
    checks.push(check('field_mapping', 'Field mappings', 'PASSED', 'Every mapped field was found and parsed (numbers and dates).'));
  }

  // 9. Date semantics ---------------------------------------------------------------
  if (hasDailyMapping && dailyRows.length > 0) {
    const outside = dailyRows.filter(r => r.report_date < from || r.report_date > to).map(r => r.report_date);
    const hasEnd = dailyRows.some(r => r.report_date === to);
    if (outside.length) {
      checks.push(check('date_range', 'Date range semantics', 'FAILED', `${outside.length} row(s) fall outside the requested ${from} → ${to} window. The API may ignore the date parameters or use a different end-date convention.`, outside.slice(0, 10)));
    } else if (!hasEnd) {
      checks.push(check('date_range', 'Date range semantics', 'WARNING', `No row was returned for the end date ${to}. Confirm whether the API treats the end date as inclusive (current setting: ${cfg.end_date_mode}).`));
    } else {
      checks.push(check('date_range', 'Date range semantics', 'PASSED', `All rows fall within ${from} → ${to} and the end date is included (dates interpreted in ${client.timezone}).`));
    }
  }

  // 10. Reconciliation ---------------------------------------------------------------
  if (hasDailyMapping && hasSummaryMapping && dailyRows.length > 0) {
    const notes = [];
    let mismatch = false;
    for (const key of Object.keys(cfg.mappings.summary)) {
      const def = DAILY_FIELDS[key];
      if (!def || def.kind === 'stock' || !cfg.mappings.daily[key]) continue;
      const summaryValue = normalized.summary.values[key];
      const values = dailyRows.map(r => r[key]);
      const daySum = def.kind === 'currency' ? sumExact(values, cfg.currency_decimals) : sumIntegers(values);
      if (summaryValue === null || daySum === null) continue;
      const diff = Math.abs(summaryValue - daySum);
      const tolerance = def.kind === 'currency' ? 0.01 : 0;
      if (diff > tolerance) {
        mismatch = true;
        notes.push(`${key}: summary ${summaryValue} vs sum of daily rows ${daySum}`);
      } else {
        notes.push(`${key}: ${summaryValue} ✓`);
      }
    }
    if (notes.length === 0) {
      checks.push(check('reconciliation', 'Totals reconciliation', 'SKIPPED', 'No metric is mapped in both the summary and the daily rows.'));
    } else {
      checks.push(check('reconciliation', 'Totals reconciliation', mismatch ? 'WARNING' : 'PASSED', mismatch ? 'Summary totals differ from the sum of daily rows. KPIs will use the API summary; the settlement table shows the daily rows as returned.' : 'Summary totals match the sum of daily rows.', notes));
    }
  }

  // 11. Pagination -----------------------------------------------------------------------
  if (pg.strategy !== 'none') {
    try {
      const rowsOf = pg.applies_to === 'daily' ? (n => n.daily.rows) : (n => n.records.rows);
      const parts = pg.applies_to === 'daily' ? ['daily'] : ['records'];
      const reportType = pg.applies_to === 'daily' ? 'overview' : (['subscribers', 'renewals', 'churn'].find(t => cfg.report_types[t]) || 'overview');
      const pages = [];
      for await (const page of client.paginate({ reportType, from, to, parts, pageSize: pg.page_size, rowsOf, maxPages: 2 })) {
        pages.push(page);
        if (pages.length === 2) break;
      }
      const total = pages[0]?.normalized.pagination.total;
      if (pages.length < 2) {
        checks.push(check('pagination', 'Pagination', 'WARNING', `The sample range fits on one page (${pages[0]?.rows.length ?? 0} row(s), page size ${pg.page_size}); multi-page behaviour was not exercised.${total !== null && total !== undefined ? ` Reported total: ${total}.` : ''}`));
      } else {
        const ids1 = new Set(pages[0].rows.map(r => r.record_id || r.report_date).filter(Boolean));
        const overlap = pages[1].rows.filter(r => ids1.has(r.record_id || r.report_date)).length;
        if (overlap > 0) {
          checks.push(check('pagination', 'Pagination', 'FAILED', `Page 2 repeated ${overlap} row(s) from page 1.`));
        } else {
          checks.push(check('pagination', 'Pagination', 'PASSED', `Pages 1 and 2 returned distinct rows (${pages[0].rows.length} + ${pages[1].rows.length}).${total !== null && total !== undefined ? ` Reported total: ${total}.` : ' No total count is mapped.'}`));
        }
      }
    } catch (err) {
      checks.push(check('pagination', 'Pagination', 'FAILED', err.userMessage || err.message, err.detail));
    }
  }

  // 12. Record-level reports -----------------------------------------------------------
  for (const reportType of ['subscribers', 'renewals', 'churn']) {
    if (!cfg.report_types[reportType] || !cfg.response.records_path || !Object.keys(cfg.mappings.records || {}).length) continue;
    try {
      const page = await client.fetchRecordsPage({ reportType, from, to, page: 1 });
      const label = `Records: ${reportType}`;
      if (page.rows.length === 0) {
        checks.push(check(`records_${reportType}`, label, 'WARNING', 'The records array was found but is empty for the sample range, so record field mappings could not be verified.'));
        continue;
      }
      const r = fieldMappingChecks('records', page.fieldStats, page.rows.length);
      if (r.problems.length) {
        checks.push(check(`records_${reportType}`, label, 'FAILED', `${r.problems.length} record mapping problem(s).`, [...r.problems, ...r.warnings]));
      } else {
        checks.push(check(`records_${reportType}`, label, r.warnings.length ? 'WARNING' : 'PASSED', `${page.rows.length} record(s) on page 1${page.pagination.total !== null ? ` of ${page.pagination.total}` : ''}.`, r.warnings.length ? r.warnings : null));
      }
    } catch (err) {
      checks.push(check(`records_${reportType}`, `Records: ${reportType}`, 'FAILED', err.userMessage || err.message, err.detail));
    }
  }

  // 13. Module capabilities --------------------------------------------------------------
  const caps = describeCapabilities(cfg);
  const missing = normalizeModules(platform.enabled_modules)
    .filter(m => m !== 'overview' && !caps.modules[m])
    .map(m => `${MODULE_LABELS[m] || m} is enabled but the mapping provides no data for it.`);
  if (missing.length) {
    checks.push(check('capabilities', 'Reporting capabilities', 'FAILED', 'Some enabled modules have no mapped data. Map the fields or disable those modules.', missing));
  } else {
    checks.push(check('capabilities', 'Reporting capabilities', 'PASSED', `Enabled modules are supported: ${normalizeModules(platform.enabled_modules).join(', ')}.`));
  }

  return finish();
}

export { IntegrationError };
