import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Clock,
  Coins,
  Loader2,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import './CountriesPage.scss';

const COMMON_TIMEZONES = [
  { value: 'Africa/Accra', label: 'Africa/Accra (UTC+0, Ghana/Universal)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1, Nigeria/West Africa)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (UTC+3, Kenya/East Africa)' },
  { value: 'Africa/Kampala', label: 'Africa/Kampala (UTC+3, Uganda)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (UTC+2, South Africa)' },
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (UTC+0, Côte d\'Ivoire)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+2, Egypt)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+5:30, IST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
];

export const CountriesPage = () => {
  const { user } = useAuth();
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    currency: 'GHS',
    default_timezone: 'Africa/Accra',
    status: 'ACTIVE'
  });

  const fetchCountries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/countries');
      if (res.data?.success) {
        setCountries(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load countries:', err);
      setFeedback({ type: 'error', message: 'Failed to load countries list.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const handleOpenAddModal = () => {
    setEditingCountry(null);
    setFormData({
      name: '',
      code: '',
      currency: 'GHS',
      default_timezone: 'Africa/Accra',
      status: 'ACTIVE'
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (c) => {
    setEditingCountry(c);
    setFormData({
      name: c.name || '',
      code: c.code || '',
      currency: c.currency || 'GHS',
      default_timezone: c.default_timezone || 'Africa/Accra',
      status: c.status || 'ACTIVE'
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveCountry = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Country Name and 2-Letter Code are required.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingCountry) {
        const res = await api.put(`/countries/${editingCountry.id}`, formData);
        if (res.data?.success) {
          setFeedback({ type: 'success', message: res.data.message });
          setModalOpen(false);
          fetchCountries();
        }
      } else {
        const res = await api.post('/countries', formData);
        if (res.data?.success) {
          setFeedback({ type: 'success', message: res.data.message });
          setModalOpen(false);
          fetchCountries();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save country.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCountry = async (c) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate country '${c.name}'?`)) {
      return;
    }

    try {
      const res = await api.delete(`/countries/${c.id}`);
      if (res.data?.success) {
        setFeedback({ type: 'success', message: res.data.message });
        fetchCountries();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete country.' });
    }
  };

  // Filtered Countries
  const filteredCountries = countries.filter(c => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.currency && c.currency.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalCountries = countries.length;
  const activeCountries = countries.filter(c => c.status === 'ACTIVE').length;
  const totalPlatformsConnected = countries.reduce((acc, c) => acc + (c.platformCount || 0), 0);

  const columns = [
    {
      header: 'Country / Market',
      accessor: 'name',
      render: (row) => (
        <div className="country-cell">
          <div className="country-code-badge">{row.code}</div>
          <div>
            <div className="country-name">{row.name}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Market Code',
      accessor: 'code',
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 600 }}>{row.code}</span>
      )
    },
    {
      header: 'Default Currency',
      accessor: 'currency',
      render: (row) => (
        <span className="font-mono font-bold">{row.currency || 'GHS'}</span>
      )
    },
    {
      header: 'Business Timezone',
      accessor: 'default_timezone',
      render: (row) => (
        <span className="text-secondary" style={{ fontSize: '0.84rem' }}>
          <Clock size={13} className="inline mr-1 text-muted" />
          {row.default_timezone || 'Africa/Accra'}
        </span>
      )
    },
    {
      header: 'Connected Platforms',
      accessor: 'platformCount',
      render: (row) => (
        <div className="d-flex align-items-center gap-1">
          <span className={`platform-count-pill ${row.platformCount > 0 ? 'has-platforms' : ''}`}>
            <Layers size={12} />
            {row.platformCount} {row.platformCount === 1 ? 'Platform' : 'Platforms'}
          </span>
          {row.platforms && row.platforms.length > 0 && (
            <span className="text-muted text-xs">
              ({row.platforms.map(p => p.name).join(', ')})
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Market Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status || 'ACTIVE'} />
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="action-buttons">
          <button
            type="button"
            className="btn-action"
            onClick={() => handleOpenEditModal(row)}
            title="Edit Country"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn-action text-danger"
            onClick={() => handleDeleteCountry(row)}
            title="Delete / Deactivate Country"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="countries-page fade-in">
      <PageHeader
        title="Country & Regional Market Management"
        subtitle="Configure operating countries, default currencies, business timezones, and platform regional groupings"
        breadcrumbs={['Home', 'Management', 'Countries']}
      />

      {feedback && (
        <div className={`alert alert-${feedback.type} mb-4 d-flex align-items-center justify-content-between`}>
          <div className="d-flex align-items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" className="btn-icon text-muted" onClick={() => setFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box yellow">
            <Globe size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-val">{totalCountries}</div>
            <div className="metric-lbl">Total Countries</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box green">
            <CheckCircle2 size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-val">{activeCountries}</div>
            <div className="metric-lbl">Active Regional Markets</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box blue">
            <Layers size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-val">{totalPlatformsConnected}</div>
            <div className="metric-lbl">Connected Digital Platforms</div>
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="table-controls-card">
        <div className="search-filter-group">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by country name, code (GH, NG), currency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Market Statuses</option>
            <option value="ACTIVE">Active Markets</option>
            <option value="INACTIVE">Inactive Markets</option>
          </select>
        </div>

        <button type="button" className="btn-add-country" onClick={handleOpenAddModal}>
          <Plus size={16} />
          Add New Country
        </button>
      </div>

      {/* Main Countries Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredCountries}
          loading={loading}
          emptyMessage="No countries or regional markets found matching the criteria."
        />
      </div>

      {/* Add / Edit Country Modal */}
      {modalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog country-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-box">
                <div className="icon-circle">
                  <Globe size={20} />
                </div>
                <h3>{editingCountry ? `Edit Country: ${editingCountry.name}` : 'Add New Country / Regional Market'}</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCountry} className="country-form">
              {formError && (
                <div className="alert alert-danger mb-3 d-flex align-items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="required">Country / Market Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ghana, Nigeria, Kenya"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <small className="form-hint">Official country display name.</small>
                </div>

                <div className="form-group">
                  <label className="required">Country Code (ISO 2-letter)</label>
                  <input
                    type="text"
                    className="form-control font-mono uppercase"
                    placeholder="e.g. GH, NG, KE"
                    maxLength={4}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                  />
                  <small className="form-hint">Unique 2-letter market code.</small>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="required">Default Currency</label>
                  <input
                    type="text"
                    className="form-control font-mono uppercase"
                    placeholder="e.g. GHS, NGN, KES"
                    maxLength={4}
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    required
                  />
                  <small className="form-hint">Used for revenue and ARPU metrics.</small>
                </div>

                <div className="form-group">
                  <label className="required">Business Timezone</label>
                  <select
                    className="form-control"
                    value={formData.default_timezone}
                    onChange={(e) => setFormData({ ...formData, default_timezone: e.target.value })}
                  >
                    {COMMON_TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <small className="form-hint">Standard regional settlement timezone.</small>
                </div>
              </div>

              <div className="form-group">
                <label>Operational Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE (Available for Platform Association)</option>
                  <option value="INACTIVE">INACTIVE (Hidden from Platform Wizard)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-save"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin-animation" />
                      Saving Country...
                    </>
                  ) : editingCountry ? (
                    'Update Country'
                  ) : (
                    'Add Country'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
