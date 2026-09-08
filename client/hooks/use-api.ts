"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic data-fetching hook with abort safety and manual refresh.
 * `immediate=false` turns it into a manual trigger hook (for POSTs).
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true,
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const execute = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setState((s) => ({ ...s, loading: false, error: message }));
      return null;
    }
  }, []);

  useEffect(() => {
    if (!immediate) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fetcherRef.current();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [...deps, immediate]);

  // topbar refresh button broadcasts this global event
  useEffect(() => {
    if (!immediate) return;
    const handler = () => void execute();
    window.addEventListener("forestguard:refresh", handler);
    return () => window.removeEventListener("forestguard:refresh", handler);
  }, [execute, immediate]);

  return { ...state, refresh: execute, run: execute };
}
