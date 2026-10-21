import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = { title: 'Agendaí — Seu negócio, no seu ritmo', description: 'Organize seus serviços, sua equipe e seus horários em um só lugar.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
