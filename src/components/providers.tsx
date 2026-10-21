'use client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { RegistrarServiceWorker } from '@/components/registrar-sw';

/** Providers globais enxutos: tema + toast + service worker.
 *  O React Query vive só nas rotas que o usam (painel) — ver query-provider. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
      <RegistrarServiceWorker />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  );
}
