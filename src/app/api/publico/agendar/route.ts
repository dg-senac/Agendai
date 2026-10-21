import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { agendamentoPublicoSchema } from '@/server/validators/fase2';
import { dentroDoLimite, ipDaRequisicao } from '@/server/rate-limit';

export async function POST(req: NextRequest) {
  if (!dentroDoLimite(`agendar:${ipDaRequisicao(req)}`, 10, 60_000)) return NextResponse.json({ error: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.' }, { status: 429 });
  if (!configured()) return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  const parsed = agendamentoPublicoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const db = await supabase();
  const { data, error } = await db.rpc('criar_agendamento_publico', {
    p_slug: d.slug, p_servico_id: d.servico_id, p_membro_id: d.membro_id, p_inicio: d.inicio,
    p_nome: d.nome, p_whatsapp: d.whatsapp, p_email: d.email || null, p_observacoes: d.observacoes || null, p_consentimento: d.consentimento,
  });
  if (error) {
    const msg = error.message.match(/[A-ZÁÉÍÓÚ][^.]+\./)?.[0] ?? 'Não foi possível concluir o agendamento.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, agendamento: data });
}
