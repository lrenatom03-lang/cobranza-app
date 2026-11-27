'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Payload } from './state';

export function usePayload() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(async (url: string, body: unknown) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
    if (j?.derived) setData(j as Payload);
    return j;
  }, []);

  return { data, error, reload: load, mutate };
}
