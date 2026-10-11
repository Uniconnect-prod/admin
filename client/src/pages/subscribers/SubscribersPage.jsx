import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Download, RefreshCw, Layers } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SubscriberDetailsDrawer } from './SubscriberDetailsDrawer';
import './SubscribersPage.scss';

export const SubscribersPage = () => {
  const { activePlatform } = useAuth();

  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10
  });

  const [filterOptions, setFilterOptions] = useState({
    offerCodes: [],
    statuses: ['Active', 'Inactive', 'Renewal', 'Suspended', 'Deactivated'],
    lifecycles: ['NEW', 'ACTIVE', 'GRACE', 'CHURNED', 'SUSPENDED']
  });

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    status: 'ALL',
    offer_code: 'ALL',
    lifecycle: 'ALL',
    search: ''
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    order: 'DESC'
  });

  const [selectedSubscriberId, setSelectedSubscriberId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch Subscribers from Backend
  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: pagination.limit,
        sort_by: sortConfig.key,
        sort_order: sortConfig.order,
        ...filters
      };

      const res = await api.get('/subscribers', { params });
      if (res.data?.success) {
        setSubscribers(res.data.data.records);
        setPagination(res.data.data.pagination);
        if (res.data.data.filterOptions) {
          setFilterOptions(res.data.data.filterOptions);
        }
      }
    } catch (err) {
      console.error('Failed to load subscribers:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, sortConfig, filters, activePlatform?.code]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleApplyFilter = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleResetFilter = (resetState) => {
    setFilters(resetState);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleSort = (key, order) => {
    setSortConfig({ key, order });
  };

  const handleOpenDetails = (sub) => {
    setSelectedSubscriberId(sub.id);
    setIsDrawerOpen(true);
  };

  const handleExportCsv = async () => {
    try {
      const response = await api.get('/export/subscribers', {
        params: filters,
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const platformName = activePlatform?.name ? activePlatform.name.replace(/\s+/g, '') : 'All_Platforms';
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `${platformName}_Subscribers_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export CSV.');
    }
  };

  const columns = [
    {
      header: 'MSISDN',
      key: 'msisdn',
      sortable: true,
      render: (row) => (
        <div className="msisdn-cell">
          <span className="msisdn-number">+{String(row.msisdn || '').replace(/^\++/, '')}</span>
          {activePlatform?.isAll && <span className="platform-tag">{row.platform_name}</span>}
        </div>
      )
    },
    {
      header: 'Offer Code',
      key: 'offer_code',
      sortable: true,
      render: (row) => <span className="offer-code-pill">{row.offer_code}</span>
    },
    {
      header: 'Reason',
      key: 'reason',
      sortable: false,
      render: (row) => <span className="text-secondary">{row.reason}</span>
    },
    {
      header: 'Lifecycle',
      key: 'lifecycle',
      sortable: true,
      render: (row) => <span className={`lifecycle-tag tag-${row.lifecycle.toLowerCase()}`}>{row.lifecycle}</span>
    },
    {
      header: 'Next Billing Date',
      key: 'next_billing_date',
      sortable: true,
      render: (row) => (
        <span className="date-text">
          {row.next_billing_date ? new Date(row.next_billing_date).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Charging Amount',
      key: 'charging_amount',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="amount-cell">
          GHC {Number(row.charging_amount).toFixed(2)}
        </span>
      )
    },
    {
      header: (filters.status || '').toLowerCase() === 'renewal' ? 'Renewal Time' : 'Created At',
      key: 'created_at',
      sortable: true,
      render: (row) => {
        const isRenewal = (filters.status || '').toLowerCase() === 'renewal' || row.is_renewal;
        const dateVal = row.renewed_at || row.created_at;
        return (
          <span className="date-text font-mono">
            {new Date(dateVal).toLocaleDateString()}
            {isRenewal && (
              <span className="text-secondary" style={{ fontSize: '0.82rem', marginLeft: '6px' }}>
                {new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'center',
      render: (row) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm table-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails(row);
          }}
          title="View Details"
        >
          <Eye size={13} />
          View Details
        </button>
      )
    }
  ];

  return (
    <div className="subscribers-page">
      <PageHeader
        title="Subscribers"
        subtitle={
          (filters.status || '').toLowerCase() === 'renewal'
            ? `${pagination.totalRecords.toLocaleString()} renewal timeline events found`
            : `${pagination.totalRecords.toLocaleString()} records found`
        }
        breadcrumbs={['Home', 'Subscriber Management', (filters.status || '').toLowerCase() === 'renewal' ? 'Timeline Renewals' : 'All Subscribers']}
        platformBadge={activePlatform?.name}
      />

      <FilterBar
        filters={filters}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
        onExport={handleExportCsv}
        onRefresh={fetchSubscribers}
        loading={loading}
        offerCodes={filterOptions.offerCodes}
        statuses={filterOptions.statuses}
        lifecycles={filterOptions.lifecycles}
      />

      <DataTable
        columns={columns}
        data={subscribers}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPagination(prev => ({ ...prev, currentPage: p }))}
        onLimitChange={(l) => setPagination(prev => ({ ...prev, limit: l, currentPage: 1 }))}
        sortConfig={sortConfig}
        onSort={handleSort}
        onRowClick={handleOpenDetails}
        emptyMessage="No subscribers found matching your filter criteria."
      />

      {/* Subscriber Details Slide-out Drawer */}
      <SubscriberDetailsDrawer
        subscriberId={selectedSubscriberId}
        isOpen={isDrawerOpen}
        defaultTab={(filters.status || '').toLowerCase() === 'renewal' ? 'renewals' : 'overview'}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedSubscriberId(null);
        }}
      />
    </div>
  );
};

