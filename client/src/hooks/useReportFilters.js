import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' }
];

const STORAGE_KEY = 'reportFilters';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function remembered() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Report date filters live in the URL (?range=30d or ?range=custom&from=…&to=…) so they
 * survive refresh, deep links and browser back/forward, and are carried between report
 * pages. The last choice is remembered for the session as the default.
 */
export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const urlRange = searchParams.get('range');
    const base = urlRange ? { range: urlRange, from: searchParams.get('from'), to: searchParams.get('to') } : (remembered() || { range: '30d' });
    if (base.range === 'custom' && !(DAY.test(base.from || '') && DAY.test(base.to || ''))) return { range: '30d', from: null, to: null };
    if (!RANGE_OPTIONS.some(o => o.value === base.range)) return { range: '30d', from: null, to: null };
    return { range: base.range, from: base.range === 'custom' ? base.from : null, to: base.range === 'custom' ? base.to : null };
  }, [searchParams]);

  const setFilters = useCallback((next) => {
    const value = { ...filters, ...next };
    const params = new URLSearchParams(searchParams);
    params.set('range', value.range);
    if (value.range === 'custom' && value.from && value.to) {
      params.set('from', value.from);
      params.set('to', value.to);
    } else {
      params.delete('from');
      params.delete('to');
    }
    params.delete('page');
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setSearchParams(params);
  }, [filters, searchParams, setSearchParams]);

  const queryParams = useMemo(() => (
    filters.range === 'custom' ? { range: 'custom', from: filters.from, to: filters.to } : { range: filters.range }
  ), [filters]);

  const queryString = useMemo(() => new URLSearchParams(Object.entries(queryParams).filter(([, v]) => v)).toString(), [queryParams]);

  return { filters, setFilters, queryParams, queryString };
}
