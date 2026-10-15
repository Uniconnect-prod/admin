import React, { useState } from 'react';
import { GitMerge, NotebookPen } from 'lucide-react';
import { Card, Field, Tabs, ProvenanceBadge } from '../../../components/ui/primitives';
import { Alert } from '../../../components/ui/feedback';
import { getIn, setIn, pathSuggestions } from './wizardUtils';

const GROUPS = [
  { id: 'daily', label: 'Daily rows', help: 'One object per business day inside the daily rows array. Paths are relative to each row.' },
  { id: 'summary', label: 'Period summary', help: 'Totals for the whole requested period, relative to the summary object. API summary values are used for KPIs as-is.' },
  { id: 'records', label: 'Records', help: 'Row-level records (subscriptions, renewals, deactivations), relative to each record.' }
];

const KIND_HINT = { count: 'Additive count', stock: 'Point-in-time (not summed)', currency: 'Money', key: 'Row key' };

export const StepMapping = ({ meta, integration, updateIntegration, fieldErrors, inspection }) => {
  const [group, setGroup] = useState('daily');
  const fields = meta.fields[group];
  const mapping = integration.mappings?.[group] || {};
  const suggestions = pathSuggestions(inspection);
  const containerPath = group === 'daily' ? integration.response?.daily_path : group === 'records' ? integration.response?.records_path : null;
  let options = [];
  if (group === 'summary') {
    const sp = integration.response?.summary_path || '$';
    options = (suggestions.objectFields[sp] || []).map(f => ({ path: sp === '$' ? f.path : f.path.replace(`${sp}.`, ''), sample: f.sample }));
  } else if (containerPath) {
    options = (suggestions.itemFields[containerPath] || []).map(f => ({ path: f.path, sample: f.sample }));
  }
  const stats = inspection?.mappingPreview?.fieldStats?.[group] || {};

  const setField = (key, patch) => {
    const current = mapping[key] || {};
    const next = { ...current, ...patch };
    updateIntegration(cfg => {
      const updated = { ...(cfg.mappings?.[group] || {}) };
      if (!next.path) delete updated[key];
      else updated[key] = next;
      return setIn(cfg, `mappings.${group}`, updated);
    });
  };

  const mappedCount = g => Object.keys(integration.mappings?.[g] || {}).length;

  return (
    <div className="stack-lg">
      <Card title="Map API fields to the reporting model" icon={GitMerge} subtitle="Map only what the API really provides. Anything unmapped is shown as unavailable in reports — never as zero.">
        <Tabs tabs={GROUPS.map(g => ({ id: g.id, label: g.label, badge: mappedCount(g.id) }))} active={group} onChange={setGroup} />
        <p className="text-muted" style={{ margin: '12px 0' }}>{GROUPS.find(g => g.id === group).help}</p>
        {group !== 'summary' && !containerPath && (
          <Alert tone="warning">Set the {group === 'daily' ? 'daily rows' : 'records'} array path in the inspection step first.</Alert>
        )}
        {!inspection && <Alert tone="info">Run a test request in the inspection step to get field suggestions and a mapping preview.</Alert>}

        <datalist id={`paths-${group}`}>{options.map(o => <option key={o.path} value={o.path}>{`sample: ${JSON.stringify(o.sample)}`}</option>)}</datalist>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table mapping-table">
            <thead>
              <tr><th>Canonical field</th><th>Response path</th><th>Format</th>{group === 'daily' && <th>Column label</th>}<th>Last test</th></tr>
            </thead>
            <tbody>
              {Object.entries(fields).map(([key, def]) => {
                const m = mapping[key] || {};
                const err = fieldErrors[`mappings.${group}.${key}`];
                const s = stats[key];
                return (
                  <tr key={key}>
                    <td>
                      <div className="text-strong">{def.label}{key === 'report_date' && <span className="field__required"> *</span>}</div>
                      <span className="cell-sub"><code>{key}</code> · {KIND_HINT[def.kind] || def.type}</span>
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <input className={`input input--sm mono ${err ? 'has-error' : ''}`} list={`paths-${group}`} value={m.path || ''} onChange={e => setField(key, { path: e.target.value.trim() })} placeholder="not mapped" aria-label={`Path for ${def.label}`} />
                      {err && <span className="field__error">{err}</span>}
                    </td>
                    <td>
                      {(def.type === 'date' || def.type === 'datetime') && (
                        <select className="select input--sm" value={m.format || 'auto'} onChange={e => setField(key, { format: e.target.value })} disabled={!m.path} aria-label="Date format">
                          {meta.dateFormats.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      )}
                      {(def.type === 'decimal' || def.type === 'integer') && (
                        <select className="select input--sm" value={m.decimal_separator || '.'} onChange={e => setField(key, { decimal_separator: e.target.value })} disabled={!m.path} aria-label="Decimal separator">
                          <option value=".">1,234.56</option>
                          <option value=",">1.234,56</option>
                        </select>
                      )}
                      {def.type === 'string' && <span className="text-faint">text</span>}
                    </td>
                    {group === 'daily' && (
                      <td><input className="input input--sm" value={m.label || ''} onChange={e => setField(key, { label: e.target.value })} disabled={!m.path || key === 'report_date'} placeholder={def.label} aria-label="Column label" /></td>
                    )}
                    <td className="nowrap">
                      {!m.path ? <ProvenanceBadge provenance="unavailable" /> : s ? (
                        s.invalid > 0 ? <span className="badge badge--danger">{s.invalid} invalid</span>
                          : s.found > 0 ? <span className="badge badge--success">{s.found} found{s.missing ? ` · ${s.missing} missing` : ''}</span>
                            : <span className="badge badge--warning">not found</span>
                      ) : <span className="text-faint">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Transformation notes" icon={NotebookPen} subtitle="Document how fields were confirmed and any business rules agreed with the API owner.">
        <Field htmlFor="cfg-notes">
          <textarea id="cfg-notes" className="textarea" rows={4} value={getIn(integration, 'notes')} onChange={e => updateIntegration(cfg => setIn(cfg, 'notes', e.target.value))} placeholder="e.g. grand_total confirmed with API owner on 2026-10-14 as gross billing incl. on-demand offer 9923310009." />
        </Field>
      </Card>
    </div>
  );
};
