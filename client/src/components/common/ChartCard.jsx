import React from 'react';
import './ChartCard.scss';

export const ChartCard = ({ title, subtitle, actions, children, height = 300 }) => {
  return (
    <div className="chart-card card">
      <div className="card-header">
        <div className="header-info">
          <h4 className="card-title">{title}</h4>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="chart-actions">{actions}</div>}
      </div>

      <div className="chart-content" style={{ height }}>
        {children}
      </div>
    </div>
  );
};

