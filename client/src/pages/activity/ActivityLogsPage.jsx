import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Search, Filter, ShieldCheck, Clock, User, Globe } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import './ActivityLogsPage.scss';

export const ActivityLogsPage = () => {
  const { activePlatform } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 15
  });

  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs', {
        params: {
          page: pagination.currentPage,
          limit: pagination.limit,
          action: actionFilter,
          entity: entityFilter
        }
      });
      if (res.data?.success) {
        setLogs(res.data.data.records);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, actionFilter, entityFilter, activePlatform?.code]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      header: 'Timestamp',
      key: 'timestamp',
      render: (row) => (
        <span className="log-time-cell">
          {new Date(row.timestamp).toLocaleDateString()} {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )
    },
    {
      header: 'User Operator',
      key: 'user',
      render: (row) => (
        <div className="log-user-cell">
          <strong>{row.user}</strong>
          {row.userEmail && <span className="text-light text-xs">{row.userEmail}</span>}
        </div>
      )
    },
    {
      header: 'Platform Scope',
      key: 'platform',
      render: (row) => <span className="platform-tag">{row.platform}</span>
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => <span className="action-pill">{row.action}</span>
    },
    {
      header: 'Entity',
      key: 'entity',
      render: (row) => <span className="entity-tag">{row.entity}</span>
    },
    {
      header: 'Execution Details',
      key: 'details',
      render: (row) => <span className="details-text">{row.details}</span>
    },
    {
      header: 'IP Address',
      key: 'ip',
      render: (row) => <span className="font-mono text-muted">{row.ip || '127.0.0.1'}</span>
    }
  ];

  return (
    <div className="activity-logs-page">
      <PageHeader
        title="Enterprise Activity & Audit Trail"
        subtitle={`System event logging, authentication events, data modifications, and security actions for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'System', 'Activity Logs']}
        platformBadge={activePlatform?.name}
      />

      {/* Filter Row */}
      <div className="card log-filters-card">
        <div className="log-filter-row">
          <div className="filter-item">
            <select
              className="form-control"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
            >
              <option value="ALL">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="USER_LOGOUT">USER_LOGOUT</option>
              <option value="EXPORT_SUBSCRIBERS_CSV">EXPORT_SUBSCRIBERS_CSV</option>
              <option value="EXPORT_RENEWALS_CSV">EXPORT_RENEWALS_CSV</option>
              <option value="EXPORT_CHURN_CSV">EXPORT_CHURN_CSV</option>
              <option value="CREATE_USER">CREATE_USER</option>
              <option value="CREATE_QUIZ">CREATE_QUIZ</option>
              <option value="UPDATE_PLATFORM">UPDATE_PLATFORM</option>
            </select>
          </div>

          <div className="filter-item">
            <select
              className="form-control"
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
            >
              <option value="ALL">All Entities</option>
              <option value="Auth">Auth</option>
              <option value="Subscriber">Subscriber</option>
              <option value="Renewal">Renewal</option>
              <option value="Churn">Churn</option>
              <option value="Quiz">Quiz</option>
              <option value="User">User</option>
              <option value="Platform">Platform</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => setPagination(prev => ({ ...prev, currentPage: p }))}
        onLimitChange={(l) => setPagination(prev => ({ ...prev, limit: l, currentPage: 1 }))}
        emptyMessage="No audit log records recorded yet."
      />
    </div>
  );
};

