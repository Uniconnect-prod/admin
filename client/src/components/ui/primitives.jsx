import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Calculator, CircleSlash } from 'lucide-react';
import './ui.scss';

export const PageHeader = ({ eyebrow, title, description, actions, children }) => (
  <header className="page-header fade-in">
    <div className="page-header__text">
      {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
      <h1 className="page-header__title">{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
      {children}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>
);

export const Card = ({ title, subtitle, icon: Icon, actions, children, footer, flush = false, className = '', ...rest }) => (
  <section className={`card ${flush ? 'card--flush' : ''} ${className}`} {...rest}>
    {(title || actions) && (
      <div className="card__header">
        <div className="grow">
          {title && <h2 className="card__title">{Icon && <Icon size={17} className="card__title-icon" />}{title}</h2>}
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    )}
    <div className="card__body">{children}</div>
    {footer && <div className="card__footer">{footer}</div>}
  </section>
);

export const Field = ({ label, hint, error, required, htmlFor, children, className = '' }) => (
  <div className={`field ${error ? 'has-error' : ''} ${className}`}>
    {label && (
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
  </div>
);

const STATUS_STYLES = {
  ACTIVE: 'success', PASSED: 'success', OK: 'success', SUCCESS: 'success', true: 'success',
  DRAFT: 'neutral', NOT_RUN: 'neutral', SKIPPED: 'neutral', INFO: 'brand',
  WARNING: 'warning', UPCOMING: 'warning', NEEDS_VALIDATION: 'warning', EXPIRING: 'warning',
  FAILED: 'danger', ERROR: 'danger', DISABLED: 'danger', EXPIRED: 'danger', REVOKED: 'danger', INACTIVE: 'danger', false: 'danger'
};

export const StatusBadge = ({ status, label, dot = true }) => {
  const tone = STATUS_STYLES[String(status).toUpperCase()] || STATUS_STYLES[status] || 'neutral';
  const text = label || String(status).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  return (
    <span className={`badge ${tone === 'neutral' ? '' : `badge--${tone}`}`}>
      {dot && <span className="dot" />}
      {text}
    </span>
  );
};

const PROVENANCE = {
  api: { label: 'API', icon: Database, title: 'Supplied directly by the platform API' },
  calculated: { label: 'Calculated', icon: Calculator, title: 'Calculated by the reporting server from API-supplied values' },
  unavailable: { label: 'Unavailable', icon: CircleSlash, title: "Not provided by this platform's API mapping" }
};

export const ProvenanceBadge = ({ provenance, note }) => {
  const p = PROVENANCE[provenance] || PROVENANCE.unavailable;
  const Icon = p.icon;
  return (
    <span className={`provenance provenance--${provenance}`} title={note || p.title}>
      <Icon size={11} /> {p.label}
    </span>
  );
};

export const Tabs = ({ tabs, active, onChange, asLinks = false }) => (
  <nav className="tabs" role="tablist">
    {tabs.map(t => (asLinks ? (
      <Link key={t.id} to={t.to} className={active === t.id ? 'is-active' : ''} role="tab" aria-selected={active === t.id}>
        {t.icon && <t.icon size={15} />}{t.label}
      </Link>
    ) : (
      <button key={t.id} type="button" className={active === t.id ? 'is-active' : ''} onClick={() => onChange(t.id)} role="tab" aria-selected={active === t.id} disabled={t.disabled}>
        {t.icon && <t.icon size={15} />}{t.label}
        {t.badge !== undefined && <span className="badge">{t.badge}</span>}
      </button>
    )))}
  </nav>
);

export const PlatformAvatar = ({ platform, size = 32 }) => {
  if (platform?.isAll || platform?.code === 'ALL') {
    return <span className="platform-avatar platform-avatar--all" style={{ width: size, height: size, fontSize: size * 0.36 }}>ALL</span>;
  }
  if (platform?.logo_url) {
    return <img className="platform-avatar platform-avatar--img" src={platform.logo_url} alt="" style={{ width: size, height: size }} onError={e => { e.currentTarget.style.display = 'none'; }} />;
  }
  const initials = String(platform?.name || platform?.code || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return (
    <span className="platform-avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: platform?.accent_color || '#0170B9' }} aria-hidden="true">
      {initials}
    </span>
  );
};
