import { AuthShell, AuthForm } from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
export const metadata = { title: 'Entrar — Agendaí' };
export default function Page() { return <AuthShell><AuthForm modo="entrar" live={configured()} /></AuthShell>; }
