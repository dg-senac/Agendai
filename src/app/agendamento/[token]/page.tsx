import { notFound } from 'next/navigation';
import { AgendamentoDemo, AgendamentoLive } from '@/components/agendamento-publico';
import { configured, supabase } from '@/lib/supabase/server';

export const metadata = { title: 'Meu agendamento — Agendaí', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!configured()) return <AgendamentoDemo token={token} />;
  const db = await supabase();
  const { data } = await db.rpc('agendamento_por_token', { p_token: token });
  if (!data) notFound();
  return <AgendamentoLive token={token} inicial={data} />;
}
