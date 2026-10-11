import React, { useState, useEffect, useCallback } from 'react';
import { UserX, AlertOctagon, Calendar, TrendingDown, Percent, Download, Eye } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SubscriberDetailsDrawer } from '../subscribers/SubscriberDetailsDrawer';
import './ChurnPage.scss';

export const ChurnPage = () => {
  const { activePlatform } = useAuth();

  const [loading, setLoading] = useState(true);
  const [churnData, setChurnData] = useState(null);
  const [selectedSubscriberId, setSelectedSubscriberId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [pagination, setPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10
  });

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    reason: 'ALL',
    offer_code: 'ALL',
    lifecycle: 'ALL'
  });

  const fetchChurn = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/churn', {
        params: {
          page: pagination.currentPage,
          limit: pagination.limit,
          ...filters
        }
      });
      if (res.data?.success) {
        setChurnData(res.data.data);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load churn data:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, filters, activePlatform?.code]);

  useEffect(() => {
    fetchChurn();
  }, [fetchChurn]);

  const handleOpenDetails = (row) => {
    setSelectedSubscriberId(row.id || row.msisdn);
    setIsDrawerOpen(true);
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/export/churn', {
        params: filters,
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const platformName = activePlatform?.name ? activePlatform.name.replace(/\s+/g, '') : 'All_Platforms';
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `${platformName}_Churn_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export churn CSV.');
    }
  };

  const kpis = churnData?.kpis || {};
  const records = churnData?.records || [];

  const columns = [
    {
      header: 'MSISDN (Player)',
      key: 'msisdn',
      render: (row) => (
        <div className="msisdn-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="font-mono font-bold">+{String(row.msisdn || '').replace(/^\++/, '')}</span>
          {activePlatform?.isAll && (
            <span
              className="platform-tag"
              style={{
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f1f5f9',
                color: '#475569',
                fontWeight: 600
              }}
            >
              {row.platform_name}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Offer Code',
      key: 'offer_code',
      render: (row) => <span className="offer-tag">{row.offer_code}</span>
    },
    {
      header: 'Churn Reason',
      key: 'reason',
      render: (row) => (
        <span className="reason-pill">
          {row.reason}
        </span>
      )
    },
    {
      header: 'Lifecycle Prior',
      key: 'lifecycle',
      render: (row) => <span className="text-secondary">{row.lifecycle}</span>
    },
    {
      header: 'Last Billing Date',
      key: 'last_billing_date',
      render: (row) => row.last_billing_date ? new Date(row.last_billing_date).toLocaleDateString() : '—'
    },
    {
      header: 'Churn Date',
      key: 'churned_at',
      render: (row) => (
        <span className="churn-date-text">
          {new Date(row.churned_at).toLocaleDateString()} {new Date(row.churned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    },
    {
      header: 'Current Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status || 'Cancelled'} />
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'center',
      render: (row) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm table-action-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155'
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails(row);
          }}
          title="View Player Profile"
        >
          <Eye size={13} />
          View Player
        </button>
      )
    }
  ];

  return (
    <div className="churn-page">
      <PageHeader
        title="Churn Subscribers"
        subtitle={
          pagination.totalRecords > 0
            ? `${pagination.totalRecords.toLocaleString()} churned player records found for ${activePlatform?.name || 'All Platforms'}`
            : `Terminations, attrition drivers and churned players for ${activePlatform?.name || 'All Platforms'}`
        }
        breadcrumbs={['Home', 'Subscriber Management', 'Churn Subscribers']}
        platformBadge={activePlatform?.name}
      />

      {/* KPI Cards */}
      <div className="kpi-grid-5">
        <KpiCard
          title="Total Churn"
          value={kpis.totalChurn !== undefined ? kpis.totalChurn.toLocaleString() : '—'}
          change="-0.5%"
          trend="down"
          comparison="total churn base"
          icon={UserX}
          color="danger"
        />
        <KpiCard
          title="Today's Churn"
          value={kpis.todayChurn !== undefined ? kpis.todayChurn.toLocaleString() : '—'}
          change="+1.2%"
          trend="up"
          comparison="last 24 hours"
          icon={AlertOctagon}
          color="warning"
        />
        <KpiCard
          title="Weekly Churn"
          value={kpis.weeklyChurn !== undefined ? kpis.weeklyChurn.toLocaleString() : '—'}
          change="-3.0%"
          trend="down"
          comparison="rolling 7 days"
          icon={Calendar}
          color="primary"
        />
        <KpiCard
          title="Monthly Churn"
          value={kpis.monthlyChurn !== undefined ? kpis.monthlyChurn.toLocaleString() : '—'}
          change="-1.8%"
          trend="down"
          comparison="current 30 days"
          icon={TrendingDown}
          color="accent"
        />
        <KpiCard
          title="Churn Rate"
          value={kpis.churnRate || '—'}
          change="-0.9%"
          trend="down"
          comparison="attrition ratio"
          icon={Percent}
          color="danger"
        />
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onApply={(f) => { setFilters(f); setPagination(p => ({ ...p, currentPage: 1 })); }}
        onReset={(r) => { setFilters(r); setPagination(p => ({ ...p, currentPage: 1 })); }}
        onExport={handleExport}
        onRefresh={fetchChurn}
        loading={loading}
        offerCodes={['9923310010', '9919910026', '9923310009']}
        statuses={['Cancelled', 'Expired', 'Failed']}
        lifecycles={['UNSUB1', 'CHURNED', 'DEACTIVATED']}
      />

      {/* Churn Records Table */}
      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPagination(prev => ({ ...prev, currentPage: p }))}
        onLimitChange={(l) => setPagination(prev => ({ ...prev, limit: l, currentPage: 1 }))}
        onRowClick={handleOpenDetails}
        emptyMessage="No churned subscriber records found for the selected filter."
      />

      {/* Churned Player Details Drawer */}
      <SubscriberDetailsDrawer
        subscriberId={selectedSubscriberId}
        isOpen={isDrawerOpen}
        defaultTab="overview"
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedSubscriberId(null);
        }}
      />
    </div>
  );
};
