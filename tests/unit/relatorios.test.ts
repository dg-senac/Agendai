import { describe, expect, it } from 'vitest';
import { comparecimento, horariosPico, novosClientesPorSemana, receitaPorDia, topProfissionais, topServicos } from '@/lib/relatorios';
import type { Appointment, Client, Member, Payment, Service } from '@/lib/demo';

const agora = new Date('2026-10-26T12:00:00-03:00');

const agendamentoBase: Appointment = {
  id: 'a1', cliente_id: 'c1', membro_id: 'p1', servico_id: 's1',
  inicio_ts: '2026-10-20T09:00:00-03:00', fim_ts: '2026-10-20T10:00:00-03:00',
  status: 'concluido', origem: 'pagina_publica', preco_centavos: 5000, sinal_centavos: 0, token_publico: 't1',
};
const agendamentos: Appointment[] = [
  agendamentoBase,
  { ...agendamentoBase, id: 'a2', inicio_ts: '2026-10-20T09:30:00-03:00', status: 'faltou', servico_id: 's2', preco_centavos: 3000 },
  { ...agendamentoBase, id: 'a3', inicio_ts: '2026-10-21T14:00:00-03:00', membro_id: 'p2', preco_centavos: 8000 },
  { ...agendamentoBase, id: 'a4', inicio_ts: '2026-10-22T09:00:00-03:00', status: 'cancelado' },
  { ...agendamentoBase, id: 'a5', inicio_ts: '2026-09-01T09:00:00-03:00', status: 'concluido', preco_centavos: 99900 }, // fora dos 30 dias
];
const servicos: Service[] = [
  { id: 's1', nome: 'Corte', duracao_minutos: 60, preco_centavos: 5000, exige_sinal: false, ativo: true },
  { id: 's2', nome: 'Escova', duracao_minutos: 45, preco_centavos: 3000, exige_sinal: false, ativo: true },
];
const membros: Member[] = [
  { id: 'p1', nome: 'Ana Souza', papel: 'dono', ativo: true, servico_ids: [] },
  { id: 'p2', nome: 'Camila Santos', papel: 'profissional', ativo: true, servico_ids: [] },
];
const pagamentos: Payment[] = [
  { id: 'pg1', agendamento_id: 'a1', tipo: 'saldo', metodo: 'pix', valor_centavos: 5000, status: 'pago', pago_em: '2026-10-20T10:05:00-03:00', created_at: '2026-10-20T10:00:00-03:00' },
  { id: 'pg2', agendamento_id: 'a3', tipo: 'saldo', metodo: 'dinheiro', valor_centavos: 8000, status: 'pago', pago_em: '2026-10-21T15:00:00-03:00', created_at: '2026-10-21T15:00:00-03:00' },
  { id: 'pg3', agendamento_id: null, tipo: 'assinatura', metodo: 'cartao', valor_centavos: 2990, status: 'pago', pago_em: '2026-10-26T09:00:00-03:00', created_at: '2026-10-26T09:00:00-03:00' },
  { id: 'pg4', agendamento_id: 'aX', tipo: 'saldo', metodo: 'pix', valor_centavos: 7000, status: 'estornado', pago_em: null, created_at: '2026-10-26T08:00:00-03:00' },
];

describe('relatórios', () => {
  it('agrupa a receita paga por dia, sem assinatura e sem buracos', () => {
    const serie = receitaPorDia(pagamentos, 7, agora);
    expect(serie).toHaveLength(7);
    const dia = (chave: string) => serie.find((d) => d.dia === chave)?.total_centavos;
    expect(dia('2026-10-20')).toBe(5000);
    expect(dia('2026-10-21')).toBe(8000);
    expect(dia('2026-10-26')).toBe(0); // assinatura e estorno ficam de fora
    expect(dia('2026-10-25')).toBe(0); // dia sem receita aparece zerado
  });

  it('ranqueia serviços por quantidade e profissionais por receita', () => {
    const top = topServicos(agendamentos, servicos, 30, agora);
    expect(top[0]).toMatchObject({ nome: 'Corte', quantidade: 2, receita_centavos: 13000 });
    const profs = topProfissionais(agendamentos, membros, 30, agora);
    expect(profs[0].nome).toBe('Camila Santos'); // 8000 > 5000 da Ana Souza
  });

  it('calcula comparecimento (concluídos vs faltas) e ignora o resto', () => {
    const c = comparecimento(agendamentos, 30, agora);
    expect(c.concluidos).toBe(2);
    expect(c.faltas).toBe(1);
    expect(c.taxa).toBeCloseTo(66.7, 1);
  });

  it('aponta os horários de pico (sem cancelados)', () => {
    const pico = horariosPico(agendamentos, 30, agora);
    const horaDas9 = new Date('2026-10-20T09:00:00-03:00').getHours(); // independente do fuso do CI
    const horaDas14 = new Date('2026-10-21T14:00:00-03:00').getHours();
    expect(pico.find((h) => h.hora === horaDas9)?.quantidade).toBe(2);
    expect(pico.find((h) => h.hora === horaDas14)?.quantidade).toBe(1);
  });

  it('conta novos clientes por semana, da mais antiga para a atual', () => {
    const clientes: Client[] = [
      { id: 'c1', nome: 'A', whatsapp: '1', email: '', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: '2026-10-26T10:00:00-03:00' },
      { id: 'c2', nome: 'B', whatsapp: '2', email: '', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: '2026-10-15T10:00:00-03:00' },
      { id: 'c3', nome: 'C', whatsapp: '3', email: '', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: '2026-10-14T10:00:00-03:00' },
      { id: 'c4', nome: 'D', whatsapp: '4', email: '', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: '2026-06-01T10:00:00-03:00' },
    ];
    expect(novosClientesPorSemana(clientes, 2, agora)).toEqual([2, 1]);
  });
});
