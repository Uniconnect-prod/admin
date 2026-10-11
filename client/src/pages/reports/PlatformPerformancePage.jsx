import React, { useState, useEffect } from 'react';
import { Globe, TrendingUp, Users, RefreshCw, AlertTriangle, Download, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { ChartCard } from '../../components/common/ChartCard';
import './PlatformPerformancePage.scss';

export const PlatformPerformancePage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        const res = await api.get('/reports/platform-comparison');
        if (res.data?.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load platform comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, []);

  const comparison = data?.comparison || [];
  const charts = data?.charts || {};

  return (
    <div className="platform-performance-page">
      <PageHeader
        title="Platform Performance Comparison"
        subtitle="Cross-tenant benchmark analytics for all digital services (Super Admin exclusive)"
        breadcrumbs={['Home', 'Reports', 'Platform Performance']}
        platformBadge="Super Admin Consolidated"
      />

      {/* Comparison Cards for 4 Platforms */}
      <div className="platform-comparison-grid">
        {comparison.map((p) => (
          <div key={p.platformId} className="platform-comp-card card">
            <div className="comp-card-header">
              <div className="platform-brand-col">
                <span className="comp-platform-name">{p.name}</span>
                <span className="comp-platform-code">{p.code}</span>
              </div>
              <span className="rate-badge">
                {p.renewalRate} Renewal Rate
              </span>
            </div>

            <div className="comp-metrics-list">
              <div className="metric-row">
                <span className="m-label">Total Subscribers</span>
                <span className="m-val">{p.subscribers.toLocaleString()}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Active Base</span>
                <span className="m-val text-success">{p.activeSubscribers.toLocaleString()}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Gross Revenue</span>
                <span className="m-val font-bold">GHC {Number(p.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Successful Renewals</span>
                <span className="m-val">{p.renewals.toLocaleString()}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Failed Renewals</span>
                <span className="m-val text-danger">{p.failedRenewals.toLocaleString()}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Churn Count</span>
                <span className="m-val text-danger">{p.churn.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Charts */}
      <div className="comp-charts-row grid-2">
        <ChartCard
          title="Revenue Comparison Across Platforms"
          subtitle="Total gross billing volume (GHC)"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.revenueComparison || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `GHC ${v}`} />
              <Tooltip formatter={(v) => [`GHC ${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#1860ec" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Subscriber Base Comparison"
          subtitle="Provisioned subscriber volume by service"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.subscriberComparison || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Bar dataKey="subscribers" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="comp-charts-row grid-2">
        <ChartCard
          title="Renewal Rate Efficiency"
          subtitle="Percentage of successful renewal charges"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.renewalRateComparison || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Renewal Rate']} />
              <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Churn Volume Comparison"
          subtitle="Absolute terminations by platform"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.churnComparison || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Bar dataKey="churn" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Comparison Master Table */}
      <div className="card comp-table-card">
        <div className="card-header">
          <h3 className="card-title">Consolidated Platform Performance Metrics</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Subscribers</th>
                <th>Active Base</th>
                <th>Renewals</th>
                <th>Failed Renewals</th>
                <th>Gross Revenue (GHC)</th>
                <th>Churn</th>
                <th>Renewal Rate</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.platformId}>
                  <td>
                    <strong>{row.name}</strong>
                    <span className="table-code-sub"> ({row.code})</span>
                  </td>
                  <td>{row.subscribers.toLocaleString()}</td>
                  <td><span className="text-success font-bold">{row.activeSubscribers.toLocaleString()}</span></td>
                  <td>{row.renewals.toLocaleString()}</td>
                  <td><span className="text-danger">{row.failedRenewals.toLocaleString()}</span></td>
                  <td><strong>GHC {Number(row.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                  <td><span className="text-danger">{row.churn.toLocaleString()}</span></td>
                  <td>
                    <span className="rate-table-pill">{row.renewalRate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

