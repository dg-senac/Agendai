import { AuthShell, AuthForm } from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
export const metadata = { title: 'Criar conta grátis — Agendaí' };
export default function Page() { return <AuthShell><AuthForm modo="cadastro" live={configured()} /></AuthShell>; }
