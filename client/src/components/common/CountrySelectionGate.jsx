import React from 'react';
import { Globe2, ArrowRight } from 'lucide-react';
import { useAuth, ALL_COUNTRIES } from '../../context/AuthContext';
import './CountrySelectionGate.scss';

/**
 * Data is not loaded until an operating country is chosen; the choice scopes the platform
 * selector for the rest of the session.
 */
export const CountrySelectionGate = ({
  title = 'Choose an operating country',
  subtitle = 'Select a country to load its platforms, subscriber activity and revenue reports.'
}) => {
  const { availableCountries, availablePlatforms, selectCountry } = useAuth();

  const countFor = (c) => {
    if (c === ALL_COUNTRIES) return availablePlatforms.length;
    if (c === 'Unassigned') return availablePlatforms.filter(p => !p.country).length;
    return availablePlatforms.filter(p => (p.country || '').toLowerCase() === c.toLowerCase()).length;
  };

  return (
    <div className="country-gate fade-in">
      <div className="country-gate__head">
        <span className="country-gate__icon"><Globe2 size={26} /></span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {availableCountries.length === 0 ? (
        <div className="card"><div className="state"><h3 className="state__title">No platforms available</h3><p className="state__text">Your account has no active platforms yet. A Super Admin can assign access in Users &amp; Access Control.</p></div></div>
      ) : (
        <div className="country-gate__grid">
          {availableCountries.map(c => {
            const count = countFor(c);
            return (
              <button key={c} type="button" className="country-card" onClick={() => selectCountry(c)}>
                <div className="country-card__top">
                  <span className="country-card__flag"><Globe2 size={18} /></span>
                  <span className="badge badge--brand">{count} {count === 1 ? 'platform' : 'platforms'}</span>
                </div>
                <h3>{c}</h3>
                <p>{c === ALL_COUNTRIES ? 'Consolidated view across every market' : count ? 'View reports for platforms in this market' : 'No active platforms yet'}</p>
                <span className="country-card__cta">Open reports <ArrowRight size={14} /></span>
              </button>
            );
          })}
        </div>
      )}
      <p className="country-gate__foot">You can change the country or platform at any time from the top bar.</p>
    </div>
  );
};

export default CountrySelectionGate;
