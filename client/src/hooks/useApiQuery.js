import { useCallback, useEffect, useRef, useState } from 'react';
import api, { describeError, isCancel } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * GET with automatic cancellation: a new request (changed platform/params) or unmount
 * aborts the previous one, so rapid filter changes never render stale data.
 *
 * The active platform is part of the request key and is sent explicitly, so switching
 * platforms always refetches and never shows one platform's numbers under another.
 *
 *   const { data, error, loading, refreshing, refetch } = useApiQuery(path, { params, enabled })
 */
export function useApiQuery(path, { params = null, enabled = true, platformScoped = true } = {}) {
  const { activePlatform } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(enabled && path), refreshing: false });
  const controllerRef = useRef(null);
  const platformCode = platformScoped ? activePlatform?.code || null : null;
  const platformCountry = platformScoped && activePlatform?.isAll ? activePlatform?.country || null : null;
  const key = JSON.stringify([path, params, platformCode, platformCountry]);

  const run = useCallback(async ({ fresh = false } = {}) => {
    if (!enabled || !path || (platformScoped && !platformCode)) {
      setState({ data: null, error: null, loading: false, refreshing: false });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    // New key → clear old data; explicit refresh → keep current data visible.
    setState(prev => (fresh ? { ...prev, refreshing: true, error: null } : { data: null, error: null, loading: true, refreshing: false }));
    try {
      const headers = {};
      if (platformCode) headers['x-platform-code'] = platformCode;
      if (platformCountry) headers['x-country'] = platformCountry;
      const res = await api.get(path, {
        params: fresh ? { ...(params || {}), fresh: 1 } : params || undefined,
        headers,
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      setState({ data: res.data.data, error: null, loading: false, refreshing: false });
    } catch (err) {
      if (isCancel(err) || controller.signal.aborted) return;
      setState(prev => ({ data: fresh ? prev.data : null, error: describeError(err), loading: false, refreshing: false }));
    }
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
    return () => controllerRef.current?.abort();
  }, [run]);

  return { ...state, refetch: () => run({ fresh: true }), reload: () => run() };
}
