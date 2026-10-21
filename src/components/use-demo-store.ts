'use client';
import { useEffect, useState } from 'react';
import { buildDemoStore, DEMO_KEY, type Store } from '@/lib/demo';

/** Libera horários de Pix não pagos vencidos (espelha a RPC expirar_reservas). */
export function expirarReservas(store: Store, agora = new Date()): Store {
  const vencido = (a: Store['appointments'][number]) =>
    a.status === 'pendente_pagamento' && a.reserva_expira_em && new Date(a.reserva_expira_em) < agora;
  if (!store.appointments.some(vencido)) return store;
  const ids = new Set(store.appointments.filter(vencido).map((a) => a.id));
  return {
    ...store,
    appointments: store.appointments.map((a) => (ids.has(a.id) ? { ...a, status: 'cancelado' as const } : a)),
    payments: (store.payments ?? []).map((pg) =>
      pg.agendamento_id && ids.has(pg.agendamento_id) && pg.status === 'pendente' ? { ...pg, status: 'expirado' as const } : pg),
  };
}

/** Store da demonstração: nasce dos seeds e persiste no localStorage. */
export function useDemoStore() {
  const [store, setStore] = useState<Store>(() => buildDemoStore());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEMO_KEY);
      if (saved) setStore(expirarReservas({ ...buildDemoStore(), ...(JSON.parse(saved) as Store) }));
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
