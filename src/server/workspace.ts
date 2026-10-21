import { redirect } from 'next/navigation';
import { configured, supabase } from '@/lib/supabase/server';
import type { Appointment, Block, Client, Member, Review, Schedule, Service, Store } from '@/lib/demo';

/** Carrega o workspace do tenant no modo real (RLS filtra por negocio_id). */
export async function loadWorkspace(): Promise<{ live: false } | { live: true; data: Store }> {
  if (!configured()) return { live: false };
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/entrar');

  const { data: me, error } = await db.from('membros').select('negocio_id')
    .eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).maybeSingle();
  if (error) throw new Error('Não foi possível carregar seu perfil. Verifique a instalação do banco.');
  if (!me) redirect('/onboarding');

  const desde = new Date(Date.now() - 60 * 24 * 3600_000).toISOString();
  const [negocio, servicos, membros, vinculos, horarios, clientes, agendamentos, bloqueios, avaliacoes] = await Promise.all([
    db.from('negocios').select('nome, slug, telefone, cidade, descricao, endereco, cor_primaria, fuso_horario, config_antecedencia_minima_horas, config_cancelamento_limite_horas, config_sinal_percentual').eq('id', me.negocio_id).single(),
    db.from('servicos').select('id, nome, descricao, duracao_minutos, preco_centavos, exige_sinal, ativo').is('deleted_at', null).order('nome'),
    db.from('membros').select('id, nome, papel, ativo, foto_url').is('deleted_at', null).order('nome'),
    db.from('membro_servicos').select('membro_id, servico_id'),
    db.from('horarios_trabalho').select('id, membro_id, dia_semana, inicio, fim, intervalo_inicio, intervalo_fim'),
    db.from('clientes').select('id, nome, whatsapp, email, observacoes, total_agendamentos, total_faltas, created_at').is('deleted_at', null).order('nome'),
    db.from('agendamentos').select('id, cliente_id, membro_id, servico_id, inicio_ts, fim_ts, status, origem, preco_centavos, sinal_centavos, token_publico, observacoes').is('deleted_at', null).gte('inicio_ts', desde).order('inicio_ts'),
    db.from('bloqueios').select('id, membro_id, inicio_ts, fim_ts, motivo'),
    db.from('avaliacoes').select('id, nota, comentario, resposta').eq('publica', true).order('created_at', { ascending: false }).limit(20),
  ]);
  const falha = [negocio, servicos, membros, horarios, clientes, agendamentos].find((r) => r.error);
  if (falha?.error) throw new Error('Não foi possível carregar os dados do negócio.');

  const servicosPorMembro = new Map<string, string[]>();
  for (const v of vinculos.data ?? []) {
    const lista = servicosPorMembro.get(v.membro_id as string) ?? [];
    lista.push(v.servico_id as string);
    servicosPorMembro.set(v.membro_id as string, lista);
  }

  const data: Store = {
    business: {
      nome: negocio.data?.nome ?? '', slug: negocio.data?.slug ?? '', telefone: negocio.data?.telefone ?? '', cidade: negocio.data?.cidade ?? '',
      descricao: negocio.data?.descricao ?? undefined, endereco: negocio.data?.endereco ?? undefined, cor_primaria: negocio.data?.cor_primaria ?? '#4F46E5',
      fuso_horario: negocio.data?.fuso_horario ?? 'America/Recife',
      config_antecedencia_minima_horas: negocio.data?.config_antecedencia_minima_horas ?? 2,
      config_cancelamento_limite_horas: negocio.data?.config_cancelamento_limite_horas ?? 4,
      config_sinal_percentual: negocio.data?.config_sinal_percentual ?? 30,
    },
    services: (servicos.data ?? []) as unknown as Service[],
    members: ((membros.data ?? []) as unknown as Member[]).map((m) => ({ ...m, servico_ids: servicosPorMembro.get(m.id) ?? [] })),
    schedules: (horarios.data ?? []) as unknown as Schedule[],
    clients: ((clientes.data ?? []) as unknown as Client[]).map((c) => ({ ...c, email: c.email ?? '', observacoes: c.observacoes ?? '' })),
    appointments: (agendamentos.data ?? []) as unknown as Appointment[],
    blocks: ((bloqueios.data ?? []) as unknown as Block[]).map((b) => ({ ...b, motivo: b.motivo ?? '' })),
    reviews: ((avaliacoes.data ?? []) as unknown as Review[]).map((a) => ({ ...a, cliente: 'Cliente' })),
  };
  return { live: true, data };
}
