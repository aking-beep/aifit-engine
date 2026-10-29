"use client";

import { useCallback, useEffect, useState } from "react";

/** Loads once on mount; `reload` refetches. Errors are surfaced, never replaced by sample data. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const value = await fn();
      setData(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let cancelled = false;
    fn()
      .then((value) => !cancelled && setData(value))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load this."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error, loading, reload, setData };
}
