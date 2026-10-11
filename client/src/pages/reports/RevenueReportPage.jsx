import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, CreditCard, PieChart as PieIcon, Download, Printer } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

export const RevenueReportPage = () => {
  const { activePlatform } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        setLoading(true);
        const res = await api.get('/reports/revenue');
        if (res.data?.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load revenue report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRevenue();
  }, [activePlatform?.code]);

  const dailyRevenue = data?.dailyRevenue || [];
  const revenueByOffer = data?.revenueByOffer || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-page-wrapper">
      <PageHeader
        title="Revenue & Monetization Report"
        subtitle={`Gross billings, average ticket value, and product revenue contributions for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'Reports', 'Revenue']}
        platformBadge={activePlatform?.name}
        actions={
          <div className="report-action-buttons">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={14} />
              Print Report
            </button>
          </div>
        }
      />

      <div className="reports-chart-grid">
        <ChartCard
          title="Daily Gross Billing Volume (GHC)"
          subtitle="Processed successful transactions trend"
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `GHC ${v}`} />
              <Tooltip formatter={(v) => [`GHC ${Number(v).toFixed(2)}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" name="Daily Revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Revenue by Subscription Plan"
          subtitle="Total income contribution by offer code"
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByOffer}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="offer_code" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `GHC ${v}`} />
              <Tooltip formatter={(v) => [`GHC ${Number(v).toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="total_revenue" name="Total Revenue (GHC)" fill="#1860ec" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Revenue by Offer Table */}
      <div className="card report-table-card">
        <div className="card-header">
          <h3 className="card-title">Offer Revenue Contribution Breakdown</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Offer Code</th>
                <th>Total Paid Transactions</th>
                <th>Average Ticket Size (GHC)</th>
                <th>Total Realized Revenue (GHC)</th>
              </tr>
            </thead>
            <tbody>
              {revenueByOffer.map((row, i) => (
                <tr key={i}>
                  <td><strong>{row.offer_code}</strong></td>
                  <td>{row.transactions.toLocaleString()}</td>
                  <td>GHC {Number(row.average_ticket).toFixed(2)}</td>
                  <td><strong className="text-success">GHC {Number(row.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

