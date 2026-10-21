import type { Appointment, Business, Client, Notification } from '@/lib/demo';

// Regras puras da automação (Fase 4) — espelham as funções SQL
// enfileirar_notificacoes/processar_ciclo_assinaturas e são usadas na
// demonstração + nos testes. No modo real, quem manda é o banco + worker.

const H = 3600_000;

type NovaNotificacao = Omit<Notification, 'id' | 'status'> & { status?: Notification['status'] };

/** Notificações geradas quando um agendamento é confirmado. */
export function notificacoesDoAgendamento(ag: Appointment, cliente: Client, agora = new Date()): NovaNotificacao[] {
  const ini = new Date(ag.inicio_ts);
  const fim = new Date(ag.fim_ts);
  const base = { agendamento_id: ag.id, enviada_em: null, erro: null };
  const lista: NovaNotificacao[] = [];

  if (cliente.email) {
    lista.push({ ...base, canal: 'email', tipo: 'confirmacao', destinatario: cliente.email, agendada_para: agora.toISOString(), status: 'enviada', enviada_em: agora.toISOString() });
    const l24 = new Date(ini.getTime() - 24 * H);
    if (l24 > agora) lista.push({ ...base, canal: 'email', tipo: 'lembrete_24h', destinatario: cliente.email, agendada_para: l24.toISOString() });
    const l2 = new Date(ini.getTime() - 2 * H);
    if (l2 > agora) {
      lista.push({ ...base, canal: 'email', tipo: 'lembrete_2h', destinatario: cliente.email, agendada_para: l2.toISOString() });
      lista.push({ ...base, canal: 'whatsapp_link', tipo: 'lembrete_2h', destinatario: cliente.whatsapp, agendada_para: l2.toISOString() });
    }
    lista.push({ ...base, canal: 'email', tipo: 'pos_atendimento', destinatario: cliente.email, agendada_para: new Date(fim.getTime() + 2 * H).toISOString() });
  }
  return lista;
}

/** Retry com backoff: 5, 15 e 45 minutos; desiste na 4ª tentativa. */
export function proximaTentativa(tentativas: number, agora = new Date()): { quando: Date | null } {
  const atrasosMin = [5, 15, 45];
  if (tentativas >= atrasosMin.length) return { quando: null };
  return { quando: new Date(agora.getTime() + atrasosMin[tentativas] * 60_000) };
}

type EstadoAssinatura = Pick<Business, 'plano' | 'status' | 'assinatura_status' | 'trial_termina_em' | 'assinatura_proxima_cobranca' | 'carencia_ate'>;

/**
 * Ciclo de vida da assinatura (demonstração): retorna o novo estado do negócio
 * conforme o relógio — trial vencido e carência vencida viram plano Grátis.
 */
export function aplicarCicloAssinatura(b: EstadoAssinatura, agora = new Date()): EstadoAssinatura {
  if (b.assinatura_status === 'trial' && b.trial_termina_em && new Date(b.trial_termina_em) < agora) {
    return { ...b, plano: 'gratis', status: 'ativo', assinatura_status: 'ativa', assinatura_proxima_cobranca: null };
  }
  if (b.assinatura_status === 'ativa' && b.assinatura_proxima_cobranca && new Date(b.assinatura_proxima_cobranca) < agora && (b.plano ?? 'gratis') !== 'gratis') {
    return { ...b, assinatura_status: 'inadimplente', status: 'inadimplente', carencia_ate: new Date(agora.getTime() + 7 * 24 * H).toISOString() };
  }
  if (b.assinatura_status === 'inadimplente' && b.carencia_ate && new Date(b.carencia_ate) < agora) {
    return { ...b, plano: 'gratis', status: 'ativo', assinatura_status: 'ativa', assinatura_proxima_cobranca: null, carencia_ate: null };
  }
  return b;
}

/** Dias restantes de trial (null se não estiver em trial). */
export function diasRestantesTrial(b: EstadoAssinatura, agora = new Date()): number | null {
  if (b.assinatura_status !== 'trial' || !b.trial_termina_em) return null;
  return Math.max(0, Math.ceil((new Date(b.trial_termina_em).getTime() - agora.getTime()) / (24 * H)));
}

/** Mensagem pronta do lembrete de WhatsApp (1 clique do dono). */
export function mensagemLembreteWhats(negocioNome: string, clienteNome: string, servico: string, quando: string, link: string): string {
  return `Olá, ${clienteNome.split(' ')[0]}! 💜 Passando para lembrar do seu horário de ${servico} no ${negocioNome}: ${quando}. Qualquer imprevisto, você pode remarcar por aqui: ${link}`;
}
