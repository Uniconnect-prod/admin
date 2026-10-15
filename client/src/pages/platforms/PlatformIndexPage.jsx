import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlugZap, GitMerge, ArrowRight, Plus } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { PageHeader, Card, StatusBadge, PlatformAvatar } from '../../components/ui/primitives';
import { ErrorPanel, TableSkeleton, StateView } from '../../components/ui/feedback';
import { integrationState } from './PlatformsListPage';
import './Platforms.scss';

const AUTH_LABELS = { none: 'None', bearer: 'Bearer token', api_key: 'API key header', login_token: 'Login → token' };

/**
 * Index pages for "API Configuration" and "Data Mapping": a cross-platform overview
 * that links into the relevant wizard step for each platform.
 */
const PlatformIndexPage = ({ mode }) => {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiQuery('/platform-management', { platformScoped: false });
  const isApi = mode === 'api';

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={isApi ? <><PlugZap size={14} /> Platforms</> : <><GitMerge size={14} /> Platforms</>}
        title={isApi ? 'API configuration' : 'Data mapping'}
        description={isApi
          ? 'Endpoint, authentication, request parameters and pagination for every platform API.'
          : 'How each platform API response maps onto the canonical reporting model, and which reports that enables.'}
      />
      <Card flush>
        {error ? <ErrorPanel error={error} onRetry={reload} /> : loading ? <TableSkeleton rows={4} cols={6} /> : !data?.length ? (
          <StateView icon={PlugZap} title="No platforms yet" actions={<Link className="btn btn--primary" to="/platforms/new"><Plus size={16} /> Add platform</Link>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                {isApi ? (
                  <tr><th>Platform</th><th>Endpoint</th><th>Auth</th><th>Parameters</th><th>Pagination</th><th>Integration</th><th /></tr>
                ) : (
                  <tr><th>Platform</th><th className="num">Daily</th><th className="num">Summary</th><th className="num">Records</th><th>Supported reports</th><th>Integration</th><th /></tr>
                )}
              </thead>
              <tbody>
                {data.map(p => {
                  const cfg = p.integration;
                  const integ = integrationState(p);
                  const go = () => navigate(`/platforms/${p.id}?step=${isApi ? 'api' : 'mapping'}`);
                  return (
                    <tr key={p.id} className="is-clickable" onClick={go}>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}><PlatformAvatar platform={p} size={28} /><div><div className="text-strong">{p.name}</div><span className="cell-sub">{p.code}</span></div></div></td>
                      {isApi ? (
                        <>
                          <td className="mono" style={{ fontSize: 12 }}>{cfg?.base_url ? `${cfg.endpoints?.report?.method || 'GET'} ${cfg.base_url}${cfg.endpoints?.report?.path || ''}` : <span className="unavailable">not configured</span>}</td>
                          <td>{cfg ? AUTH_LABELS[cfg.auth?.type] || cfg.auth?.type : '—'}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{cfg ? Object.values(cfg.params || {}).filter(Boolean).join(', ') || '—' : '—'}</td>
                          <td>{cfg?.pagination?.strategy || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="num">{Object.keys(cfg?.mappings?.daily || {}).length}</td>
                          <td className="num">{Object.keys(cfg?.mappings?.summary || {}).length}</td>
                          <td className="num">{Object.keys(cfg?.mappings?.records || {}).length}</td>
                          <td>{p.capabilities ? <div className="chip-list">{Object.entries(p.capabilities.modules).filter(([, ok]) => ok).map(([m]) => <span key={m} className="badge badge--brand">{m}</span>)}</div> : '—'}</td>
                        </>
                      )}
                      <td><StatusBadge status={integ.status} label={integ.label} /></td>
                      <td className="text-right"><button type="button" className="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); go(); }}>Edit <ArrowRight size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PlatformIndexPage;
