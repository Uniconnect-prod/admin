/**
 * Integration failure taxonomy. Every failure talking to a platform API is mapped to
 * one of these codes so the dashboard can show a specific, user-friendly message and
 * never mistake a failure for an empty report.
 */
export const INTEGRATION_ERRORS = {
  INTEGRATION_NOT_CONFIGURED: { http: 409, message: 'This platform has no published API integration yet. A Super Admin must configure, validate and activate it.' },
  INVALID_CONFIGURATION: { http: 422, message: 'The platform API configuration is invalid.' },
  SECRET_KEY_MISSING: { http: 500, message: 'Server is missing INTEGRATION_SECRET_KEY, so stored API credentials cannot be used.' },
  BLOCKED_DESTINATION: { http: 422, message: 'The API destination is not permitted by the outbound network policy.' },
  HOST_NOT_APPROVED: { http: 422, message: 'The API host has not been approved by a Super Admin.' },
  INVALID_URL: { http: 422, message: 'The API URL is not valid.' },
  DNS_ERROR: { http: 502, message: 'The platform API host could not be resolved.' },
  CONNECTION_ERROR: { http: 502, message: 'Could not connect to the platform API.' },
  TLS_ERROR: { http: 502, message: 'A secure (TLS) connection to the platform API could not be established.' },
  TIMEOUT: { http: 504, message: 'The platform API did not respond in time.' },
  AUTH_FAILED: { http: 502, message: 'The platform API rejected the configured credentials.' },
  FORBIDDEN_UPSTREAM: { http: 502, message: 'The platform API refused access to this report (HTTP 403).' },
  LOGIN_FAILED: { http: 502, message: 'Signing in to the platform API failed.' },
  RATE_LIMITED: { http: 429, message: 'The platform API is rate limiting requests. Try again shortly.' },
  LOCAL_RATE_LIMITED: { http: 429, message: 'Too many requests to this platform API from the reporting server. Try again shortly.' },
  UPSTREAM_ERROR: { http: 502, message: 'The platform API returned a server error.' },
  UPSTREAM_CLIENT_ERROR: { http: 502, message: 'The platform API rejected the request.' },
  NOT_FOUND_UPSTREAM: { http: 502, message: 'The configured API endpoint was not found (HTTP 404).' },
  INVALID_JSON: { http: 502, message: 'The platform API returned a response that is not valid JSON.' },
  API_REPORTED_FAILURE: { http: 502, message: 'The platform API reported that the request failed.' },
  UNEXPECTED_SCHEMA: { http: 502, message: 'The platform API response does not match the configured structure.' },
  MISSING_REQUIRED_FIELDS: { http: 502, message: 'Required fields are missing from the platform API response.' },
  INVALID_DATE: { http: 400, message: 'The requested date range is invalid.' },
  PAGINATION_ERROR: { http: 502, message: 'The platform API pagination did not behave as configured.' },
  RESPONSE_TOO_LARGE: { http: 502, message: 'The platform API response exceeded the configured size limit.' },
  TOO_MANY_REDIRECTS: { http: 502, message: 'The platform API redirected too many times.' },
  UNSUPPORTED_REPORT: { http: 422, message: 'This report is not supported by the platform API configuration.' },
  EXPORT_LIMIT_EXCEEDED: { http: 413, message: 'The export exceeds the maximum number of rows allowed.' }
};

export class IntegrationError extends Error {
  constructor(code, detail = null, extra = {}) {
    const def = INTEGRATION_ERRORS[code] || { http: 502, message: 'The platform API request failed.' };
    super(detail ? `${def.message} ${detail}` : def.message);
    this.name = 'IntegrationError';
    this.code = INTEGRATION_ERRORS[code] ? code : 'UPSTREAM_ERROR';
    this.httpStatus = def.http;
    this.userMessage = def.message;
    this.detail = detail;
    Object.assign(this, extra);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      detail: this.detail,
      upstreamStatus: this.upstreamStatus ?? null,
      retryAfterSeconds: this.retryAfterSeconds ?? null
    };
  }
}

export function classifyHttpStatus(status) {
  if (status === 401) return 'AUTH_FAILED';
  if (status === 403) return 'FORBIDDEN_UPSTREAM';
  if (status === 404) return 'NOT_FOUND_UPSTREAM';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'UPSTREAM_ERROR';
  if (status >= 400) return 'UPSTREAM_CLIENT_ERROR';
  return null;
}
