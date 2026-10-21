'use client';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { RegistrarServiceWorker } from '@/components/registrar-sw';
export function Providers({ children }: { children: React.ReactNode }) { const [client] = useState(() => new QueryClient()); return <ThemeProvider attribute="class" defaultTheme="light" enableSystem><QueryClientProvider client={client}>{children}<RegistrarServiceWorker /><Toaster richColors position="bottom-right" /></QueryClientProvider></ThemeProvider>; }
