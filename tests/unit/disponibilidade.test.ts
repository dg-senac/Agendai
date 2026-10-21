import { describe, it, expect } from 'vitest';
import { gerarSlots, encontrarConflito, membroAtende, sobrepoe } from '@/lib/disponibilidade';
import type { Appointment, Block, Member, Schedule } from '@/lib/demo';

// Segunda-feira, 2026-10-26 (dia_semana = 1)
const segunda = new Date(2026, 9, 26);
const agora = new Date(2026, 9, 26, 7, 0);
const horario: Schedule = { id: 'h1', membro_id: 'm1', dia_semana: 1, inicio: '09:00', fim: '12:00', intervalo_inicio: '10:00', intervalo_fim: '10:30' };

const ag = (ini: string, fim: string, status: Appointment['status'] = 'confirmado'): Appointment => ({
  id: `a-${ini}`, cliente_id: 'c1', membro_id: 'm1', servico_id: 's1',
  inicio_ts: new Date(2026, 9, 26, ...ini.split(':').map(Number) as [number, number]).toISOString(),
  fim_ts: new Date(2026, 9, 26, ...fim.split(':').map(Number) as [number, number]).toISOString(),
  status, origem: 'pagina_publica', preco_centavos: 1000, sinal_centavos: 0, token_publico: 't',
});

describe('algoritmo de disponibilidade', () => {
  it('gera slots de 15 min que cabem no expediente e fora do intervalo', () => {
    const slots = gerarSlots({ data: segunda, duracaoMinutos: 60, schedules: [horario], appointments: [], blocks: [], agora });
    const horas = slots.map((s) => `${s.inicio.getHours()}:${String(s.inicio.getMinutes()).padStart(2, '0')}`);
    // 09:00 ok (termina 10:00). 09:15..10:15 colidem com intervalo 10:00-10:30.
    expect(horas).toEqual(['9:00', '10:30', '10:45', '11:00']);
  });

  it('remove slots em conflito com agendamentos e ignora cancelados', () => {
    const slots = gerarSlots({ data: segunda, duracaoMinutos: 60, schedules: [horario], appointments: [ag('10:30', '11:30'), ag('9:00', '10:00', 'cancelado')], blocks: [], agora });
    const horas = slots.map((s) => s.inicio.getHours());
    expect(horas).toEqual([9]); // 11:00 colide com 10:30-11:30; cancelado não bloqueia
  });

  it('respeita bloqueios (folgas) e antecedência mínima', () => {
    const bloqueio: Block = { id: 'b1', membro_id: 'm1', inicio_ts: new Date(2026, 9, 26, 9, 0).toISOString(), fim_ts: new Date(2026, 9, 26, 10, 0).toISOString(), motivo: 'Dentista' };
    const slots = gerarSlots({ data: segunda, duracaoMinutos: 30, schedules: [{ ...horario, intervalo_inicio: null, intervalo_fim: null }], appointments: [], blocks: [bloqueio], agora, antecedenciaMinimaHoras: 4 });
    // antecedência: só a partir das 11:00; bloqueio remove a manhã de qualquer forma
    expect(slots.every((s) => s.inicio.getHours() >= 11)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('serviço que não cabe no expediente não gera slots', () => {
    const slots = gerarSlots({ data: segunda, duracaoMinutos: 240, schedules: [horario], appointments: [], blocks: [], agora });
    expect(slots).toEqual([]);
  });

  it('detecta conflito (double-booking) e permite encostar no fim do anterior', () => {
    const lista = [ag('9:00', '10:00')];
    expect(encontrarConflito(lista, { membro_id: 'm1', inicio: new Date(2026, 9, 26, 9, 30), fim: new Date(2026, 9, 26, 10, 30) })).toBeDefined();
    expect(encontrarConflito(lista, { membro_id: 'm1', inicio: new Date(2026, 9, 26, 10, 0), fim: new Date(2026, 9, 26, 11, 0) })).toBeUndefined();
    expect(sobrepoe(new Date(2026, 9, 26, 10), new Date(2026, 9, 26, 11), new Date(2026, 9, 26, 11), new Date(2026, 9, 26, 12))).toBe(false);
  });

  it('aplica a regra de vínculo membro↔serviço', () => {
    const livre: Member = { id: 'm1', nome: 'Ana', papel: 'dono', ativo: true, servico_ids: [] };
    const restrito: Member = { ...livre, id: 'm2', servico_ids: ['s1'] };
    expect(membroAtende(livre, 'qualquer')).toBe(true);
    expect(membroAtende(restrito, 's1')).toBe(true);
    expect(membroAtende(restrito, 's2')).toBe(false);
  });
});
