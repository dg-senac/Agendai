import type { Appointment, Business } from '@/lib/demo';

// Espelho em TS das funções limites_plano/plano_efetivo do banco (Fase 3).
// No modo real, quem manda é o banco (triggers); aqui é a demonstração + UX.
export type PlanoId = 'gratis' | 'pro' | 'premium';

export const PLANOS: Record<PlanoId, {
  nome: string; preco_centavos: number; profissionais: number | null; agendamentos_mes: number | null;
  sinal_pix: boolean; csv: boolean; branding: boolean; beneficios: string[];
}> = {
  gratis: {
    nome: 'Grátis', preco_centavos: 0, profissionais: 1, agendamentos_mes: 30, sinal_pix: false, csv: false, branding: false,
    beneficios: ['1 profissional', 'Até 30 agendamentos/mês', 'Sua página pública de agendamento'],
  },
  pro: {
    nome: 'Pro', preco_centavos: 2990, profissionais: 3, agendamentos_mes: null, sinal_pix: true, csv: false, branding: false,
    beneficios: ['Até 3 profissionais', 'Agendamentos ilimitados', 'Sinal via Pix (adeus, faltas!)', 'Lembretes por e-mail'],
  },
  premium: {
    nome: 'Premium', preco_centavos: 5990, profissionais: null, agendamentos_mes: null, sinal_pix: true, csv: true, branding: true,
    beneficios: ['Profissionais ilimitados', 'Tudo do Pro', 'Relatórios avançados', 'Logo e cores próprias', 'Exportação CSV'],
  },
};

type EstadoNegocio = Pick<Business, 'plano' | 'status' | 'trial_termina_em' | 'assinatura_status' | 'assinatura_proxima_cobranca' | 'carencia_ate'>;

/** Plano que vale neste instante (trial válido = Pro). */
export function planoEfetivo(b: EstadoNegocio, agora = new Date()): PlanoId {
  if (b.status === 'suspenso' || b.status === 'cancelado') return 'gratis';
  if (b.assinatura_status === 'inadimplente' && b.carencia_ate && new Date(b.carencia_ate) < agora) return 'gratis';
  if (b.assinatura_status === 'cancelada') {
    return b.assinatura_proxima_cobranca && new Date(b.assinatura_proxima_cobranca) > agora ? (b.plano ?? 'gratis') : 'gratis';
  }
  const emTrial = b.assinatura_status === 'trial' || b.status === 'trial';
  if (emTrial) return b.trial_termina_em && new Date(b.trial_termina_em) > agora ? 'pro' : 'gratis';
  return b.plano ?? 'gratis';
}

export const limiteProfissionais = (p: PlanoId) => PLANOS[p].profissionais;
export const podeSinal = (p: PlanoId) => PLANOS[p].sinal_pix;
export const podeCsv = (p: PlanoId) => PLANOS[p].csv;

/** Agendamentos válidos no mês da data de referência (regra do plano Grátis). */
export function contarAgendamentosMes(appointments: Appointment[], referencia: Date): number {
  return appointments.filter((a) => {
    if (a.status === 'cancelado') return false;
    const d = new Date(a.inicio_ts);
    return d.getFullYear() === referencia.getFullYear() && d.getMonth() === referencia.getMonth();
  }).length;
}

export function dentroDoLimiteMensal(plano: PlanoId, appointments: Appointment[], referencia: Date): boolean {
  const max = PLANOS[plano].agendamentos_mes;
  return max === null || contarAgendamentosMes(appointments, referencia) < max;
}

/** Sinal em centavos conforme regras: plano pago + serviço exige OU faltas. */
export function calcularSinal(opts: { plano: PlanoId; preco_centavos: number; percentual: number; servicoExige: boolean; faltasCliente: number; faltasParaSinal: number | null }): number {
  if (!podeSinal(opts.plano)) return 0;
  const porFaltas = opts.faltasParaSinal !== null && opts.faltasCliente >= opts.faltasParaSinal;
  if (!opts.servicoExige && !porFaltas) return 0;
  return Math.round(opts.preco_centavos * opts.percentual / 100);
}
