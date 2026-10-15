import React from 'react';
import { UserPlus, Users, UserCheck, RefreshCcw, XCircle, Wallet, Percent, UserMinus, CalendarRange, Activity, Info } from 'lucide-react';
import { KpiCard } from '../ui/data';
import { StateView } from '../ui/feedback';

export const KPI_ICONS = {
  new_subscribers: UserPlus,
  subscriber_count: Users,
  active_subscribers: UserCheck,
  renewal_count: RefreshCcw,
  failed_renewal_count: XCircle,
  grand_total: Wallet,
  daily_revenue: Wallet,
  ondemand_revenue: Wallet,
  renewal_rate: Percent,
  deactivations: UserMinus,
  activation_parking: CalendarRange,
  net_additions: UserPlus,
  transaction_count: Activity,
  successful_charges: Activity,
  failed_charges: XCircle
};
export const KPI_ACCENTS = ['brand', 'sky', 'green', 'navy', 'amber'];

export const KpiSection = ({ kpis, currency }) => {
  const available = kpis.filter(k => k.provenance !== 'unavailable');
  const missing = kpis.filter(k => k.provenance === 'unavailable');
  return (
    <div className="stack">
      {available.length > 0 ? (
        <div className="kpi-grid">
          {available.map((k, i) => <KpiCard key={k.key} metric={k} currency={currency} icon={KPI_ICONS[k.key]} accent={KPI_ACCENTS[i % KPI_ACCENTS.length]} />)}
        </div>
      ) : (
        <div className="card"><StateView compact icon={Info} title="No KPIs available" text="The platform's API mapping does not provide any of the metrics for this view." /></div>
      )}
      {missing.length > 0 && (
        <div className="unavailable-note">
          <Info size={14} />
          <span><strong>Not available from this platform&apos;s API:</strong> {missing.map(m => m.label).join(', ')}.</span>
        </div>
      )}
    </div>
  );
};

