import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { PageHeader, Card, StatusBadge } from '../../components/ui/primitives';
import { ErrorPanel, TableSkeleton, StateView } from '../../components/ui/feedback';
import { Pagination } from '../../components/ui/data';
import { formatDateTime, humanize } from '../../services/format';

const KINDS = ['TEST', 'VALIDATION', 'ACTIVATION', 'FETCH', 'EXPORT', 'LOGIN'];

const IntegrationHistoryPage = () => {
  const [params, setParams] = useSearchParams();
  const platformId = params.get('platformId') || '';
  const kind = params.get('kind') || '';
  const ok = params.get('ok') || '';
  const page = Number(params.get('page') || 1);
  const query = useMemo(() => ({ ...(platformId ? { platformId } : {}), ...(kind ? { kind } : {}), ...(ok ? { ok } : {}), page, limit: 25 }), [platformId, kind, ok, page]);

  const platforms = useApiQuery('/platform-management', { platformScoped: false });
  const { data, error, loading, reload } = useApiQuery('/platform-management/history', { params: query, platformScoped: false });
  const names = useMemo(() => new Map((platforms.data || []).map(p => [p.id, p.name])), [platforms.data]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={<><History size={14} /> Platforms</>}
        title="Connection & validation history"
        description="Test requests, validation runs, activations and failed fetches/exports. Request metadata only — no credentials or response bodies are stored."
      />
      <div className="filters-bar">
        <select className="select" value={platformId} onChange={e => update({ platformId: e.target.value })} aria-label="Platform">
          <option value="">All platforms</option>
          {(platforms.data || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="select" value={kind} onChange={e => update({ kind: e.target.value })} aria-label="Event type">
          <option value="">All event types</option>
          {KINDS.map(k => <option key={k} value={k}>{humanize(k)}</option>)}
        </select>
        <select className="select" value={ok} onChange={e => update({ ok: e.target.value })} aria-label="Outcome">
          <option value="">Any outcome</option>
          <option value="true">Successful</option>
          <option value="false">Failed</option>
        </select>
      </div>
      <Card flush>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading || !data ? <TableSkeleton rows={8} cols={6} /> : data.records.length === 0 ? (
          <StateView compact icon={History} title="No history yet" text="Test a platform API or run a validation to see entries here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Platform</th><th>Event</th><th>Outcome</th><th>HTTP</th><th>Endpoint</th><th className="num">Time</th><th>Details</th></tr></thead>
                <tbody>
                  {data.records.map(r => (
                    <tr key={r.id}>
                      <td className="nowrap">{formatDateTime(r.created_at)}</td>
                      <td>{names.get(r.platform_id) || r.platform_code || '—'}</td>
                      <td><span className="badge">{humanize(r.kind)}</span></td>
                      <td><StatusBadge status={r.ok ? 'PASSED' : 'FAILED'} label={r.ok ? 'Success' : (r.error_code ? humanize(r.error_code) : 'Failed')} /></td>
                      <td>{r.http_status ?? '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{r.host ? `${r.host}${r.path || ''}` : '—'}</td>
                      <td className="num">{r.duration_ms !== null && r.duration_ms !== undefined ? `${r.duration_ms} ms` : '—'}</td>
                      <td className="text-muted" style={{ maxWidth: 320 }}>{r.message || (r.summary ? Object.entries(r.summary).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.pagination.currentPage} pageSize={data.pagination.limit} total={data.pagination.totalRecords} totalPages={data.pagination.totalPages} onChange={p => update({ page: String(p) })} label="events" />
          </>
        )}
      </Card>
    </div>
  );
};

export default IntegrationHistoryPage;
