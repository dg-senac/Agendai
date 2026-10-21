import type { Appointment, Client, Member, Payment, Service } from '@/lib/demo';

// Agregações puras dos relatórios (Fase 5) — espelham a RPC relatorio_negocio.
// Funcionam sobre os dados já carregados no painel (demo e real).

const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type ReceitaDia = { dia: string; rotulo: string; total_centavos: number };

/** Receita recebida (pagamentos pagos) por dia, sem buracos. */
export function receitaPorDia(payments: Payment[], dias = 30, agora = new Date()): ReceitaDia[] {
  const mapa = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== 'pago' || p.tipo === 'assinatura') continue;
    const chave = chaveDia(new Date(p.pago_em ?? p.created_at));
    mapa.set(chave, (mapa.get(chave) ?? 0) + p.valor_centavos);
  }
  const resultado: ReceitaDia[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
    const chave = chaveDia(d);
    resultado.push({ dia: chave, rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, total_centavos: mapa.get(chave) ?? 0 });
  }
  return resultado;
}

export type Ranking = { nome: string; quantidade: number; receita_centavos: number };

export function topServicos(appointments: Appointment[], services: Service[], dias = 30, agora = new Date()): Ranking[] {
  const min = new Date(agora.getTime() - dias * 86400_000);
  const mapa = new Map<string, Ranking>();
  for (const a of appointments) {
    if (new Date(a.inicio_ts) < min || !(a.status === 'concluido' || a.status === 'confirmado')) continue;
    const nome = services.find((s) => s.id === a.servico_id)?.nome ?? 'Serviço';
    const atual = mapa.get(nome) ?? { nome, quantidade: 0, receita_centavos: 0 };
    atual.quantidade++; atual.receita_centavos += a.preco_centavos;
    mapa.set(nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || b.receita_centavos - a.receita_centavos).slice(0, 5);
}

export function topProfissionais(appointments: Appointment[], members: Member[], dias = 30, agora = new Date()): Ranking[] {
  const min = new Date(agora.getTime() - dias * 86400_000);
  const mapa = new Map<string, Ranking>();
  for (const a of appointments) {
    if (new Date(a.inicio_ts) < min || !(a.status === 'concluido' || a.status === 'confirmado')) continue;
    const nome = members.find((m) => m.id === a.membro_id)?.nome ?? 'Profissional';
    const atual = mapa.get(nome) ?? { nome, quantidade: 0, receita_centavos: 0 };
    atual.quantidade++; atual.receita_centavos += a.preco_centavos;
    mapa.set(nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.receita_centavos - a.receita_centavos).slice(0, 5);
}

/** Taxa de comparecimento (concluídos vs faltas) e horários de pico. */
export function comparecimento(appointments: Appointment[], dias = 30, agora = new Date()): { concluidos: number; faltas: number; taxa: number | null } {
  const min = new Date(agora.getTime() - dias * 86400_000);
  const noPeriodo = appointments.filter((a) => new Date(a.inicio_ts) >= min);
  const concluidos = noPeriodo.filter((a) => a.status === 'concluido').length;
  const faltas = noPeriodo.filter((a) => a.status === 'faltou').length;
  const total = concluidos + faltas;
  return { concluidos, faltas, taxa: total ? Math.round((concluidos / total) * 1000) / 10 : null };
}

export function horariosPico(appointments: Appointment[], dias = 30, agora = new Date()): Array<{ hora: number; quantidade: number }> {
  const min = new Date(agora.getTime() - dias * 86400_000);
  const contagem = new Array<number>(24).fill(0);
  for (const a of appointments) {
    if (new Date(a.inicio_ts) < min || a.status === 'cancelado') continue;
    contagem[new Date(a.inicio_ts).getHours()]++;
  }
  return contagem.map((quantidade, hora) => ({ hora, quantidade })).filter((h) => h.hora >= 7 && h.hora <= 21);
}

export function novosClientesPorSemana(clients: Client[], semanas = 8, agora = new Date()): number[] {
  const resultado = new Array<number>(semanas).fill(0);
  for (const c of clients) {
    const diff = Math.floor((agora.getTime() - new Date(c.created_at).getTime()) / (7 * 86400_000));
    if (diff >= 0 && diff < semanas) resultado[semanas - 1 - diff]++;
  }
  return resultado;
}
