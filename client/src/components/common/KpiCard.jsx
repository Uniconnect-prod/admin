import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './KpiCard.scss';

export const KpiCard = ({
  title,
  value,
  change,
  trend = 'up',
  comparison = 'vs previous period',
  icon: Icon,
  color = 'primary',
  onClick
}) => {
  const isUp = trend === 'up';
  const isDown = trend === 'down';

  return (
    <div
      className={`kpi-card color-${color} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
      title={onClick ? `Click to view details for ${title}` : undefined}
    >
      <div className="kpi-top">
        <span className="kpi-title">{title}</span>
        {Icon && (
          <div className="kpi-icon-wrapper">
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="kpi-value-row">
        <h3 className="kpi-value">{value}</h3>
      </div>

      <div className="kpi-bottom">
        {change && (
          <span className={`kpi-change ${isUp ? 'change-up' : isDown ? 'change-down' : 'change-neutral'}`}>
            {isUp ? <TrendingUp size={13} /> : isDown ? <TrendingDown size={13} /> : <Minus size={13} />}
            {change}
          </span>
        )}
        <span className="kpi-comparison">{comparison}</span>
      </div>
    </div>
  );
};

