'use client';
import Link from 'next/link';
import { PublicaUI, type UiProps } from './publica';
import { useDemoStore } from '@/components/use-demo-store';
import { apenasDigitos, novoToken, type Appointment } from '@/lib/demo';
import { encontrarConflito, gerarSlots, membroAtende } from '@/lib/disponibilidade';
import { calcularSinal, dentroDoLimiteMensal, planoEfetivo } from '@/lib/planos';
import { notificacoesDoAgendamento } from '@/lib/automacao';
import { gerarCopiaEColaSimulada } from '@/lib/pagamentos/simulado';

/* Página pública no modo demonstração (localStorage). Fica fora do bundle
   de produção real: entra via import dinâmico somente sem Supabase. */
export function PublicaDemo({ slug }: { slug: string }) {
  const { store, setStore, ready } = useDemoStore();

  const buscarSlots: UiProps['buscarSlots'] = async (data, servicoId, membroId) => {
    const servicoAtual = store.services.find((s) => s.id === servicoId);
    if (!servicoAtual) return [];
    const aptos = new Set(store.members.filter((m) => m.ativo && membroAtende(m, servicoId)).map((m) => m.id));
    return gerarSlots({
      data, duracaoMinutos: servicoAtual.duracao_minutos,
      schedules: store.schedules.filter((h) => aptos.has(h.membro_id)),
      appointments: store.appointments, blocks: store.blocks,
      membroId, antecedenciaMinimaHoras: store.business.config_antecedencia_minima_horas ?? 2,
    }).map((s) => ({ membro_id: s.membro_id, inicio: s.inicio.toISOString(), fim: s.fim.toISOString() }));
  };

  const agendar: UiProps['agendar'] = async ({ servicoId, membroId, inicio, cliente }) => {
    const servicoAtual = store.services.find((s) => s.id === servicoId);
    if (!servicoAtual) throw new Error('Serviço não encontrado.');
    const ini = new Date(inicio);
    const livres = await buscarSlots(ini, servicoId, membroId);
    const escolhido = livres.find((s) => s.inicio === ini.toISOString());
    if (!escolhido) throw new Error('Este horário não está mais disponível. Escolha outro, por favor.');
    const fim = new Date(ini.getTime() + servicoAtual.duracao_minutos * 60_000);
    if (encontrarConflito(store.appointments, { membro_id: escolhido.membro_id, inicio: ini, fim })) {
      throw new Error('Este horário acabou de ser reservado por outra pessoa.');
    }
    const digitos = apenasDigitos(cliente.whatsapp);
    const whats = digitos.length <= 11 ? `55${digitos}` : digitos;
    const plano = planoEfetivo(store.business);
    if (!dentroDoLimiteMensal(plano, store.appointments, ini)) {
      throw new Error('Este negócio atingiu o limite de agendamentos do mês. Tente no próximo mês ou fale pelo WhatsApp.');
    }
    const clienteExistente = store.clients.find((c) => c.whatsapp === whats);
    const sinal = calcularSinal({
      plano, preco_centavos: servicoAtual.preco_centavos, percentual: store.business.config_sinal_percentual ?? 30,
      servicoExige: servicoAtual.exige_sinal, faltasCliente: clienteExistente?.total_faltas ?? 0,
      faltasParaSinal: store.business.config_faltas_sinal_obrigatorio ?? null,
    });
    const token = novoToken();
    const agendamentoId = crypto.randomUUID();
    const pagamentoId = crypto.randomUUID();
    const expiraEm = new Date(Date.now() + 10 * 60_000).toISOString();
    const copiaCola = gerarCopiaEColaSimulada(sinal, pagamentoId);
    setStore((s) => {
      const existente = s.clients.find((c) => c.whatsapp === whats);
      const clienteId = existente?.id ?? crypto.randomUUID();
      const clients = existente
        ? s.clients.map((c) => c.id === clienteId ? { ...c, nome: cliente.nome, email: cliente.email || c.email } : c)
        : [...s.clients, { id: clienteId, nome: cliente.nome, whatsapp: whats, email: cliente.email, observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: new Date().toISOString() }];
      const ag: Appointment = { id: agendamentoId, cliente_id: clienteId, membro_id: escolhido.membro_id, servico_id: servicoId, inicio_ts: ini.toISOString(), fim_ts: fim.toISOString(), status: sinal > 0 ? 'pendente_pagamento' : 'confirmado', origem: 'pagina_publica', preco_centavos: servicoAtual.preco_centavos, sinal_centavos: sinal, token_publico: token, observacoes: cliente.observacoes, reserva_expira_em: sinal > 0 ? expiraEm : null };
      const payments = sinal > 0
        ? [...(s.payments ?? []), { id: pagamentoId, agendamento_id: agendamentoId, tipo: 'sinal' as const, metodo: 'pix' as const, valor_centavos: sinal, status: 'pendente' as const, provider: 'simulado', provider_id: `sim-${pagamentoId}`, pix_copia_cola: copiaCola, expira_em: expiraEm, created_at: new Date().toISOString() }]
        : s.payments ?? [];
      const donoEmail = 'dono@exemplo.com.br';
      const novas = notificacoesDoAgendamento(ag, { nome: cliente.nome, whatsapp: whats, email: cliente.email } as never)
        .map((n) => ({ ...n, id: crypto.randomUUID(), status: n.status ?? 'pendente' as const }));
      // Sem sinal: confirmação imediata entra na fila; com sinal, só após o Pix.
      const notifications = [
        ...(s.notifications ?? []),
        ...(sinal > 0 ? [] : novas),
        { id: crypto.randomUUID(), agendamento_id: ag.id, canal: 'email' as const, tipo: 'novo_agendamento' as const, status: 'enviada' as const, destinatario: donoEmail, agendada_para: new Date().toISOString(), enviada_em: new Date().toISOString() },
      ];
      return { ...s, clients, appointments: [...s.appointments, ag], payments, notifications };
    });
    return { id: agendamentoId, token, status: sinal > 0 ? 'pendente_pagamento' : 'confirmado', sinal_centavos: sinal, preco_centavos: servicoAtual.preco_centavos, membro_id: escolhido.membro_id, inicio: ini.toISOString(), fim: fim.toISOString(), pagamento: sinal > 0 ? { id: pagamentoId, copia_cola: copiaCola, qr_base64: null, expira_em: expiraEm, valor_centavos: sinal, simulado: true } : undefined };
  };

  if (ready && slug !== store.business.slug) {
    return <main className="min-h-screen grid place-items-center p-8"><div className="text-center"><h1 className="text-2xl font-bold">Negócio não encontrado 😕</h1><p className="muted my-4">Confira o endereço. Na demonstração, o negócio ativo é <strong>{store.business.nome}</strong>.</p><Link className="text-indigo-500 font-semibold" href={`/${store.business.slug}`}>Ir para /{store.business.slug} →</Link></div></main>;
  }
  const consultarStatus: UiProps['consultarStatus'] = async (token) => ({
    status: store.appointments.find((a) => a.token_publico === token)?.status ?? 'cancelado',
  });
  const simularPix: UiProps['simularPix'] = async (token, acao) => {
    setStore((s) => {
      const ag = s.appointments.find((a) => a.token_publico === token);
      if (!ag) return s;
      const clienteDoAg = s.clients.find((c) => c.id === ag.cliente_id);
      const novas = acao === 'pagar' && clienteDoAg
        ? notificacoesDoAgendamento(ag, clienteDoAg).map((n) => ({ ...n, id: crypto.randomUUID(), status: n.status ?? 'pendente' as const }))
        : [];
      return {
        ...s,
        appointments: s.appointments.map((a) => a.id === ag.id ? { ...a, status: acao === 'pagar' ? 'confirmado' as const : 'cancelado' as const, reserva_expira_em: null } : a),
        payments: (s.payments ?? []).map((pg) => pg.agendamento_id === ag.id && pg.status === 'pendente'
          ? { ...pg, status: acao === 'pagar' ? 'pago' as const : 'expirado' as const, pago_em: acao === 'pagar' ? new Date().toISOString() : pg.pago_em }
          : pg),
        notifications: [...(s.notifications ?? []), ...novas],
      };
    });
  };
  return <PublicaUI business={store.business} services={store.services} members={store.members} reviews={store.reviews.filter((r) => r.publica !== false)} buscarSlots={buscarSlots} agendar={agendar} consultarStatus={consultarStatus} simularPix={simularPix} />;
}
