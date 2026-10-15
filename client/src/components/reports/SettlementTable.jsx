import React, { useMemo, useState } from 'react';
import { formatCount, formatMoney, formatDay } from '../../services/format';
import { ProvenanceBadge } from '../ui/primitives';
import { Pagination } from '../ui/data';
import './reports.scss';

/**
 * Daily settlement table.
 *  view: 'revenue' (money columns) | 'transactions' (paired transaction counts)
 * Columns that the platform's API mapping does not provide are rendered as unavailable,
 * never as zero.
 */
export const SettlementTable = ({ settlement, currency, view = 'revenue', search = '', pageSize = 15, maxRows = null, showRunning = false }) => {
  const [page, setPage] = useState(1);

  const columns = useMemo(() => settlement.columns.map((c, idx) => {
    const useTx = view === 'transactions' && c.kind === 'currency';
    const source = useTx ? c.transactions : c;
    return {
      key: source?.key || c.key,
      label: useTx ? `${c.label}` : c.label,
      sub: useTx ? 'transactions' : (c.kind === 'currency' && currency ? currency : null),
      kind: useTx ? 'count' : c.kind,
      available: Boolean(source?.available),
      provenance: source?.provenance || 'unavailable',
      divider: idx === 2
    };
  }), [settlement.columns, view, currency]);

  const runningKey = view === 'transactions' ? 'transaction_count' : 'grand_total';
  const runningAvailable = showRunning && columns.some(c => c.key === runningKey && c.available);

  const filtered = useMemo(() => {
    const term = search.trim();
    const rows = term ? settlement.rows.filter(r => r.date.includes(term) || formatDay(r.date).toLowerCase().includes(term.toLowerCase())) : settlement.rows;
    return maxRows ? rows.slice(-maxRows).reverse() : rows;
  }, [settlement.rows, search, maxRows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = maxRows ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const fmt = (value, kind) => (kind === 'currency' ? formatMoney(value, null) : formatCount(value));

  return (
    <>
      <div className="table-wrap">
        <table className="table settlement-table">
          <thead>
            <tr>
              <th>Date</th>
              {columns.map(c => (
                <th key={c.key} className={`num ${c.divider ? 'col-divider' : ''}`} title={c.available ? undefined : 'Not provided by this platform\'s API mapping'}>
                  {c.label}
                  {c.sub && <span className="cell-sub">{c.sub}</span>}
                  {!c.available && <span className="cell-sub">not provided by API</span>}
                </th>
              ))}
              {runningAvailable && <th className="num">Running total</th>}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length + 1 + (runningAvailable ? 1 : 0)} className="text-center text-muted" style={{ padding: 32 }}>
                {search ? 'No dates match your search.' : 'The platform API returned no daily rows for this period.'}
              </td></tr>
            ) : visible.map(r => (
              <tr key={r.date}>
                <td className="nowrap text-strong">{formatDay(r.date)}</td>
                {columns.map(c => (
                  <td key={c.key} className={`num ${c.divider ? 'col-divider' : ''} ${!c.available ? 'unavailable' : ''}`}>
                    {c.available ? fmt(r.values[c.key], c.kind) : 'n/a'}
                  </td>
                ))}
                {runningAvailable && <td className="num text-muted">{fmt(r.running[runningKey], view === 'transactions' ? 'count' : 'currency')}</td>}
              </tr>
            ))}
          </tbody>
          {!maxRows && filtered.length > 0 && !search && (
            <tfoot>
              <tr>
                <td>Total <ProvenanceBadge provenance="calculated" note="Sum of the daily rows returned by the platform API" /></td>
                {columns.map(c => (
                  <td key={c.key} className={`num ${c.divider ? 'col-divider' : ''}`}>{c.available ? fmt(settlement.totals[c.key], c.kind) : 'n/a'}</td>
                ))}
                {runningAvailable && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!maxRows && filtered.length > pageSize && (
        <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} totalPages={totalPages} onChange={setPage} label="business days" />
      )}
    </>
  );
};

export const ReportNotices = ({ warnings = [], reconciliation = [], currency }) => {
  const mismatches = reconciliation.filter(r => !r.matches);
  if (!warnings.length && !mismatches.length) return null;
  return (
    <div className="stack">
      {warnings.map(w => (
        <div key={w.code} className="alert alert--warning">
          <span aria-hidden="true">⚠</span>
          <div className="alert__body">{w.message}</div>
        </div>
      ))}
      {mismatches.length > 0 && (
        <div className="alert alert--warning">
          <span aria-hidden="true">⚠</span>
          <div className="alert__body">
            <div className="alert__title">API summary totals differ from the sum of daily rows</div>
            KPIs use the API&apos;s own summary; the table shows daily rows exactly as returned. The two are never combined.
            <ul>
              {mismatches.map(m => (
                <li key={m.key}>{m.label}: summary {m.key.includes('revenue') || m.key === 'grand_total' ? formatMoney(m.summary, currency) : formatCount(m.summary)} vs daily sum {m.key.includes('revenue') || m.key === 'grand_total' ? formatMoney(m.dailySum, currency) : formatCount(m.dailySum)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
