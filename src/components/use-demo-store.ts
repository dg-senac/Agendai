'use client';
import { useEffect, useState } from 'react';
import { buildDemoStore, DEMO_KEY, type Store } from '@/lib/demo';

/** Store da demonstração: nasce dos seeds e persiste no localStorage. */
export function useDemoStore() {
  const [store, setStore] = useState<Store>(() => buildDemoStore());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEMO_KEY);
      if (saved) setStore({ ...buildDemoStore(), ...(JSON.parse(saved) as Store) });
    } catch {
      localStorage.removeItem(DEMO_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(DEMO_KEY, JSON.stringify(store));
  }, [store, ready]);

  return { store, setStore, ready };
}
