import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, UserX, Users, Globe, ArrowRight, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import './Reports.scss';

export const ReportsHubPage = () => {
  const { user, activePlatform } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin;

  const reports = [
    {
      id: 'revenue',
      title: 'Revenue Report',
      desc: 'Realized gross billings, ticket values, and plan monetization breakdowns.',
      path: '/reports/revenue',
      icon: TrendingUp,
      color: 'success'
    },
    {
      id: 'churn',
      title: 'Churn Report',
      desc: 'Subscriber attrition, reasons for cancellation, and churn trend analysis.',
      path: '/churn',
      icon: UserX,
      color: 'danger'
    },
    {
      id: 'growth',
      title: 'Subscriber Growth Report',
      desc: 'Monthly cohort additions, activations, and active base expansion.',
      path: '/reports/growth',
      icon: Users,
      color: 'accent'
    }
  ];

  if (isSuperAdmin) {
    reports.push({
      id: 'comparison',
      title: 'Platform Performance Benchmark',
      desc: 'Compare subscribers, revenue, renewals, and churn across all 4 platforms.',
      path: '/reports/platform-comparison',
      icon: Globe,
      color: 'purple'
    });
  }

  return (
    <div className="reports-hub-page">
      <PageHeader
        title="Reports Hub"
        subtitle={`Centralized intelligence and downloadable reporting modules for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'Reports', 'Overview']}
        platformBadge={activePlatform?.name}
      />

      <div className="reports-catalog-grid">
        {reports.map((rep) => {
          const Icon = rep.icon;
          return (
            <Link key={rep.id} to={rep.path} className={`report-catalog-card card color-${rep.color}`}>
              <div className="report-card-top">
                <div className="rep-icon-wrap">
                  <Icon size={22} />
                </div>
                <ArrowRight size={18} className="rep-arrow" />
              </div>
              <div className="report-card-body">
                <h3 className="rep-title">{rep.title}</h3>
                <p className="rep-desc">{rep.desc}</p>
              </div>
              <div className="report-card-footer">
                <span className="view-report-text">Launch Report</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

