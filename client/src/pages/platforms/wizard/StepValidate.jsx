import React, { useState } from 'react';
import { ShieldCheck, Loader2, PlayCircle, Rocket, PowerOff, CheckCircle2, XCircle, AlertTriangle, MinusCircle, Save, ClipboardList } from 'lucide-react';
import api, { describeError } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { Card, Field, StatusBadge } from '../../../components/ui/primitives';
import { Alert } from '../../../components/ui/feedback';
import { ConfirmDialog } from '../../../components/ui/overlays';
import { formatDateTime } from '../../../services/format';

const CHECK_ICON = { PASSED: CheckCircle2, FAILED: XCircle, WARNING: AlertTriangle, SKIPPED: MinusCircle };

function lastWeek() {
  const k = d => d.toISOString().slice(0, 10);
  return { from: k(new Date(Date.now() - 6 * 86400000)), to: k(new Date()) };
}

export const StepValidate = ({ platform, details, integration, dirty, saveIntegration, onPlatformUpdated }) => {
  const toast = useToast();
  const [range, setRange] = useState(platform?.validation?.sampleRange || lastWeek());
  const [running, setRunning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const validation = platform?.validation;
  const canActivate = platform?.validation_current && validation?.status === 'PASSED' && !dirty;
  const isActive = platform?.status === 'ACTIVE';

  const runValidation = async () => {
    setRunning(true);
    try {
      const res = await api.post(`/platform-management/${platform.id}/validate`, range);
      onPlatformUpdated(res.data.data.platform);
      if (res.data.data.status === 'PASSED') toast.success('Validation passed. You can activate the platform.');
      else toast.warning(`Validation failed: ${res.data.data.summary.failed} check(s) need attention.`);
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setRunning(false);
    }
  };

  const activate = async () => {
    setActivating(true);
    try {
      const res = await api.post(`/platform-management/${platform.id}/activate`);
      await onPlatformUpdated(res.data.data);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setActivating(false);
    }
  };

  const disable = async () => {
    setDisabling(true);
    try {
      const res = await api.post(`/platform-management/${platform.id}/disable`);
      await onPlatformUpdated(res.data.data);
      toast.success(res.data.message);
      setConfirmDisable(false);
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setDisabling(false);
    }
  };

  const caps = platform?.capabilities;
  const mapped = g => Object.keys(integration.mappings?.[g] || {});

  return (
    <div className="stack-lg">
      {dirty && (
        <Alert tone="warning" title="You have unsaved changes">
          Validation always runs against the saved draft so that the result is bound to an exact configuration.
          <div style={{ marginTop: 8 }}><button type="button" className="btn btn--primary btn--sm" onClick={saveIntegration}><Save size={14} /> Save draft</button></div>
        </Alert>
      )}

      <Card title="Validate against live data" icon={ShieldCheck} subtitle="Checks destination, authentication, parameters, structure, every mapped field, data types, date semantics, pagination, totals and module coverage. HTTP 200 alone is never enough.">
        <div className="form-grid-3">
          <Field label="Sample start date" htmlFor="val-from"><input id="val-from" type="date" className="input" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="Sample end date" htmlFor="val-to"><input id="val-to" type="date" className="input" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} /></Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" onClick={runValidation} disabled={running || dirty}>
              {running ? <Loader2 size={16} className="spin" /> : <PlayCircle size={16} />} Run validation
            </button>
          </div>
        </div>
        <p className="field__hint" style={{ marginTop: 8 }}>Pick a range that contains real activity so mapped fields can be verified; ranges spanning several pages exercise pagination.</p>
      </Card>

      {validation && validation.status !== 'NOT_RUN' && (
        <Card
          title="Validation results"
          icon={ClipboardList}
          subtitle={`Ran ${formatDateTime(validation.ranAt)} · sample ${validation.sampleRange?.from} → ${validation.sampleRange?.to}${platform.validation_current ? '' : ' · configuration changed since this run'}`}
          actions={<StatusBadge status={platform.validation_current ? validation.status : 'NEEDS_VALIDATION'} label={platform.validation_current ? undefined : 'Outdated'} />}
        >
          <ul className="check-list">
            {validation.checks.map(c => {
              const Icon = CHECK_ICON[c.status] || MinusCircle;
              return (
                <li key={c.id} className={`check-list__item is-${c.status.toLowerCase()}`}>
                  <Icon size={18} />
                  <div className="grow">
                    <div className="row-between"><strong>{c.label}</strong><StatusBadge status={c.status} dot={false} /></div>
                    <p>{c.message}</p>
                    {Array.isArray(c.detail) && c.detail.length > 0 && (
                      <ul className="check-list__detail">{c.detail.slice(0, 12).map((d, i) => <li key={i}>{typeof d === 'string' ? d : `${d.field}: ${d.message}`}</li>)}</ul>
                    )}
                    {c.detail && !Array.isArray(c.detail) && typeof c.detail === 'object' && (
                      <code className="check-list__code">{new URLSearchParams(c.detail).toString()}</code>
                    )}
                    {typeof c.detail === 'string' && <p className="text-faint">{c.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid-2">
        <Card title="Configuration preview">
          <dl className="kv">
            <dt>Platform</dt><dd>{details.name} (<code>{details.code}</code>) · {details.business_timezone}{details.currency ? ` · ${details.currency}` : ''}</dd>
            <dt>Endpoint</dt><dd className="mono">{integration.endpoints?.report?.method} {integration.base_url}{integration.endpoints?.report?.path}</dd>
            <dt>Authentication</dt><dd>{integration.auth?.type}{integration.auth?.type === 'api_key' ? ` (${integration.auth.header_name})` : ''}</dd>
            <dt>Parameters</dt><dd className="mono">{Object.entries(integration.params || {}).filter(([, v]) => v).map(([k, v]) => `${k}→${v}`).join(', ') || '—'}</dd>
            <dt>Pagination</dt><dd>{integration.pagination?.strategy}{integration.pagination?.strategy !== 'none' ? ` · ${integration.pagination.page_size}/page · ${integration.pagination.applies_to}` : ''}</dd>
            <dt>Daily fields</dt><dd>{mapped('daily').join(', ') || '—'}</dd>
            <dt>Summary fields</dt><dd>{mapped('summary').join(', ') || '—'}</dd>
            <dt>Record fields</dt><dd>{mapped('records').join(', ') || '—'}</dd>
            <dt>Supported modules</dt><dd>{caps ? Object.entries(caps.modules).filter(([, ok]) => ok).map(([m]) => m).join(', ') : '—'}</dd>
            <dt>Enabled modules</dt><dd>{details.enabled_modules.join(', ')}</dd>
          </dl>
        </Card>

        <Card title={isActive ? 'Publish & status' : 'Activation'} icon={Rocket}>
          <div className="stack">
            <dl className="kv">
              <dt>Status</dt><dd><StatusBadge status={platform.status} /></dd>
              <dt>Published</dt><dd>{platform.published ? formatDateTime(platform.published.at) : 'Never'}</dd>
              <dt>Draft vs published</dt><dd>{!platform.published ? 'Not published' : platform.has_unpublished_changes ? 'Draft has unpublished changes' : 'Draft matches published configuration'}</dd>
            </dl>
            {!canActivate && <Alert tone="neutral">Activation unlocks when the latest validation of the saved draft has no failed checks.</Alert>}
            <div className="row">
              <button type="button" className="btn btn--success" onClick={activate} disabled={!canActivate || activating || (isActive && !platform.has_unpublished_changes)}>
                {activating ? <Loader2 size={16} className="spin" /> : <Rocket size={16} />} {isActive ? 'Publish changes' : 'Activate platform'}
              </button>
              {isActive && (
                <button type="button" className="btn btn--danger-soft" onClick={() => setConfirmDisable(true)}><PowerOff size={16} /> Disable</button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDisable}
        title={`Disable ${platform.name}?`}
        message="The platform disappears from every user's platform selector and its reports stop loading. Configuration, credentials and history are kept, and you can activate it again later."
        confirmLabel="Disable platform"
        tone="danger"
        busy={disabling}
        onConfirm={disable}
        onClose={() => setConfirmDisable(false)}
      />
    </div>
  );
};
