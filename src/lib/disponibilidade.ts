import type { Appointment, Block, Member, Schedule } from '@/lib/demo';

// Espelho em TypeScript da RPC `horarios_disponiveis` (usado no modo
// demonstração e para pré-visualizações no painel). No modo real, quem decide
// é o banco: a RPC + o EXCLUDE constraint são a fonte da verdade.
// Observação de fuso: aqui usamos o horário local do navegador (demonstração);
// no banco, tudo é calculado no fuso_horario do negócio.

export type Slot = { membro_id: string; inicio: Date; fim: Date };

export const sobrepoe = (aIni: Date, aFim: Date, bIni: Date, bFim: Date) => aIni < bFim && bIni < aFim;

const noDia = (dia: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, 0, 0);
};

/** Regra do vínculo: sem nenhum vínculo = atende tudo; com vínculos = só eles. */
export const membroAtende = (membro: Member, servicoId: string) =>
  membro.servico_ids.length === 0 || membro.servico_ids.includes(servicoId);

export type ParametrosSlots = {
  data: Date;
  duracaoMinutos: number;
  schedules: Schedule[];
  appointments: Appointment[];
  blocks: Block[];
  antecedenciaMinimaHoras?: number;
  membroId?: string | null;
  agora?: Date;
};

export function gerarSlots(p: ParametrosSlots): Slot[] {
  const agora = p.agora ?? new Date();
  const limiteAntecedencia = new Date(agora.getTime() + (p.antecedenciaMinimaHoras ?? 0) * 3600_000);
  const duracaoMs = p.duracaoMinutos * 60_000;
  const passoMs = 15 * 60_000;
  const diaSemana = p.data.getDay();
  const slots: Slot[] = [];

  for (const h of p.schedules) {
    if (h.dia_semana !== diaSemana) continue;
    if (p.membroId && h.membro_id !== p.membroId) continue;
    const expedienteIni = noDia(p.data, h.inicio);
    const expedienteFim = noDia(p.data, h.fim);
    const intervalo = h.intervalo_inicio && h.intervalo_fim
      ? { ini: noDia(p.data, h.intervalo_inicio), fim: noDia(p.data, h.intervalo_fim) }
      : null;

    for (let ini = expedienteIni.getTime(); ini + duracaoMs <= expedienteFim.getTime(); ini += passoMs) {
      const inicio = new Date(ini);
      const fim = new Date(ini + duracaoMs);
      if (inicio < limiteAntecedencia) continue;
      if (intervalo && sobrepoe(inicio, fim, intervalo.ini, intervalo.fim)) continue;
      const bloqueado = p.blocks.some((b) => b.membro_id === h.membro_id && sobrepoe(inicio, fim, new Date(b.inicio_ts), new Date(b.fim_ts)));
      if (bloqueado) continue;
      const conflito = p.appointments.some((a) =>
        a.membro_id === h.membro_id &&
        (a.status === 'confirmado' || a.status === 'pendente_pagamento') &&
        sobrepoe(inicio, fim, new Date(a.inicio_ts), new Date(a.fim_ts)));
      if (conflito) continue;
      slots.push({ membro_id: h.membro_id, inicio, fim });
    }
  }
  return slots.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.membro_id.localeCompare(b.membro_id));
}

/**
 * Simula, no cliente (demonstração), a garantia do banco contra double-booking:
 * retorna o agendamento conflitante do mesmo profissional, se existir.
 */
export function encontrarConflito(
  appointments: Appointment[],
  candidato: { membro_id: string; inicio: Date; fim: Date; ignorarId?: string },
): Appointment | undefined {
  return appointments.find((a) =>
    a.id !== candidato.ignorarId &&
    a.membro_id === candidato.membro_id &&
    (a.status === 'confirmado' || a.status === 'pendente_pagamento') &&
    sobrepoe(candidato.inicio, candidato.fim, new Date(a.inicio_ts), new Date(a.fim_ts)));
}

export const formatarHora = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Gera o conteúdo .ics para "adicionar ao calendário". */
export function gerarIcs(a: { titulo: string; inicio: Date; fim: Date; descricao: string; local: string; uid: string }): string {
  const dt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agendai//PT-BR', 'BEGIN:VEVENT',
    `UID:${a.uid}@agendai.app`, `DTSTAMP:${dt(new Date())}`, `DTSTART:${dt(a.inicio)}`, `DTEND:${dt(a.fim)}`,
    `SUMMARY:${esc(a.titulo)}`, `DESCRIPTION:${esc(a.descricao)}`, `LOCATION:${esc(a.local)}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
