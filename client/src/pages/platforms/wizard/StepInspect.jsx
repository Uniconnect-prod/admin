import React, { useState } from 'react';
import { Send, Loader2, FileSearch, Braces, ListTree, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api, { describeError } from '../../../services/api';
import { Card, Field, StatusBadge } from '../../../components/ui/primitives';
import { Alert, StateView } from '../../../components/ui/feedback';
import { formatDateTime, formatRelative } from '../../../services/format';
import { getIn, setIn } from './wizardUtils';

function lastWeek() {
  const to = new Date();
  const from = new Date(Date.now() - 6 * 86400000);
  const k = d => d.toISOString().slice(0, 10);
  return { from: k(from), to: k(to) };
}

export const StepInspect = ({ platform, integration, updateIntegration, fieldErrors, inspection, setInspection }) => {
  const [reportType, setReportType] = useState('overview');
  const [range, setRange] = useState(inspection?.sampleRange || lastWeek());
  const [running, setRunning] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const set = (path, value) => updateIntegration(cfg => setIn(cfg, path, value));
  const v = (path, fb = '') => getIn(integration, path, fb);

  const run = async () => {
    setRunning(true);
    setRequestError(null);
    try {
      const res = await api.post(`/platform-management/${platform.id}/inspect`, { integration, reportType, from: range.from, to: range.to });
      setInspection(res.data.data);
    } catch (err) {
      setRequestError(describeError(err));
    } finally {
      setRunning(false);
    }
  };

  const r = inspection;
  const health = platform?.integration_health || {};
  const reportTypes = ['overview', 'subscribers', 'renewals', 'churn'].filter(t => t === 'overview' || v(`report_types.${t}`));

  return (
    <div className="stack-lg">
      <Card title="Send a test request" icon={FileSearch} subtitle="Uses the current draft settings and the saved credentials. Nothing is stored except an audit entry and request metadata.">
        <div className="form-grid-3">
          <Field label="Report" htmlFor="ins-type">
            <select id="ins-type" className="select" value={reportType} onChange={e => setReportType(e.target.value)}>
              {reportTypes.map(t => <option key={t} value={t}>{t === 'overview' ? `Overview (${v('report_types.overview') || 'default'})` : `${t} (${v(`report_types.${t}`)})`}</option>)}
            </select>
          </Field>
          <Field label="Sample start date" htmlFor="ins-from"><input id="ins-from" type="date" className="input" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="Sample end date" htmlFor="ins-to"><input id="ins-to" type="date" className="input" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} /></Field>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn--primary" onClick={run} disabled={running}>
            {running ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Send test request
          </button>
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            <Clock size={13} style={{ verticalAlign: -2 }} /> Last successful platform request: <strong>{health.last_success_at ? `${formatRelative(health.last_success_at)} (${formatDateTime(health.last_success_at)})` : 'never'}</strong>
            {health.last_error_at && <> · last error {formatRelative(health.last_error_at)} ({health.last_error_code})</>}
          </span>
        </div>
        {requestError && <div style={{ marginTop: 16 }}><Alert tone="danger" title={requestError.message}>{requestError.details?.errors?.map(e => <div key={e.field}><code>{e.field}</code>: {e.message}</div>)}</Alert></div>}
      </Card>

      {r && (
        <Card title="Result" icon={r.ok ? CheckCircle2 : XCircle}>
          <div className="inspect-summary">
            <div><span className="eyebrow">HTTP status</span><strong>{r.status ?? '—'}</strong></div>
            <div><span className="eyebrow">Response time</span><strong>{r.durationMs !== undefined ? `${r.durationMs} ms` : '—'}</strong></div>
            <div><span className="eyebrow">Size</span><strong>{r.bytes !== undefined ? `${(r.bytes / 1024).toFixed(1)} KB` : '—'}</strong></div>
            <div><span className="eyebrow">Content type</span><strong className="mono">{r.contentType || '—'}</strong></div>
            <div><span className="eyebrow">Outcome</span><StatusBadge status={r.ok ? 'PASSED' : 'FAILED'} label={r.ok ? 'JSON received' : 'Failed'} /></div>
          </div>
          <div className="code-inline">
            <strong>{r.request.method}</strong> {(() => { try { return new URL(integration.base_url).protocol; } catch { return 'https:'; } })()}//{r.request.host}{r.request.path}
            {Object.keys(r.request.query || {}).length > 0 && <span className="text-faint">?{new URLSearchParams(r.request.query).toString()}</span>}
          </div>
          {r.error && <div style={{ marginTop: 12 }}><Alert tone="danger" title={r.error.message}>{r.error.detail}</Alert></div>}
          {r.mappingError && <div style={{ marginTop: 12 }}><Alert tone="warning" title="Current mapping does not fit this response">{r.mappingError.message} {r.mappingError.detail}</Alert></div>}
        </Card>
      )}

      <Card title="Response structure paths" icon={ListTree} subtitle="Paths are explicit — envelopes such as data, result or payload are never guessed. Use '$' when the response root is the array.">
        <div className="form-grid-3">
          <Field label="Success flag path" hint="Optional, e.g. success or status" error={fieldErrors['response.success_path']} htmlFor="rp-success">
            <input id="rp-success" className="input mono" value={v('response.success_path')} onChange={e => set('response.success_path', e.target.value.trim())} />
          </Field>
          <Field label="Success value" hint="true, ok, 1 …" htmlFor="rp-value">
            <input id="rp-value" className="input mono" value={String(v('response.success_value', true))} onChange={e => set('response.success_value', e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)} />
          </Field>
          <Field label="Error message path" error={fieldErrors['response.error_message_path']} htmlFor="rp-err">
            <input id="rp-err" className="input mono" value={v('response.error_message_path')} onChange={e => set('response.error_message_path', e.target.value.trim())} placeholder="message" />
          </Field>
          <Field label="Daily rows array" error={fieldErrors['response.daily_path']} htmlFor="rp-daily">
            <input id="rp-daily" className="input mono" value={v('response.daily_path')} onChange={e => set('response.daily_path', e.target.value.trim())} placeholder="daily" />
          </Field>
          <Field label="Records array" error={fieldErrors['response.records_path']} htmlFor="rp-records">
            <input id="rp-records" className="input mono" value={v('response.records_path')} onChange={e => set('response.records_path', e.target.value.trim())} placeholder="data" />
          </Field>
          <Field label="Summary object" hint="Empty = response root" error={fieldErrors['response.summary_path']} htmlFor="rp-summary">
            <input id="rp-summary" className="input mono" value={v('response.summary_path')} onChange={e => set('response.summary_path', e.target.value.trim())} placeholder="summary" />
          </Field>
        </div>
      </Card>

      {r?.structure ? (
        <div className="grid-2">
          <Card title="Detected structure" icon={ListTree} subtitle="Click to use a container in the configuration.">
            <div className="structure-list">
              {r.structure.containers.map(c => (
                <div key={`${c.kind}-${c.path}`} className="structure-item">
                  <div className="row-between">
                    <span><code>{c.path}</code> <span className="badge">{c.kind}{c.kind === 'array' ? ` · ${c.length}` : ''}</span></span>
                    <span className="row" style={{ gap: 4 }}>
                      {c.kind === 'array' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('response.daily_path', c.path)}>Daily rows</button>}
                      {c.kind === 'array' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('response.records_path', c.path)}>Records</button>}
                      {c.kind === 'object' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('response.summary_path', c.path === '$' ? '' : c.path)}>Summary</button>}
                    </span>
                  </div>
                  {(c.itemFields || c.fields || []).length > 0 && (
                    <div className="structure-item__fields">
                      {(c.itemFields || c.fields).slice(0, 24).map(f => (
                        <span key={f.path} className="chip" title={`sample: ${JSON.stringify(f.sample)}`}><code>{f.path}</code> <span className="text-faint">{(f.types || [f.type]).join('|')}</span></span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {r.structure.paginationCandidates.length > 0 && (
              <>
                <div className="divider" />
                <div className="section-title">Pagination metadata found</div>
                <div className="chip-list">
                  {r.structure.paginationCandidates.map(p => (
                    <button key={p.path} type="button" className="chip" onClick={() => set('pagination.total_path', p.path)} title="Use as total count path">
                      <code>{p.path}</code> = {String(p.value)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Card title="Sanitised response preview" icon={Braces} subtitle="Credentials redacted, phone numbers and emails masked, arrays truncated to 3 items.">
            <pre className="code-block">{JSON.stringify(r.preview, null, 2)}</pre>
          </Card>
        </div>
      ) : (
        !r && <div className="card"><StateView compact icon={FileSearch} title="No test request yet" text="Send a test request to see the response structure, available fields and pagination metadata." /></div>
      )}
    </div>
  );
};
