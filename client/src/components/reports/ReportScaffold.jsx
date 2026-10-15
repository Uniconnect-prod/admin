import React from 'react';
import { Layers, Settings2, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CountrySelectionGate } from '../common/CountrySelectionGate';
import { StateView } from '../ui/feedback';
import { PlatformAvatar } from '../ui/primitives';

const MODULE_LABELS = {
  settlement: 'Daily Settlement Report',
  revenue: 'Revenue Analytics',
  subscribers: 'Subscriber Analytics',
  renewals: 'Renewals & Billing',
  churn: 'Deactivations & Churn',
  subscriber_records: 'Subscriber list'
};

/**
 * Shared preconditions for every report page:
 *  country chosen → (specific platform when required) → module enabled → integration activated.
 */
export const ReportScaffold = ({ module, allowAll = false, children }) => {
  const { selectedCountry, activePlatform, platformsForSelectedCountry, switchPlatform, can } = useAuth();
  const navigate = useNavigate();

  if (!selectedCountry) return <CountrySelectionGate />;

  if (!activePlatform) {
    return <div className="card"><StateView icon={Layers} title="No platform available" text="There are no active platforms you can access in this country." /></div>;
  }

  if (activePlatform.isAll && !allowAll) {
    return (
      <div className="card fade-in">
        <StateView
          icon={Layers}
          title="Choose a platform for this report"
          text={`${MODULE_LABELS[module] || 'This report'} is produced per platform from that platform's API. Pick one to continue.`}
          actions={platformsForSelectedCountry.slice(0, 8).map(p => (
            <button key={p.code} type="button" className="btn btn--secondary" onClick={() => switchPlatform(p)}>
              <PlatformAvatar platform={p} size={20} /> {p.name}
            </button>
          ))}
        />
      </div>
    );
  }

  if (!activePlatform.isAll && module && !(activePlatform.enabled_modules || []).includes(module)) {
    return (
      <div className="card fade-in">
        <StateView variant="warning" icon={Ban} title={`${MODULE_LABELS[module]} is not enabled for ${activePlatform.name}`} text="A Super Admin can enable this module once the platform's API mapping provides the required data." />
      </div>
    );
  }

  if (!activePlatform.isAll && !activePlatform.integration_ready) {
    return (
      <div className="card fade-in">
        <StateView
          variant="warning"
          icon={Settings2}
          title={`${activePlatform.name}'s API integration is not active yet`}
          text="Reports appear once a Super Admin has configured, validated and activated this platform's API integration. No figures are shown until then."
          actions={can('platforms:manage') ? <button type="button" className="btn btn--primary" onClick={() => navigate(`/platforms/${activePlatform.id}`)}>Configure integration</button> : null}
        />
      </div>
    );
  }

  return children;
};

export default ReportScaffold;
