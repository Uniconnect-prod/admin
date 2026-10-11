import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Users,
  UserCheck,
  DollarSign,
  AlertCircle,
  Database,
  Clock,
  ShieldCheck,
  Layers,
  Sparkles,
  Download,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { DateRangePicker } from '../../components/common/DateRangePicker';
import './DashboardPage.scss';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // Table breakdown states
  const [metricView, setMetricView] = useState('revenue'); // 'revenue' | 'volume'
  const [searchDate, setSearchDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const abortControllerRef = useRef(null);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    // Cancel pending Axios request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await api.get('/reports/overview', {
        headers: {
          'x-platform-code': 'GHSUPERWINNINGS'
        },
        params: {
          range,
          from: customFrom,
          to: customTo
        },
        signal: controller.signal
      });

      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setLastRefreshedAt(new Date());
      } else {
        setError(res.data?.message || 'Unable to load dashboard data');
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to load GHSUPERWINNINGS dashboard data:', err);
      setError('Unable to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    fetchDashboardData(false);

    // 60-second polling refresh (strictly read-only)
    const pollInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 60000);

    return () => {
      clearInterval(pollInterval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDashboardData]);

  // Dynamic KPI value extractor: respects zero as valid (0 not N/A), no fake deltas
  const getKpi = (key) => {
    const card = data?.kpis?.cards?.[key];
    const raw = data?.kpis?.[key];

    if (card) {
      return {
        title: card.title,
        value: card.value !== undefined ? String(card.value) : '0',
        change: card.change || null,
        trend: card.trend || null,
        comparison: card.comparison || '—'
      };
    }

    if (raw !== undefined && raw !== null) {
      return {
        value: typeof raw === 'number' && key === 'grossRevenue'
          ? `GHC ${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : Number(raw).toLocaleString(),
        change: null,
        trend: null,
        comparison: '—'
      };
    }

    return { value: '0', change: null, trend: null, comparison: '—' };
  };

  const renewals = getKpi('todayRenewals');
  const totalSubs = getKpi('totalSubscribers');
  const activeSubs = getKpi('activeSubscribers');
  const grossRev = getKpi('grossRevenue');

  // Daily Breakdown filtering and pagination
  const allDailyRows = data?.dailyBreakdown || [];
  const filteredDailyRows = allDailyRows.filter(row => {
    if (!searchDate.trim()) return true;
    return row.date.includes(searchDate.trim());
  });

  const totalPages = Math.max(1, Math.ceil(filteredDailyRows.length / rowsPerPage));
  const displayedRows = filteredDailyRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Compute column totals for current filtered rows
  const totals = filteredDailyRows.reduce(
    (acc, row) => ({
      new_subscriber_num: acc.new_subscriber_num + (row.new_subscriber_num || 0),
      new_sub_charged: acc.new_sub_charged + (row.new_sub_charged || 0),
      activation_parking: acc.activation_parking + (row.activation_parking || 0),
      super_winnings_daily_rev: acc.super_winnings_daily_rev + (row.super_winnings_daily_rev || 0),
      super_winnings_daily_tx: acc.super_winnings_daily_tx + (row.super_winnings_daily_tx || 0),
      super_winnings_ondemand_rev: acc.super_winnings_ondemand_rev + (row.super_winnings_ondemand_rev || 0),
      super_winnings_ondemand_tx: acc.super_winnings_ondemand_tx + (row.super_winnings_ondemand_tx || 0),
      grand_total_rev: acc.grand_total_rev + (row.grand_total_rev || 0),
      grand_total_tx: acc.grand_total_tx + (row.grand_total_tx || 0)
    }),
    {
      new_subscriber_num: 0,
      new_sub_charged: 0,
      activation_parking: 0,
      super_winnings_daily_rev: 0,
      super_winnings_daily_tx: 0,
      super_winnings_ondemand_rev: 0,
      super_winnings_ondemand_tx: 0,
      grand_total_rev: 0,
      grand_total_tx: 0
    }
  );

  // CSV Export Function
  const handleExportCSV = () => {
    if (filteredDailyRows.length === 0) return;

    const headers = [
      'Date',
      'New_Subscriber_Num',
      'Activation Parking',
      metricView === 'revenue' ? 'Super Winnings Daily (GHC)' : 'Super Winnings Daily (Tx)',
      metricView === 'revenue' ? 'Super Winnings on-demand Daily (GHC)' : 'Super Winnings on-demand Daily (Tx)',
      metricView === 'revenue' ? 'Grand Total (GHC)' : 'Grand Total (Tx)'
    ];

    const rows = filteredDailyRows.map(r => [
      r.date,
      r.new_subscriber_num,
      r.activation_parking,
      metricView === 'revenue' ? r.super_winnings_daily_rev.toFixed(2) : r.super_winnings_daily_tx,
      metricView === 'revenue' ? r.super_winnings_ondemand_rev.toFixed(2) : r.super_winnings_ondemand_tx,
      metricView === 'revenue' ? r.grand_total_rev.toFixed(2) : r.grand_total_tx
    ]);

    // Append totals row
    rows.push([
      'TOTAL',
      totals.new_subscriber_num,
      totals.activation_parking,
      metricView === 'revenue' ? totals.super_winnings_daily_rev.toFixed(2) : totals.super_winnings_daily_tx,
      metricView === 'revenue' ? totals.super_winnings_ondemand_rev.toFixed(2) : totals.super_winnings_ondemand_tx,
      metricView === 'revenue' ? totals.grand_total_rev.toFixed(2) : totals.grand_total_tx
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GHSUPERWINNINGS_Daily_Settlement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-page ghsuperwinnings-dashboard">
      {/* Page Header: Visual Identity for GHSUPERWINNINGS */}
      <PageHeader
        title="GHSuperWinnings"
        subtitle="Analytics Dashboard"
        breadcrumbs={['Home', 'GHSUPERWINNINGS', 'Dashboard']}
        platformBadge="GHSUPERWINNINGS"
        actions={
          <div className="dashboard-header-actions">
            <DateRangePicker
              selectedRange={range}
              onSelectRange={(r) => {
                setRange(r);
                setCurrentPage(1);
              }}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(type, val) => (type === 'from' ? setCustomFrom(val) : setCustomTo(val))}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm refresh-btn"
              onClick={() => fetchDashboardData(false)}
              disabled={loading || isRefreshing}
              title="Refresh live metrics from GHSUPERWINNINGS"
            >
              <RefreshCw size={13} className={loading || isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* Error State Banner */}
      {error && !data && (
        <div className="dashboard-error-banner">
          <div className="error-icon-box">
            <AlertCircle size={24} />
          </div>
          <div className="error-body">
            <h4 className="error-title">Unable to load dashboard data</h4>
            <p className="error-desc">
              Could not retrieve live metrics from the GHSUPERWINNINGS database. Please check connectivity and retry.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary retry-btn"
            onClick={() => fetchDashboardData(false)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Retry
          </button>
        </div>
      )}

      {/* 4 Primary Business KPI Cards */}
      {loading && !data ? (
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="kpi-card skeleton-card">
              <div className="skeleton-bar title-bar" />
              <div className="skeleton-bar value-bar" />
              <div className="skeleton-bar footer-bar" />
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          {/* Card 1: Today's Renewals */}
          <KpiCard
            title="Today's Renewals"
            value={renewals.value}
            change={renewals.change}
            trend={renewals.trend}
            comparison={renewals.comparison}
            icon={RefreshCw}
            color="primary"
          />

          {/* Card 2: Total Subscribers */}
          <KpiCard
            title="Total Subscribers"
            value={totalSubs.value}
            change={totalSubs.change}
            trend={totalSubs.trend}
            comparison={totalSubs.comparison}
            icon={Users}
            color="accent"
            onClick={() => navigate('/subscribers')}
          />

          {/* Card 3: Active Subscribers */}
          <KpiCard
            title="Active Subscribers"
            value={activeSubs.value}
            change={activeSubs.change}
            trend={activeSubs.trend}
            comparison={activeSubs.comparison}
            icon={UserCheck}
            color="success"
            onClick={() => navigate('/subscribers')}
          />

          {/* Card 4: Gross Billing (Revenue) */}
          <KpiCard
            title="Gross Billing (Revenue)"
            value={grossRev.value}
            change={grossRev.change}
            trend={grossRev.trend}
            comparison={grossRev.comparison}
            icon={DollarSign}
            color="warning"
            onClick={() => navigate('/revenue')}
          />
        </div>
      )}

      {/* DAILY SUBSCRIPTION & BILLING SETTLEMENT BREAKDOWN LIST TABLE */}
      <div className="card daily-breakdown-card">
        <div className="card-header breakdown-card-header">
          <div className="header-info">
            <div className="title-with-badge">
              <Calendar size={18} className="title-icon text-primary-dark" />
              <h3 className="card-title">Daily Subscription & Settlement Breakdown</h3>
              <span className="record-count-badge">
                {filteredDailyRows.length} Days Recorded
              </span>
            </div>
            <p className="card-subtitle">
              Daily acquisition volume, activation parking, and offer billing performance for GHSUPERWINNINGS.
            </p>
          </div>

          <div className="breakdown-controls">
            {/* View Mode Toggle: Revenue in GHC vs Transaction Count */}
            <div className="view-mode-toggle">
              <button
                type="button"
                className={`toggle-option ${metricView === 'revenue' ? 'active' : ''}`}
                onClick={() => setMetricView('revenue')}
              >
                <DollarSign size={13} />
                <span>Revenue (GHC)</span>
              </button>
              <button
                type="button"
                className={`toggle-option ${metricView === 'volume' ? 'active' : ''}`}
                onClick={() => setMetricView('volume')}
              >
                <BarChart3 size={13} />
                <span>Transactions</span>
              </button>
            </div>

            {/* Quick Date Filter Search */}
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search date (YYYY-MM-DD)..."
                value={searchDate}
                onChange={(e) => {
                  setSearchDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm export-btn"
              onClick={handleExportCSV}
              disabled={filteredDailyRows.length === 0}
              title="Export breakdown list to CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Breakdown Table with exact requested column headers */}
        <div className="table-container breakdown-table-wrapper">
          <table className="breakdown-table">
            <thead>
              <tr className="table-main-header">
                <th className="col-date">Date</th>
                <th className="col-num text-center">New_Subscriber_Num</th>
                <th className="col-parking text-center col-boundary">Activation Parking</th>
                <th className="col-offer text-right">Super Winnings Daily</th>
                <th className="col-offer text-right">Super Winnings on-demand Daily</th>
                <th className="col-total text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td colSpan={6}><div className="skeleton-bar" style={{ height: '20px' }} /></td>
                  </tr>
                ))
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    No subscription settlement records found for this period.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.date} className="breakdown-row">
                    {/* Date */}
                    <td className="col-date">
                      <strong className="date-text">{row.date}</strong>
                    </td>

                    {/* New_Subscriber_Num */}
                    <td className="col-num text-center">
                      <span className="metric-pill pill-sub">
                        {row.new_subscriber_num.toLocaleString()}
                      </span>
                      {row.new_sub_charged > 0 && (
                        <span className="charged-subtext" title="Charged activations">
                          ({row.new_sub_charged} billed)
                        </span>
                      )}
                    </td>

                    {/* Activation Parking */}
                    <td className="col-parking text-center col-boundary">
                      <span className={`metric-pill ${row.activation_parking > 0 ? 'pill-parking' : 'pill-zero'}`}>
                        {row.activation_parking.toLocaleString()}
                      </span>
                    </td>

                    {/* Super Winnings Daily */}
                    <td className="col-offer text-right">
                      {metricView === 'revenue' ? (
                        <div className="rev-cell">
                          <strong className="rev-val">
                            GHC {row.super_winnings_daily_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                          <span className="tx-subtext">{row.super_winnings_daily_tx.toLocaleString()} tx</span>
                        </div>
                      ) : (
                        <span className="tx-count-pill">{row.super_winnings_daily_tx.toLocaleString()}</span>
                      )}
                    </td>

                    {/* Super Winnings on-demand Daily */}
                    <td className="col-offer text-right">
                      {metricView === 'revenue' ? (
                        <div className="rev-cell">
                          <strong className={`rev-val ${row.super_winnings_ondemand_rev > 0 ? 'text-primary-dark' : 'text-muted'}`}>
                            GHC {row.super_winnings_ondemand_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                          <span className="tx-subtext">{row.super_winnings_ondemand_tx.toLocaleString()} tx</span>
                        </div>
                      ) : (
                        <span className="tx-count-pill">{row.super_winnings_ondemand_tx.toLocaleString()}</span>
                      )}
                    </td>

                    {/* Grand Total */}
                    <td className="col-total text-right">
                      {metricView === 'revenue' ? (
                        <div className="rev-cell highlight-total">
                          <strong className="grand-rev-val">
                            GHC {row.grand_total_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                          <span className="tx-subtext">{row.grand_total_tx.toLocaleString()} total tx</span>
                        </div>
                      ) : (
                        <strong className="grand-tx-val">{row.grand_total_tx.toLocaleString()}</strong>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer: Summary Totals */}
            {displayedRows.length > 0 && (
              <tfoot>
                <tr className="breakdown-totals-row">
                  <td className="col-date">
                    <strong>TOTAL</strong>
                  </td>
                  <td className="col-num text-center">
                    <strong>{totals.new_subscriber_num.toLocaleString()}</strong>
                  </td>
                  <td className="col-parking text-center col-boundary">
                    <strong>{totals.activation_parking.toLocaleString()}</strong>
                  </td>
                  <td className="col-offer text-right">
                    <strong>
                      {metricView === 'revenue'
                        ? `GHC ${totals.super_winnings_daily_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : totals.super_winnings_daily_tx.toLocaleString()}
                    </strong>
                  </td>
                  <td className="col-offer text-right">
                    <strong>
                      {metricView === 'revenue'
                        ? `GHC ${totals.super_winnings_ondemand_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : totals.super_winnings_ondemand_tx.toLocaleString()}
                    </strong>
                  </td>
                  <td className="col-total text-right highlight-total">
                    <strong className="grand-total-highlight">
                      {metricView === 'revenue'
                        ? `GHC ${totals.grand_total_rev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : totals.grand_total_tx.toLocaleString()}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Table Pagination Controls */}
        {totalPages > 1 && (
          <div className="table-pagination">
            <span className="pagination-info">
              Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredDailyRows.length)} of {filteredDailyRows.length} business dates
            </span>
            <div className="pagination-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Platform Telemetry & Offer Profiles Card */}
      <div className="card platform-telemetry-card">
        <div className="telemetry-header">
          <div className="telemetry-identity">
            <div className="platform-logo-badge">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="telemetry-title">GHSUPERWINNINGS Telemetry & Service Configuration</h3>
              <p className="telemetry-subtitle">
                Operational status, database scoping, and billing offer profiles for GHSUPERWINNINGS.
              </p>
            </div>
          </div>
          <div className="status-indicators">
            <span className="live-status-pill">
              <span className="pulsing-dot" />
              Live MongoDB (Read-Only)
            </span>
          </div>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-item">
            <span className="item-label">
              <Database size={13} />
              Database Scope
            </span>
            <strong className="item-value text-mono">ghsuperwinings</strong>
            <span className="item-note">Strict Read-Only Proxy Enforced</span>
          </div>

          <div className="telemetry-item">
            <span className="item-label">
              <Clock size={13} />
              Business Timezone
            </span>
            <strong className="item-value">Africa/Accra (GMT+0)</strong>
            <span className="item-note">Dynamic Date Boundaries</span>
          </div>

          <div className="telemetry-item">
            <span className="item-label">
              <Layers size={13} />
              Offer Profiles
            </span>
            <div className="offer-codes-list">
              <div className="offer-pill">
                <span className="code">9923310010</span>
                <span className="desc">Super Winnings Daily</span>
              </div>
              <div className="offer-pill">
                <span className="code">9923310009</span>
                <span className="desc">Super Winnings On-demand Daily</span>
              </div>
            </div>
          </div>

          <div className="telemetry-item">
            <span className="item-label">
              <ShieldCheck size={13} />
              Auto-Refresh Schedule
            </span>
            <strong className="item-value">Polling: 60s</strong>
            <span className="item-note">
              {lastRefreshedAt
                ? `Last sync: ${lastRefreshedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Initial load complete'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardPage;
