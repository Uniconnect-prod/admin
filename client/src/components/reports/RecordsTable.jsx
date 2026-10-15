import React, { useEffect, useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { downloadCsv, describeBlobError } from '../../services/api';
import { formatDateTime, formatMoney } from '../../services/format';
import { Pagination } from '../ui/data';
import { Drawer } from '../ui/overlays';
import { ErrorPanel, TableSkeleton, StateView } from '../ui/feedback';
import { StatusBadge } from '../ui/primitives';

function renderCell(col, value, currency, timeZone) {
  if (value === null || value === undefined || value === '') return <span className="unavailable">—</span>;
  if (col.type === 'datetime') return <span className="nowrap" title={timeZone}>{formatDateTime(value, timeZone)}</span>;
  if (col.type === 'decimal') return formatMoney(value, currency);
  if (col.key === 'status') return <StatusBadge status={String(value).toUpperCase()} label={String(value)} dot={false} />;
  if (col.key === 'msisdn') return <span className="mono">{value}</span>;
  return String(value);
}

/**
 * Record-level list from the platform API (subscriptions, renewals, deactivations),
 * paginated by the source API itself.
 */
export const RecordsTable = ({ reportType, queryParams, search = '', status = '', title, emptyText }) => {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const params = { ...queryParams, reportType, page, pageSize: 25, ...(search ? { search } : {}), ...(status ? { status } : {}) };
  const { data, error, loading, refetch } = useApiQuery('/reports/records', { params });

  useEffect(() => { setPage(1); }, [JSON.stringify(queryParams), search, status, reportType]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    setExporting(true);
    try {
      const meta = await downloadCsv('/export/records', { ...queryParams, reportType, ...(search ? { search } : {}) });
      if (meta.complete) toast.success(`Exported ${meta.rows.toLocaleString()} record(s)${meta.duplicatesSkipped ? ` (${meta.duplicatesSkipped} duplicate(s) removed)` : ''}.`);
      else toast.warning(`Export INCOMPLETE: the platform reported ${meta.reportedTotal?.toLocaleString()} records but returned ${meta.rows.toLocaleString()}. Do not treat this file as complete.`, { timeout: 15000 });
    } catch (err) {
      const e = await describeBlobError(err);
      toast.error(`Export failed: ${e.message}${e.detail ? ` ${e.detail}` : ''}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="card card--flush">
      <div className="card__header">
        <div className="grow">
          <h2 className="card__title"><FileText size={17} className="card__title-icon" />{title}</h2>
          <p className="card__subtitle">Record-level data from the platform API · page size 25{data?.range?.timezone ? ` · times in ${data.range.timezone}` : ''}{data?.supports && !data.supports.search && search ? ' · search not supported by this API' : ''}</p>
        </div>
        {can('export') && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={exportCsv} disabled={exporting || !data || data.rows.length === 0}>
            {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Export CSV
          </button>
        )}
      </div>
      <div className="card__body">
        {error ? <ErrorPanel error={error} onRetry={refetch} compact /> : loading || !data ? <TableSkeleton rows={6} cols={5} /> : data.rows.length === 0 ? (
          <StateView compact icon={FileText} title="No records" text={emptyText || 'The platform API returned no records for this period.'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>{data.columns.map(c => <th key={c.key} className={c.type === 'decimal' ? 'num' : ''}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={r.record_id || i} className="is-clickable" onClick={() => setSelected(r)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSelected(r); }}>
                      {data.columns.map(c => <td key={c.key} className={c.type === 'decimal' ? 'num' : ''}>{renderCell(c, r[c.key], data.currency, data.range?.timezone)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...data.pagination} onChange={setPage} />
          </>
        )}
      </div>
      <Drawer open={Boolean(selected)} title="Record details" subtitle="Fields mapped from the platform API" onClose={() => setSelected(null)}>
        {selected && data && (
          <dl className="kv">
            {data.columns.map(c => (
              <React.Fragment key={c.key}>
                <dt>{c.label}</dt>
                <dd>{renderCell(c, selected[c.key], data.currency, data.range?.timezone)}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </Drawer>
    </section>
  );
};

export default RecordsTable;
