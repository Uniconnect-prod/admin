import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Edit,
  Database,
  CheckCircle2,
  AlertCircle,
  Zap,
  Globe,
  Server,
  Power,
  ShieldCheck,
  Search,
  Filter,
  Check,
  Loader2,
  Settings2,
  RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PlatformWizardModal } from './PlatformWizardModal';
import './PlatformsPage.scss';

export const PlatformsPage = () => {
  const { user, refreshPlatforms } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Wizard modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // Quick inline test connection state: { [platformId]: { testing: boolean, result: object } }
  const [connTestStates, setConnTestStates] = useState({});
  const [notification, setNotification] = useState(null);

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/platform-management');
      if (res.data?.success) {
        setPlatforms(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load platforms:', err);
      showNotification('error', 'Failed to retrieve platform configurations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Inline connection test for quick health verification
  const handleQuickTest = async (platform) => {
    const pId = platform.id;
    setConnTestStates(prev => ({
      ...prev,
      [pId]: { testing: true, result: null }
    }));

    try {
      const res = await api.post(`/platform-management/${pId}/test-connection`);
      if (res.data?.success) {
        setConnTestStates(prev => ({
          ...prev,
          [pId]: { testing: false, result: res.data.data }
        }));
        showNotification('success', `Connection to '${platform.name}' verified (${res.data.data.latencyMs}ms).`);
        fetchPlatforms();
      } else {
        setConnTestStates(prev => ({
          ...prev,
          [pId]: { testing: false, result: { success: false, error: res.data?.message } }
        }));
        showNotification('error', `Connection test failed for '${platform.name}'.`);
      }
    } catch (err) {
      setConnTestStates(prev => ({
        ...prev,
        [pId]: { testing: false, result: { success: false, error: err.message } }
      }));
      showNotification('error', `Connection error: ${err.message}`);
    }
  };

  // Toggle Activate / Disable
  const handleToggleStatus = async (platform) => {
    const isCurrentlyActive = platform.status === 'ACTIVE';
    const action = isCurrentlyActive ? 'disable' : 'activate';
    const actionLabel = isCurrentlyActive ? 'Disable' : 'Activate';

    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} '${platform.name}' (${platform.code})?`)) {
      return;
    }

    try {
      const res = await api.post(`/platform-management/${platform.id}/${action}`);
      if (res.data?.success) {
        showNotification('success', res.data.message || `Platform status updated.`);
        await fetchPlatforms();
        if (refreshPlatforms) await refreshPlatforms();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || `Failed to ${action} platform.`);
    }
  };

  // Filtered platforms
  const filteredPlatforms = platforms.filter(p => {
    const matchesSearch =
      !searchQuery.trim() ||
      (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.database_name && p.database_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.country && p.country.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (p.status && p.status.toUpperCase() === statusFilter.toUpperCase());

    return matchesSearch && matchesStatus;
  });

  // KPI summary metrics
  const totalPlatformsCount = platforms.length;
  const activePlatformsCount = platforms.filter(p => p.status === 'ACTIVE').length;
  const connectedDatabasesCount = platforms.filter(p => p.connection?.status === 'CONNECTED' || p.status === 'ACTIVE').length;
  const validatedCount = platforms.filter(p => p.validation?.status === 'PASSED').length;

  const columns = [
    {
      header: 'Platform',
      key: 'name',
      render: (row) => (
        <div className="platform-name-cell">
          <div
            className="platform-emblem"
            style={{
              backgroundColor: `${row.accent_color || '#00E5FF'}20`,
              color: row.accent_color || '#00E5FF',
              borderColor: `${row.accent_color || '#00E5FF'}40`
            }}
          >
            {(row.code || 'PL').slice(0, 2)}
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <strong className="platform-title">{row.name}</strong>
              <span className="platform-code-pill font-mono">{row.code}</span>
            </div>
            <span className="platform-desc-subtitle">{row.description || 'Enterprise reporting platform'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Database & Target',
      key: 'database_name',
      render: (row) => (
        <div className="db-info-cell">
          <div className="d-flex align-items-center gap-1 font-mono text-dark fw-bold">
            <Database size={13} className="text-primary flex-shrink-0" />
            <span>{row.connection?.database_name || row.database_name || row.name}</span>
          </div>
          <span className="text-muted small">
            {row.collections?.sdp_logs ? `SDP: ${row.collections.sdp_logs}` : 'Standard Schema'}
          </span>
        </div>
      )
    },
    {
      header: 'Timezone / Market',
      key: 'business_timezone',
      render: (row) => (
        <div className="tz-info-cell">
          <div className="d-flex align-items-center gap-1">
            <Globe size={13} className="text-muted" />
            <span>{row.country || 'Ghana'}</span>
          </div>
          <span className="text-muted small font-mono">{row.business_timezone || 'Africa/Accra'}</span>
        </div>
      )
    },
    {
      header: 'Connectivity',
      key: 'connection_status',
      render: (row) => {
        const testState = connTestStates[row.id];
        const isConnected = row.connection?.status === 'CONNECTED' || row.status === 'ACTIVE';

        if (testState?.testing) {
          return (
            <span className="conn-status-tag testing">
              <Loader2 size={12} className="spin-animation" />
              Testing...
            </span>
          );
        }

        return (
          <div className="d-flex align-items-center gap-2">
            <span className={`conn-status-tag ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot" />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button
              type="button"
              className="btn-quick-ping"
              title="Test MongoDB Connection"
              onClick={() => handleQuickTest(row)}
            >
              <Zap size={13} />
            </button>
          </div>
        );
      }
    },
    {
      header: 'Config Status',
      key: 'status',
      render: (row) => {
        const s = (row.status || 'DRAFT').toUpperCase();
        return (
          <span className={`config-status-badge ${s.toLowerCase()}`}>
            {s === 'ACTIVE' && <Check size={11} />}
            {s}
          </span>
        );
      }
    },
    {
      header: 'Enabled Modules',
      key: 'enabled_modules',
      render: (row) => (
        <div className="modules-compact-grid">
          {(row.enabled_modules || []).slice(0, 3).map((m) => (
            <span key={m} className="module-compact-chip">
              {m}
            </span>
          ))}
          {(row.enabled_modules || []).length > 3 && (
            <span className="module-more-chip">
              +{(row.enabled_modules || []).length - 3}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (row) => (
        <div className="platform-actions-group">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedPlatform(row);
              setWizardOpen(true);
            }}
            title="Configure Mappings & Rules"
          >
            <Settings2 size={13} />
            Configure
          </button>

          <button
            type="button"
            className={`btn btn-sm ${row.status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success'}`}
            onClick={() => handleToggleStatus(row)}
            title={row.status === 'ACTIVE' ? 'Disable Platform' : 'Activate Platform'}
          >
            <Power size={13} />
            {row.status === 'ACTIVE' ? 'Disable' : 'Activate'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="platforms-management-page fade-in">
      <PageHeader
        title="Multi-Platform & Dynamic Database Management"
        subtitle="Connect, map, validate, and activate unlimited MongoDB databases directly from the dashboard without redeploying code."
        breadcrumbs={['Home', 'Platform Management', 'All Platforms']}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedPlatform(null);
              setWizardOpen(true);
            }}
          >
            <Plus size={16} />
            Add New Platform
          </button>
        }
      />

      {notification && (
        <div className={`platform-toast-banner ${notification.type} fade-in`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <div className="platforms-metrics-ribbon mb-4">
        <div className="metric-card">
          <div className="metric-icon-box bg-primary-soft">
            <Layers size={18} className="text-primary" />
          </div>
          <div>
            <span className="metric-label">Total Platforms</span>
            <span className="metric-val">{totalPlatformsCount}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box bg-success-soft">
            <CheckCircle2 size={18} className="text-success" />
          </div>
          <div>
            <span className="metric-label">Active & Serving</span>
            <span className="metric-val text-success">{activePlatformsCount}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box bg-info-soft">
            <Database size={18} className="text-info" />
          </div>
          <div>
            <span className="metric-label">Live Databases</span>
            <span className="metric-val">{connectedDatabasesCount}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box bg-purple-soft">
            <ShieldCheck size={18} className="text-purple" />
          </div>
          <div>
            <span className="metric-label">Validated Schemas</span>
            <span className="metric-val text-purple">{validatedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-controls-bar mb-3">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search platforms by name, code, database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <select
            className="form-control status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DRAFT">Draft</option>
            <option value="NEEDS_VALIDATION">Needs Validation</option>
            <option value="VALIDATING">Validating</option>
            <option value="DISABLED">Disabled / Archived</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            title="Refresh List"
            onClick={fetchPlatforms}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredPlatforms}
        loading={loading}
        emptyMessage="No matching platforms registered. Click 'Add New Platform' to register one."
      />

      {/* Comprehensive Multi-Step Add/Edit Platform Wizard */}
      <PlatformWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialPlatform={selectedPlatform}
        onSuccess={() => {
          showNotification('success', 'Platform configuration saved successfully.');
          fetchPlatforms();
          if (refreshPlatforms) refreshPlatforms();
        }}
      />
    </div>
  );
};
