import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
export const viewport: Viewport = { themeColor: '#4F46E5' };
export const metadata: Metadata = { title: 'Agendaí — Seu negócio, no seu ritmo', description: 'Organize seus serviços, sua equipe e seus horários em um só lugar.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
