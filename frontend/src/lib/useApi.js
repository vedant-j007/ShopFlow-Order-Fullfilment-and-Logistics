import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

// GET `path`; re-fetches when the path changes and, with `interval`, polls silently.
// Previous data is kept while refetching so the UI never flashes empty.
export function useApi(path, { interval } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++latestRequest.current;
    if (!silent) setLoading(true);
    try {
      const result = await api(path);
      if (requestId !== latestRequest.current) return;
      setData(result);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      if (requestId === latestRequest.current) setError(err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
    if (!interval) return undefined;
    const timer = setInterval(() => reload({ silent: true }), interval);
    return () => clearInterval(timer);
  }, [reload, interval]);

  return { data, error, loading, updatedAt, reload, setData };
}
