import React from 'react';
import { SlidersHorizontal, ListOrdered, Plus, Trash2, FileText } from 'lucide-react';
import { Card, Field } from '../../../components/ui/primitives';
import { getIn, setIn } from './wizardUtils';

const PARAM_HELP = {
  from: 'Start of the requested period (inclusive)',
  to: 'End of the requested period',
  report_type: 'Selects which report the endpoint returns',
  page: 'Page number (page pagination)',
  limit: 'Page size',
  offset: 'Row offset (offset pagination)',
  search: 'Free-text / MSISDN search, if supported',
  status: 'Subscriber status filter, if supported',
  cursor: 'Cursor token (cursor pagination)'
};

const REPORT_TYPE_LABELS = {
  overview: 'Overview / settlement (daily rows + summary)',
  subscribers: 'Subscriber records',
  renewals: 'Renewal records',
  churn: 'Deactivation records'
};

const KeyValueRows = ({ rows = [], onChange, namePlaceholder, valuePlaceholder, errors, prefix }) => (
  <div className="stack" style={{ gap: 8 }}>
    {rows.map((row, i) => (
      <div key={i} className="kv-row">
        <input className={`input input--sm mono ${errors[`${prefix}.${i}.name`] ? 'has-error' : ''}`} value={row.name} placeholder={namePlaceholder} onChange={e => onChange(rows.map((r, j) => (j === i ? { ...r, name: e.target.value.trim() } : r)))} aria-label="Name" />
        <input className="input input--sm mono" value={row.value} placeholder={valuePlaceholder} onChange={e => onChange(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} aria-label="Value" />
        <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></button>
        {(errors[`${prefix}.${i}.name`] || errors[`${prefix}.${i}.value`]) && <span className="field__error" style={{ gridColumn: '1 / -1' }}>{errors[`${prefix}.${i}.name`] || errors[`${prefix}.${i}.value`]}</span>}
      </div>
    ))}
    {rows.length < 10 && (
      <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...rows, { name: '', value: '' }])}><Plus size={14} /> Add</button>
    )}
  </div>
);

