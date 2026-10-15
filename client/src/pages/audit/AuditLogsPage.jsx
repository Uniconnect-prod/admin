import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { PageHeader, Card } from '../../components/ui/primitives';
import { ErrorPanel, TableSkeleton, StateView } from '../../components/ui/feedback';
import { Pagination } from '../../components/ui/data';
import { Drawer } from '../../components/ui/overlays';
import { formatDateTime, humanize } from '../../services/format';

const AuditLogsPage = () => {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const action = params.get('action') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const page = Number(params.get('page') || 1);
  const query = useMemo(() => ({ ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page, limit: 25 }), [action, from, to, page]);
  const { data, error, loading, reload } = useApiQuery('/audit-logs', { params: query, platformScoped: false });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={<><ScrollText size={14} /> Administration</>}
        title="Audit logs"
        description="Sign-ins, exports, user changes and every platform configuration change, test, validation and activation."
      />
      <div className="filters-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="select" style={{ width: 'auto', minWidth: 220 }} value={action} onChange={e => update({ action: e.target.value })} aria-label="Action">
          <option value="">All actions</option>
          {(data?.actions || []).map(a => <option key={a} value={a}>{humanize(a)}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 160 }} value={from} max={to || undefined} onChange={e => update({ from: e.target.value })} aria-label="From date" />
        <span className="text-faint">to</span>
        <input type="date" className="input" style={{ width: 160 }} value={to} min={from || undefined} onChange={e => update({ to: e.target.value })} aria-label="To date" />
        {(action || from || to) && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>}
      </div>
      <Card flush>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading || !data ? <TableSkeleton rows={10} cols={5} /> : data.records.length === 0 ? (
          <StateView compact icon={ScrollText} title="No audit events for these filters" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Action</th><th>User</th><th>Platform</th><th>Entity</th><th>IP</th></tr></thead>
                <tbody>
                  {data.records.map(r => (
                    <tr key={r.id} className="is-clickable" onClick={() => setSelected(r)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSelected(r); }}>
                      <td className="nowrap">{formatDateTime(r.timestamp)}</td>
                      <td><span className="badge badge--brand">{humanize(r.action)}</span></td>
                      <td>{r.user}</td>
                      <td>{r.platform?.name || <span className="text-faint">Global</span>}</td>
                      <td className="text-muted">{r.entity}{r.entityId ? ` #${r.entityId}` : ''}</td>
                      <td className="mono text-muted" style={{ fontSize: 12 }}>{r.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.pagination.currentPage} pageSize={data.pagination.limit} total={data.pagination.totalRecords} totalPages={data.pagination.totalPages} onChange={p => update({ page: String(p) })} label="events" />
          </>
        )}
      </Card>
      <Drawer open={Boolean(selected)} title={selected ? humanize(selected.action) : ''} subtitle={selected ? formatDateTime(selected.timestamp) : ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="stack">
            <dl className="kv">
              <dt>User</dt><dd>{selected.user}</dd>
              <dt>Platform</dt><dd>{selected.platform?.name || 'Global'}</dd>
              <dt>Entity</dt><dd>{selected.entity}{selected.entityId ? ` #${selected.entityId}` : ''}</dd>
              <dt>IP address</dt><dd className="mono">{selected.ip || '—'}</dd>
            </dl>
            <div className="section-title">Details</div>
            <pre className="code-block">{JSON.stringify(selected.metadata, null, 2)}</pre>
            <p className="text-faint" style={{ fontSize: 12 }}>Credential-like fields are redacted before audit records are stored.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AuditLogsPage;
