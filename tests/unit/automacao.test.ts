import { describe, it, expect } from 'vitest';
import { notificacoesDoAgendamento, proximaTentativa, aplicarCicloAssinatura, diasRestantesTrial } from '@/lib/automacao';
import type { Appointment, Business, Client } from '@/lib/demo';

const cliente: Client = { id: 'c1', nome: 'Mariana Costa', whatsapp: '5581999991234', email: 'mariana@example.com', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: new Date().toISOString() };
const ag = (ini: Date): Appointment => ({
  id: 'a1', cliente_id: 'c1', membro_id: 'm1', servico_id: 's1',
  inicio_ts: ini.toISOString(), fim_ts: new Date(ini.getTime() + 3600_000).toISOString(),
  status: 'confirmado', origem: 'pagina_publica', preco_centavos: 8500, sinal_centavos: 0, token_publico: 't',
});
const negocio = (parcial: Partial<Business>): Business => ({ nome: 'Studio', slug: 'studio', telefone: '', cidade: '', ...parcial });

describe('automação (Fase 4)', () => {
  it('agenda confirmação imediata + lembretes 24h/2h + WhatsApp + pós-atendimento', () => {
    const agora = new Date(2026, 9, 21, 8);
    const lista = notificacoesDoAgendamento(ag(new Date(2026, 9, 23, 10)), cliente, agora);
    const tipos = lista.map((n) => `${n.tipo}/${n.canal}`);
    expect(tipos).toContain('confirmacao/email');
    expect(tipos).toContain('lembrete_24h/email');
    expect(tipos).toContain('lembrete_2h/email');
    expect(tipos).toContain('lembrete_2h/whatsapp_link');
    expect(tipos).toContain('pos_atendimento/email');
    expect(lista.find((n) => n.tipo === 'lembrete_24h')?.agendada_para).toBe(new Date(2026, 9, 22, 10).toISOString());
  });

  it('não agenda lembrete no passado quando o agendamento é para daqui a pouco', () => {
    const agora = new Date(2026, 9, 21, 8);
    const lista = notificacoesDoAgendamento(ag(new Date(2026, 9, 21, 9, 30)), cliente, agora);
    expect(lista.some((n) => n.tipo === 'lembrete_24h')).toBe(false);
    expect(lista.some((n) => n.tipo === 'lembrete_2h')).toBe(false);
    expect(lista.some((n) => n.tipo === 'confirmacao')).toBe(true);
  });

  it('sem e-mail do cliente, nenhuma notificação é gerada', () => {
    const lista = notificacoesDoAgendamento(ag(new Date(Date.now() + 3 * 86400_000)), { ...cliente, email: '' });
    expect(lista).toEqual([]);
  });

  it('retry com backoff de 5/15/45 min e desistência depois', () => {
    const agora = new Date(2026, 9, 21, 8);
    expect(proximaTentativa(0, agora).quando?.getMinutes()).toBe(5);
    expect(proximaTentativa(1, agora).quando?.getMinutes()).toBe(15);
    expect(proximaTentativa(2, agora).quando?.getMinutes()).toBe(45);
    expect(proximaTentativa(3, agora).quando).toBeNull();
  });

  it('ciclo: trial vencido vira Grátis; cobrança vencida vira inadimplente; carência vencida faz downgrade', () => {
    const agora = new Date(2026, 9, 21);
    const trial = aplicarCicloAssinatura(negocio({ plano: 'pro', status: 'trial', assinatura_status: 'trial', trial_termina_em: new Date(2026, 9, 20).toISOString() }), agora);
    expect(trial.plano).toBe('gratis');
    const vencida = aplicarCicloAssinatura(negocio({ plano: 'pro', status: 'ativo', assinatura_status: 'ativa', assinatura_proxima_cobranca: new Date(2026, 9, 20).toISOString() }), agora);
    expect(vencida.assinatura_status).toBe('inadimplente');
    expect(vencida.carencia_ate).toBeTruthy();
    const rebaixado = aplicarCicloAssinatura(negocio({ plano: 'pro', status: 'inadimplente', assinatura_status: 'inadimplente', carencia_ate: new Date(2026, 9, 20).toISOString() }), agora);
    expect(rebaixado.plano).toBe('gratis');
    expect(rebaixado.assinatura_status).toBe('ativa');
  });

  it('dias restantes do trial', () => {
    const agora = new Date(2026, 9, 21, 12);
    expect(diasRestantesTrial(negocio({ assinatura_status: 'trial', trial_termina_em: new Date(2026, 9, 24, 12).toISOString() }), agora)).toBe(3);
    expect(diasRestantesTrial(negocio({ assinatura_status: 'ativa' }), agora)).toBeNull();
  });
});