export const StepParams = ({ meta, integration, updateIntegration, fieldErrors }) => {
  const set = (path, value) => updateIntegration(cfg => setIn(cfg, path, value));
  const v = (path, fb = '') => getIn(integration, path, fb);
  const strategy = v('pagination.strategy', 'none');

  return (
    <div className="stack-lg">
      <Card title="Query parameter mapping" icon={SlidersHorizontal} subtitle="Map each canonical request field to the parameter name this platform expects. Leave unsupported ones empty.">
        <div className="table-wrap">
          <table className="table mapping-table">
            <thead><tr><th>Canonical field</th><th>Purpose</th><th>Platform parameter name</th></tr></thead>
            <tbody>
              {Object.entries(meta.requestParams).map(([key, def]) => (
                <tr key={key}>
                  <td><code>{key}</code>{def.required && <span className="field__required"> *</span>}</td>
                  <td className="text-muted">{PARAM_HELP[key] || def.label}</td>
                  <td>
                    <input className={`input input--sm mono ${fieldErrors[`params.${key}`] ? 'has-error' : ''}`} value={v(`params.${key}`)} onChange={e => set(`params.${key}`, e.target.value.trim())} placeholder="not sent" aria-label={`Parameter name for ${key}`} />
                    {fieldErrors[`params.${key}`] && <span className="field__error">{fieldErrors[`params.${key}`]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <Field label="Date parameter format" error={fieldErrors.date_param_format} htmlFor="pp-fmt" hint="Datetime formats send local start/end of day in the platform timezone.">
            <select id="pp-fmt" className="select" value={v('date_param_format', 'YYYY-MM-DD')} onChange={e => set('date_param_format', e.target.value)}>
              {meta.dateParamFormats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="End-date convention" htmlFor="pp-end" hint="Validation checks whether rows for the end date are returned.">
            <select id="pp-end" className="select" value={v('end_date_mode', 'inclusive')} onChange={e => set('end_date_mode', e.target.value)}>
              <option value="inclusive">Inclusive — send the last day of the period</option>
              <option value="exclusive">Exclusive — send the day after the period</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Report type values" icon={FileText} subtitle={v('params.report_type') ? `Values sent in the '${v('params.report_type')}' parameter. Leave empty if the API does not offer that report.` : 'No report-type parameter is mapped. Enter a value (e.g. "default") to mark which record reports this endpoint provides.'}>
        <div className="form-grid">
          {meta.reportTypes.map(rt => (
            <Field key={rt} label={REPORT_TYPE_LABELS[rt]} error={fieldErrors[`report_types.${rt}`]} htmlFor={`rt-${rt}`}>
              <input id={`rt-${rt}`} className="input mono" value={v(`report_types.${rt}`)} onChange={e => set(`report_types.${rt}`, e.target.value.trim())} placeholder={rt === 'overview' ? 'all' : 'not available'} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Pagination" icon={ListOrdered} subtitle="How the API pages through results. Exports follow pagination until the end, with duplicate and stall detection.">
        <div className="form-grid">
          <Field label="Strategy" error={fieldErrors['pagination.strategy']} htmlFor="pg-strategy">
            <select id="pg-strategy" className="select" value={strategy} onChange={e => set('pagination.strategy', e.target.value)}>
              <option value="none">None — one response contains everything</option>
              <option value="page">Page number + page size</option>
              <option value="offset">Offset + page size</option>
              <option value="cursor">Cursor / next token</option>
            </select>
          </Field>
          <Field label="Pagination applies to" htmlFor="pg-applies">
            <select id="pg-applies" className="select" value={v('pagination.applies_to', 'records')} onChange={e => set('pagination.applies_to', e.target.value)} disabled={strategy === 'none'}>
              <option value="records">Record lists (daily rows/summary come on page 1)</option>
              <option value="daily">Daily rows</option>
            </select>
          </Field>
          {strategy !== 'none' && (
            <>
              {strategy === 'page' && (
                <Field label="First page number" htmlFor="pg-start">
                  <select id="pg-start" className="select" value={v('pagination.page_start', 1)} onChange={e => set('pagination.page_start', Number(e.target.value))}>
                    <option value={1}>1</option><option value={0}>0</option>
                  </select>
                </Field>
              )}
              <Field label="Page size" hint="Must not exceed the API's own maximum." error={fieldErrors['pagination.page_size']} htmlFor="pg-size">
                <input id="pg-size" type="number" className="input" min={1} max={1000} value={v('pagination.page_size', 50)} onChange={e => set('pagination.page_size', Number(e.target.value))} />
              </Field>
              <Field label="Max pages per request" error={fieldErrors['pagination.max_pages']} htmlFor="pg-max">
                <input id="pg-max" type="number" className="input" min={1} max={1000} value={v('pagination.max_pages', 100)} onChange={e => set('pagination.max_pages', Number(e.target.value))} />
              </Field>
              <Field label="Total count path" hint="e.g. total or meta.total_count" error={fieldErrors['pagination.total_path']} htmlFor="pg-total">
                <input id="pg-total" className="input mono" value={v('pagination.total_path')} onChange={e => set('pagination.total_path', e.target.value.trim())} />
              </Field>
              <Field label="Total pages path" error={fieldErrors['pagination.total_pages_path']} htmlFor="pg-pages">
                <input id="pg-pages" className="input mono" value={v('pagination.total_pages_path')} onChange={e => set('pagination.total_pages_path', e.target.value.trim())} />
              </Field>
              <Field label="Has-more flag path" error={fieldErrors['pagination.has_more_path']} htmlFor="pg-more">
                <input id="pg-more" className="input mono" value={v('pagination.has_more_path')} onChange={e => set('pagination.has_more_path', e.target.value.trim())} />
              </Field>
              {strategy === 'cursor' && (
                <Field label="Next cursor path" required error={fieldErrors['pagination.next_cursor_path']} htmlFor="pg-cursor">
                  <input id="pg-cursor" className="input mono" value={v('pagination.next_cursor_path')} onChange={e => set('pagination.next_cursor_path', e.target.value.trim())} />
                </Field>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Static query parameters" subtitle="Constant parameters sent with every request (no secrets).">
          <KeyValueRows rows={integration.static_params || []} onChange={rows => set('static_params', rows)} namePlaceholder="name" valuePlaceholder="value" errors={fieldErrors} prefix="static_params" />
        </Card>
        <Card title="Additional headers" subtitle="Non-sensitive headers only. Host, Cookie, Authorization and proxy headers are blocked.">
          <KeyValueRows rows={integration.extra_headers || []} onChange={rows => set('extra_headers', rows)} namePlaceholder="X-Client-Id" valuePlaceholder="value" errors={fieldErrors} prefix="extra_headers" />
        </Card>
      </div>
    </div>
  );
};
