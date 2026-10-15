import React from 'react';
import { AlertTriangle, CloudOff, KeyRound, Timer, ServerCrash, FileWarning, Lock, Inbox, RefreshCw, CalendarX, Ban, Settings2, Info, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const StateView = ({ variant = 'default', icon: Icon = Inbox, title, text, actions, compact = false }) => (
  <div className={`state ${variant !== 'default' ? `state--${variant}` : ''} ${compact ? 'state--compact' : ''}`}>
    <div className="state__icon"><Icon size={24} /></div>
    {title && <h3 className="state__title">{title}</h3>}
    {text && <p className="state__text">{text}</p>}
    {actions && <div className="state__actions">{actions}</div>}
  </div>
);

const ERROR_PRESENTATION = {
  INTEGRATION_NOT_CONFIGURED: { icon: Settings2, title: 'API integration not activated', variant: 'warning' },
  AUTH_FAILED: { icon: KeyRound, title: 'Platform API rejected the credentials' },
  LOGIN_FAILED: { icon: KeyRound, title: 'Could not sign in to the platform API' },
  FORBIDDEN_UPSTREAM: { icon: KeyRound, title: 'Platform API refused access' },
  TIMEOUT: { icon: Timer, title: 'Platform API timed out' },
  RATE_LIMITED: { icon: Timer, title: 'Platform API is rate limiting requests', variant: 'warning' },
  LOCAL_RATE_LIMITED: { icon: Timer, title: 'Too many requests to this platform', variant: 'warning' },
  UPSTREAM_ERROR: { icon: ServerCrash, title: 'Platform API returned an error' },
  UPSTREAM_CLIENT_ERROR: { icon: ServerCrash, title: 'Platform API rejected the request' },
  NOT_FOUND_UPSTREAM: { icon: ServerCrash, title: 'Platform API endpoint not found' },
  INVALID_JSON: { icon: FileWarning, title: 'Unexpected response from the platform API' },
  UNEXPECTED_SCHEMA: { icon: FileWarning, title: 'Platform API response changed shape' },
  MISSING_REQUIRED_FIELDS: { icon: FileWarning, title: 'Required fields missing from the API response' },
  API_REPORTED_FAILURE: { icon: FileWarning, title: 'Platform API reported a failure' },
  PAGINATION_ERROR: { icon: FileWarning, title: 'Platform API pagination problem' },
  RESPONSE_TOO_LARGE: { icon: FileWarning, title: 'Platform API response too large' },
  DNS_ERROR: { icon: CloudOff, title: "Can't reach the platform API" },
  CONNECTION_ERROR: { icon: CloudOff, title: "Can't reach the platform API" },
  TLS_ERROR: { icon: CloudOff, title: 'Secure connection to the platform API failed' },
  BLOCKED_DESTINATION: { icon: Ban, title: 'API destination blocked by network policy' },
  HOST_NOT_APPROVED: { icon: Ban, title: 'API host not approved' },
  NETWORK_ERROR: { icon: CloudOff, title: 'Reporting server unreachable' },
  INVALID_DATE: { icon: CalendarX, title: 'Invalid date range', variant: 'warning' },
  MODULE_DISABLED: { icon: Ban, title: 'Report not enabled for this platform', variant: 'warning' },
  UNSUPPORTED_REPORT: { icon: Ban, title: 'Report not supported by this platform', variant: 'warning' },
  PLATFORM_ACCESS_DENIED: { icon: Lock, title: 'Access denied' },
  PLATFORM_ACCESS_EXPIRED: { icon: Lock, title: 'Your access has expired' },
  PLATFORM_ACCESS_REVOKED: { icon: Lock, title: 'Your access was revoked' },
  PLATFORM_NOT_FOUND: { icon: Ban, title: 'Platform unavailable' },
  SECRET_KEY_MISSING: { icon: KeyRound, title: 'Server encryption key not configured' }
};

/**
 * Error panel for report data. It always states that no figures are shown, so a failed
 * request can never be mistaken for a legitimately empty (zero) report.
 */
export const ErrorPanel = ({ error, onRetry, compact = false }) => {
  const navigate = useNavigate();
  const { can, activePlatform } = useAuth();
  if (!error) return null;
  const p = ERROR_PRESENTATION[error.code] || { icon: AlertTriangle, title: 'Unable to load this data' };
  const isDataError = error.fromPlatformApi || ERROR_PRESENTATION[error.code];
  const configurable = can('platforms:manage') && activePlatform && !activePlatform.isAll && ['INTEGRATION_NOT_CONFIGURED', 'AUTH_FAILED', 'LOGIN_FAILED', 'UNEXPECTED_SCHEMA', 'MISSING_REQUIRED_FIELDS', 'NOT_FOUND_UPSTREAM', 'HOST_NOT_APPROVED'].includes(error.code);
  return (
    <StateView
      variant={p.variant || 'error'}
      icon={p.icon}
      title={p.title}
      compact={compact}
      text={(
        <>
          {error.message}
          {error.detail ? <><br /><span className="text-faint">{error.detail}</span></> : null}
          {isDataError && !['INTEGRATION_NOT_CONFIGURED', 'MODULE_DISABLED', 'UNSUPPORTED_REPORT', 'INVALID_DATE'].includes(error.code) && (
            <><br /><strong>No figures are shown because the data could not be retrieved and verified.</strong></>
          )}
          {error.retryAfterSeconds ? <><br />Try again in about {error.retryAfterSeconds} seconds.</> : null}
        </>
      )}
      actions={(
        <>
          {onRetry && !['MODULE_DISABLED', 'UNSUPPORTED_REPORT', 'INVALID_DATE'].includes(error.code) && (
            <button type="button" className="btn btn--primary" onClick={onRetry}><RefreshCw size={15} /> Retry</button>
          )}
          {configurable && (
            <button type="button" className="btn btn--secondary" onClick={() => navigate(`/platforms/${activePlatform.id}`)}><Settings2 size={15} /> Open platform configuration</button>
          )}
        </>
      )}
    />
  );
};

export const Alert = ({ tone = 'info', title, children, icon }) => {
  const Icon = icon || { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info }[tone];
  return (
    <div className={`alert ${tone !== 'info' ? `alert--${tone}` : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={17} />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
};

export const KpiSkeletonGrid = ({ count = 4 }) => (
  <div className="kpi-grid" aria-busy="true" aria-label="Loading metrics">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-card"><div className="skeleton" style={{ width: '45%' }} /><div className="skeleton" /><div className="skeleton" /></div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <div className="table-wrap" aria-busy="true" aria-label="Loading table">
    <table className="table">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>{Array.from({ length: cols }).map((__, c) => <td key={c}><div className="skeleton" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} /></td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ChartSkeleton = ({ height = 260 }) => <div className="skeleton" style={{ height, borderRadius: 12 }} aria-busy="true" aria-label="Loading chart" />;
