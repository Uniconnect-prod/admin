import React from 'react';
import { ChevronRight } from 'lucide-react';
import './PageHeader.scss';

export const PageHeader = ({
  title,
  subtitle,
  breadcrumbs = [],
  platformBadge,
  actions
}) => {
  return (
    <div className="enterprise-page-header">
      <div className="header-left">
        {breadcrumbs.length > 0 && (
          <nav className="header-breadcrumbs">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={13} className="crumb-separator" />}
                <span className={`crumb-item ${idx === breadcrumbs.length - 1 ? 'crumb-active' : ''}`}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="title-row">
          <h1 className="header-title">{title}</h1>
          {platformBadge && (
            <span className="header-platform-tag">
              {platformBadge}
            </span>
          )}
        </div>

        {subtitle && <p className="header-subtitle">{subtitle}</p>}
      </div>

      {actions && (
        <div className="header-actions">
          {actions}
        </div>
      )}
    </div>
  );
};

