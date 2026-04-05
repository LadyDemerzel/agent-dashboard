"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePollingOptions<T> {
  intervalMs?: number;
  enabled?: boolean;
  onData?: (data: T) => void;
}

export function usePolling<T>(
  url: string | null,
  options: UsePollingOptions<T> | number = {}
) {
  const normalizedOptions = typeof options === "number" ? { intervalMs: options } : options;
  const { intervalMs = 5000, enabled = true, onData } = normalizedOptions;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onDataRef = useRef(onData);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const fetchData = useCallback(async () => {
    if (!url) return null;

    const hasData = data !== null;
    if (hasData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
      onDataRef.current?.(json);
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data, url]);

  useEffect(() => {
    if (!url || !enabled) return;

    void fetchData();
    const id = setInterval(() => {
      void fetchData();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, fetchData, intervalMs, url]);

  return {
    data,
    error,
    loading,
    refreshing,
    refetch: fetchData,
  };
}
