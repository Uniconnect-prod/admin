import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import './DataTable.scss';

export const DataTable = ({
  columns,
  data = [],
  loading = false,
  pagination,
  onPageChange,
  onLimitChange,
  sortConfig,
  onSort,
  emptyMessage = 'No records found matching criteria.',
  onRowClick
}) => {
  const { totalRecords = 0, totalPages = 1, currentPage = 1, limit = 10 } = pagination || {};

  const handleSort = (colKey) => {
    if (!onSort) return;
    if (sortConfig?.key === colKey) {
      onSort(colKey, sortConfig.order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      onSort(colKey, 'DESC');
    }
  };

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, totalRecords);

  return (
    <div className="enterprise-data-table-wrapper">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key || col.header}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className={col.sortable ? 'sortable-th' : ''}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="th-content" style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="sort-icon">
                        {sortConfig?.key === col.key ? (
                          sortConfig.order === 'ASC' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={12} className="sort-idle" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // Loading skeletons
              Array.from({ length: limit > 8 ? 8 : limit }).map((_, rIdx) => (
                <tr key={`skel-${rIdx}`} className="skeleton-row">
                  {columns.map((_, cIdx) => (
                    <td key={`skel-td-${cIdx}`}>
                      <div className="skeleton-bar" style={{ width: `${60 + (cIdx * 12) % 35}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-table-cell">
                  <div className="empty-table-message">{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'clickable-row' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key || col.header} style={{ textAlign: col.align || 'left' }}>
                      {col.render ? col.render(row, rIdx) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="table-pagination-bar">
          <div className="pagination-info">
            Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{' '}
            <strong>{totalRecords.toLocaleString()}</strong> records
          </div>

          <div className="pagination-controls">
            {onLimitChange && (
              <div className="rows-per-page">
                <span>Rows per page:</span>
                <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}

            <div className="page-nav-buttons">
              <button
                type="button"
                className="nav-btn"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(1)}
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                className="nav-btn"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="current-page-label">
                Page {currentPage} of {totalPages || 1}
              </span>

              <button
                type="button"
                className="nav-btn"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="nav-btn"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(totalPages)}
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

