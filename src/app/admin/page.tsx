import { redirect } from 'next/navigation';
import { configured, supabase as criarSupabase } from '@/lib/supabase/server';
import { AdminPanel } from '@/components/admin-panel';

export const metadata = { title: 'Administração — Agendaí' };

export default async function Page() {
  if (!configured()) {
    return (
      <main style={{ maxWidth: 640, margin: 'auto', padding: '70px 22px' }}>
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 10 }}>Administração do Agendaí</h1>
        <p className="muted" style={{ lineHeight: 1.8, marginTop: 14, fontSize: 14 }}>
          O painel do super admin precisa do Supabase configurado para validar seu perfil de administradora(o) da plataforma. Ao conectar o projeto, esta área mostra MRR, churn, crescimento, todos os negócios e permite suspender/reativar contas — sempre com auditoria.
        </p>
      </main>
    );
  }
  const supabase = await criarSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.rpc('admin_visao_geral');
  if (!data) redirect('/login'); // não é super admin: a RPC já barra no banco
  return <AdminPanel visao={data} />;
}
