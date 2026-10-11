import React, { useState, useEffect } from 'react';
import { Search, Filter, RotateCcw, Download, RefreshCw } from 'lucide-react';
import './FilterBar.scss';

export const FilterBar = ({
  filters,
  onFilterChange,
  onApply,
  onReset,
  onExport,
  onRefresh,
  loading = false,
  offerCodes = [],
  statuses = ['Active', 'Inactive', 'Renewal', 'Suspended', 'Deactivated'],
  lifecycles = ['NEW', 'ACTIVE', 'GRACE', 'CHURNED', 'SUSPENDED'],
  showExport = true,
  showRefresh = true
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key, value) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    if (onFilterChange) {
      onFilterChange(updated);
    }
  };

  const handleApply = (e) => {
    e.preventDefault();
    if (onApply) onApply(localFilters);
  };

  const handleReset = () => {
    const resetState = {
      from: '',
      to: '',
      status: 'ALL',
      offer_code: 'ALL',
      lifecycle: 'ALL',
      search: ''
    };
    setLocalFilters(resetState);
    if (onReset) onReset(resetState);
  };

  return (
    <div className="enterprise-filter-bar card">
      <form onSubmit={handleApply} className="filter-form">
        <div className="filter-row">
          {/* From Date */}
          <div className="filter-field">
            <label>From</label>
            <input
              type="date"
              className="form-control"
              value={localFilters.from || ''}
              onChange={(e) => handleChange('from', e.target.value)}
            />
          </div>

          {/* To Date */}
          <div className="filter-field">
            <label>To</label>
            <input
              type="date"
              className="form-control"
              value={localFilters.to || ''}
              onChange={(e) => handleChange('to', e.target.value)}
            />
          </div>

          {/* Status Dropdown */}
          <div className="filter-field">
            <label>Status</label>
            <select
              className="form-control"
              value={localFilters.status || 'ALL'}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {statuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Offer Code Dropdown */}
          <div className="filter-field">
            <label>Offer Code</label>
            <select
              className="form-control"
              value={localFilters.offer_code || 'ALL'}
              onChange={(e) => handleChange('offer_code', e.target.value)}
            >
              <option value="ALL">All Offers</option>
              {offerCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Lifecycle Dropdown */}
          <div className="filter-field">
            <label>Lifecycle</label>
            <select
              className="form-control"
              value={localFilters.lifecycle || 'ALL'}
              onChange={(e) => handleChange('lifecycle', e.target.value)}
            >
              <option value="ALL">All Lifecycles</option>
              {lifecycles.map(lc => (
                <option key={lc} value={lc}>{lc}</option>
              ))}
            </select>
          </div>

          {/* Search Field */}
          <div className="filter-field search-field">
            <label>Search</label>
            <div className="search-input-wrapper">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search MSISDN, Offer..."
                className="form-control search-control"
                value={localFilters.search || ''}
                onChange={(e) => handleChange('search', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-actions-row">
          <div className="action-buttons-left">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Filter size={14} />
              Apply Filter
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className="action-buttons-right">
            {showRefresh && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh Table Data"
              >
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                Refresh
              </button>
            )}
            {showExport && (
              <button
                type="button"
                className="btn btn-secondary export-btn"
                onClick={onExport}
                title="Export Filtered CSV"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

