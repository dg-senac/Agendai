import { redirect } from 'next/navigation';
import { Onboarding } from '@/components/onboarding';
import { configured, supabase } from '@/lib/supabase/server';
export const metadata = { title: 'Configure seu negócio — Agendaí' };
export default async function Page() {
  if (!configured()) return <Onboarding live={false} />;
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: membro } = await db.from('membros').select('id').eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).maybeSingle();
  if (membro) redirect('/painel');
  const nome = typeof user.user_metadata?.nome === 'string' ? user.user_metadata.nome : '';
  return <Onboarding live nomeInicial={nome} />;
}
