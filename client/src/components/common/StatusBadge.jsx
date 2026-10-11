import React from 'react';

export const StatusBadge = ({ status }) => {
  const norm = (status || '').toLowerCase();

  let badgeClass = 'badge-neutral';
  if (['renewed', 'renewal', 'successful', 'active', 'published', 'success'].includes(norm)) {
    badgeClass = 'badge-success';
  } else if (['failed', 'cancelled', 'churned', 'disabled', 'danger', 'revoked'].includes(norm)) {
    badgeClass = 'badge-danger';
  } else if (['pending', 'grace', 'draft', 'warning', 'expired', 'expiring_soon'].includes(norm)) {
    badgeClass = 'badge-warning';
  } else if (['new', 'info', 'upcoming'].includes(norm)) {
    badgeClass = 'badge-info';
  } else if (['suspended', 'archived', 'vip'].includes(norm)) {
    badgeClass = 'badge-purple';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="dot" />
      {status || 'Unknown'}
    </span>
  );
};

