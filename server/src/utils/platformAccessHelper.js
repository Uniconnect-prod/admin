/**
 * Platform Access Date-Wise Authorization Helper
 * Evaluates access windows in real-time according to requirements:
 * - Current Date < Start Date -> UPCOMING (Access Denied)
 * - Start Date <= Current Date <= End Date -> ACTIVE (Access Granted)
 * - Current Date > End Date -> EXPIRED (Access Expired)
 * - Admin manual revocation -> REVOKED (Access Denied)
 */

export function determineAccessStatus(accessRecord, referenceDate = new Date()) {
  if (!accessRecord) {
    return {
      status: 'DENIED',
      isCurrentlyActive: false,
      reason: 'No platform access record found.'
    };
  }

  // If status in database is explicitly set to REVOKED
  if (accessRecord.status === 'REVOKED') {
    return {
      status: 'REVOKED',
      isCurrentlyActive: false,
      reason: 'Access to this platform has been revoked by an administrator.'
    };
  }

  const now = new Date(referenceDate).getTime();
  const start = new Date(accessRecord.start_date).getTime();
  const end = new Date(accessRecord.end_date).getTime();

  if (isNaN(start) || isNaN(end)) {
    return {
      status: 'INVALID_DATES',
      isCurrentlyActive: false,
      reason: 'Platform access record contains invalid date boundaries.'
    };
  }

  if (now < start) {
    return {
      status: 'UPCOMING',
      isCurrentlyActive: false,
      reason: `Platform access is scheduled to begin on ${new Date(start).toISOString().replace('T', ' ').slice(0, 16)} UTC. Access is not yet active.`
    };
  }

  if (now > end) {
    return {
      status: 'EXPIRED',
      isCurrentlyActive: false,
      reason: `Platform access expired on ${new Date(end).toISOString().replace('T', ' ').slice(0, 16)} UTC. Continued access is denied.`
    };
  }

  // Active period
  const msUntilExpiry = end - now;
  const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

  return {
    status: 'ACTIVE',
    isCurrentlyActive: true,
    isExpiringSoon,
    daysUntilExpiry,
    reason: 'Access is currently active and authorized.'
  };
}

export function formatAccessRecord(record, referenceDate = new Date()) {
  const evalResult = determineAccessStatus(record, referenceDate);
  return {
    id: record.id,
    platform_id: record.platform_id,
    platform_name: record.platform_name,
    platform_code: record.platform_code,
    role_id: record.role_id,
    role_name: record.role_name,
    start_date: record.start_date,
    end_date: record.end_date,
    configured_status: record.status || 'ACTIVE',
    computed_status: evalResult.status, // ACTIVE, UPCOMING, EXPIRED, REVOKED
    isCurrentlyActive: evalResult.isCurrentlyActive,
    isExpiringSoon: evalResult.isExpiringSoon || false,
    daysUntilExpiry: evalResult.daysUntilExpiry ?? null,
    reason: evalResult.reason
  };
}
