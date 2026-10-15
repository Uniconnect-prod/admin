import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, X, Loader2, Lock } from 'lucide-react';
import api, { describeError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { PageHeader, Card, Field } from '../../components/ui/primitives';
import { ErrorPanel, KpiSkeletonGrid, Alert } from '../../components/ui/feedback';

const ApprovedHostsPage = () => {
  const toast = useToast();
  const { data, error, loading, reload } = useApiQuery('/platform-management/allowlist', { platformScoped: false });
  const [hosts, setHosts] = useState([]);
  const [entry, setEntry] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setHosts(data.managedHosts); }, [data]);
  const dirty = data && JSON.stringify(hosts) !== JSON.stringify(data.managedHosts);

  const add = (e) => {
    e.preventDefault();
    const value = entry.trim().toLowerCase();
    if (value && !hosts.includes(value)) setHosts([...hosts, value]);
    setEntry('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/platform-management/allowlist', { hosts });
      toast.success('Approved hosts updated.');
      reload();
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={<><ShieldCheck size={14} /> Settings</>}
        title="Approved API hosts"
        description="The reporting server only calls platform APIs on these hosts. Private networks, loopback and cloud metadata addresses are always blocked, even if listed."
      />
      {error ? <div className="card"><ErrorPanel error={error} onRetry={reload} /></div> : loading || !data ? <KpiSkeletonGrid count={2} /> : (
        <div className="grid-2">
          <Card title="Managed by Super Admins" icon={ShieldCheck} footer={(
            <div className="row-between">
              <span className="text-muted">{dirty ? 'Unsaved changes' : 'All changes saved'} · every change is audited</span>
              <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={!dirty || saving}>{saving && <Loader2 size={14} className="spin" />} Save</button>
            </div>
          )}>
            <form className="row" onSubmit={add} style={{ flexWrap: 'nowrap', marginBottom: 16 }}>
              <Field className="grow" hint="api.example.com, *.example.com or api.example.com:8443">
                <input className="input mono" value={entry} onChange={e => setEntry(e.target.value)} placeholder="api.example.com" aria-label="Host to approve" />
              </Field>
              <button type="submit" className="btn btn--secondary" style={{ alignSelf: 'flex-start' }} disabled={!entry.trim()}><Plus size={15} /> Add</button>
            </form>
            {hosts.length === 0 ? <p className="text-muted">No hosts approved here yet.</p> : (
              <div className="chip-list">{hosts.map(h => <span key={h} className="chip"><code>{h}</code><button type="button" onClick={() => setHosts(hosts.filter(x => x !== h))} aria-label={`Remove ${h}`}><X size={13} /></button></span>)}</div>
            )}
          </Card>
          <Card title="Set by server configuration" icon={Lock} subtitle="From OUTBOUND_ALLOWED_HOSTS — change it in the server environment.">
            {data.envHosts.length === 0 ? <p className="text-muted">None.</p> : <div className="chip-list">{data.envHosts.map(h => <span key={h} className="chip"><code>{h}</code></span>)}</div>}
            <div style={{ marginTop: 16 }}><Alert tone="neutral">Only HTTPS is allowed, credentials are never forwarded to a different host on redirect, and every DNS answer is checked before connecting.</Alert></div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ApprovedHostsPage;
