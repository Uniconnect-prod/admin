import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, UserPlus, UserMinus, Printer } from 'lucide-react';
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
import './Reports.scss';

export const GrowthReportPage = () => {
  const { activePlatform } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGrowth = async () => {
      try {
        setLoading(true);
        const res = await api.get('/reports/growth');
        if (res.data?.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load growth report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGrowth();
  }, [activePlatform?.code]);

  const cohorts = data?.monthlyCohort || [];

  return (
    <div className="reports-page-wrapper">
      <PageHeader
        title="Subscriber Growth Report"
        subtitle={`Cohort activations, active expansions, and monthly retention for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'Reports', 'Subscriber Growth']}
        platformBadge={activePlatform?.name}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} />
            Print Report
          </button>
        }
      />

      <div className="reports-chart-grid single-col">
        <ChartCard
          title="Monthly Subscriber Cohort Additions"
          subtitle="Monthly net activations vs retention status"
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohorts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="active" name="Active Subscribers" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="churned" name="Churned Subscribers" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card report-table-card">
        <div className="card-header">
          <h3 className="card-title">Monthly Cohort Retention Summary</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cohort Month</th>
                <th>Total Provisioned</th>
                <th>Currently Active</th>
                <th>Churned / Cancelled</th>
                <th>Retention Rate</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((row, i) => {
                const total = row.net_additions || 1;
                const active = row.active || 0;
                const retRate = ((active / total) * 100).toFixed(1);
                return (
                  <tr key={i}>
                    <td><strong>{row.month}</strong></td>
                    <td>{row.net_additions}</td>
                    <td><span className="text-success font-bold">{row.active}</span></td>
                    <td><span className="text-danger font-bold">{row.churned}</span></td>
                    <td><span className="rate-pill">{retRate}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

