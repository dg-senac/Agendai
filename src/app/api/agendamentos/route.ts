import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { agendamentoPainelSchema, agendamentoPatchSchema } from '@/server/validators/fase2';

const erro = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });

async function contexto() {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from('membros').select('id, negocio_id, papel').eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).single();
  return me ? { db, me } : null;
}

export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return erro('Supabase não configurado neste ambiente.', 503);
  const ctx = await contexto();
  if (!ctx) return erro('Entre na sua conta para continuar.', 401);
  const parsed = agendamentoPainelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
  const d = parsed.data;
  const { db, me } = ctx;
  if (me.papel !== 'dono' && d.membro_id !== me.id) return erro('Você só pode agendar para si mesmo.', 403);

  const { data: servico } = await db.from('servicos').select('duracao_minutos, preco_centavos').eq('id', d.servico_id).eq('negocio_id', me.negocio_id).single();
  if (!servico) return erro('Serviço não encontrado.', 404);
  const { data: vinculo } = await db.from('membro_servicos').select('preco_customizado_centavos').eq('membro_id', d.membro_id).eq('servico_id', d.servico_id).maybeSingle();

  let clienteId = d.cliente_id;
  if (!clienteId && d.novo_cliente) {
    const whats = d.novo_cliente.whatsapp.replace(/\D/g, '');
    const { data: cli, error: cliErro } = await db.from('clientes')
      .upsert({ negocio_id: me.negocio_id, nome: d.novo_cliente.nome, whatsapp: whats }, { onConflict: 'negocio_id,whatsapp' })
      .select('id').single();
    if (cliErro || !cli) return erro('Não foi possível cadastrar o cliente.', 400);
    clienteId = cli.id;
  }
  const inicio = new Date(d.inicio_ts);
  const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60_000);
  const { data, error } = await db.from('agendamentos').insert({
    negocio_id: me.negocio_id, cliente_id: clienteId, membro_id: d.membro_id, servico_id: d.servico_id,
    inicio_ts: inicio.toISOString(), fim_ts: fim.toISOString(), status: 'confirmado', origem: 'painel',
    preco_centavos: vinculo?.preco_customizado_centavos ?? servico.preco_centavos, sinal_centavos: 0, observacoes: d.observacoes || null,
  }).select('id, token_publico').single();
  if (error) return erro(error.code === '23P01' ? 'Este horário já está ocupado para o profissional.' : 'Não foi possível criar o agendamento.', 400);
  return NextResponse.json({ ok: true, agendamento: data });
}

export async function PATCH(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return erro('Supabase não configurado neste ambiente.', 503);
  const ctx = await contexto();
  if (!ctx) return erro('Entre na sua conta para continuar.', 401);
  const parsed = agendamentoPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
  const { db, me } = ctx;
  const { data: atual } = await db.from('agendamentos').select('inicio_ts, fim_ts').eq('id', parsed.data.id).eq('negocio_id', me.negocio_id).single();
  if (!atual) return erro('Agendamento não encontrado.', 404);
  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.inicio_ts) {
    const duracao = new Date(atual.fim_ts).getTime() - new Date(atual.inicio_ts).getTime();
    const inicio = new Date(parsed.data.inicio_ts);
    updates.inicio_ts = inicio.toISOString();
    updates.fim_ts = new Date(inicio.getTime() + duracao).toISOString();
  }
  // O RLS garante: dono altera qualquer um do negócio; profissional, só os seus.
  const { error } = await db.from('agendamentos').update(updates).eq('id', parsed.data.id).eq('negocio_id', me.negocio_id);
  if (error) return erro(error.code === '23P01' ? 'Este horário já está ocupado para o profissional.' : 'Não foi possível atualizar.', 400);
  return NextResponse.json({ ok: true });
}
