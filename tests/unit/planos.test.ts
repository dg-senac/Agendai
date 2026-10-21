import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { planoEfetivo, calcularSinal, dentroDoLimiteMensal, limiteProfissionais, podeCsv } from '@/lib/planos';
import { validarAssinaturaWebhookMp } from '@/lib/pagamentos/mercado-pago';
import { gerarCopiaEColaSimulada } from '@/lib/pagamentos/simulado';
import type { Appointment, Business } from '@/lib/demo';

const negocio = (parcial: Partial<Business>): Business => ({ nome: 'Studio', slug: 'studio', telefone: '', cidade: '', ...parcial });
const ag = (dia: number, status: Appointment['status'] = 'confirmado'): Appointment => ({
  id: `a${dia}-${status}`, cliente_id: 'c', membro_id: 'm', servico_id: 's',
  inicio_ts: new Date(2026, 9, dia, 10).toISOString(), fim_ts: new Date(2026, 9, dia, 11).toISOString(),
  status, origem: 'pagina_publica', preco_centavos: 1000, sinal_centavos: 0, token_publico: 't',
});

describe('planos e limites (Fase 3)', () => {
  it('trial válido vale como Pro; vencido cai para Grátis', () => {
    const futuro = new Date(Date.now() + 86400_000).toISOString();
    const passado = new Date(Date.now() - 86400_000).toISOString();
    expect(planoEfetivo(negocio({ plano: 'pro', status: 'trial', assinatura_status: 'trial', trial_termina_em: futuro }))).toBe('pro');
    expect(planoEfetivo(negocio({ plano: 'pro', status: 'trial', assinatura_status: 'trial', trial_termina_em: passado }))).toBe('gratis');
  });

  it('inadimplente mantém o plano na carência e perde depois de 7 dias', () => {
    const base = { plano: 'premium' as const, status: 'ativo', assinatura_status: 'inadimplente' as const };
    expect(planoEfetivo(negocio({ ...base, carencia_ate: new Date(Date.now() + 86400_000).toISOString() }))).toBe('premium');
    expect(planoEfetivo(negocio({ ...base, carencia_ate: new Date(Date.now() - 86400_000).toISOString() }))).toBe('gratis');
  });

  it('limites por plano e CSV só no Premium', () => {
    expect(limiteProfissionais('gratis')).toBe(1);
    expect(limiteProfissionais('pro')).toBe(3);
    expect(limiteProfissionais('premium')).toBeNull();
    expect(podeCsv('pro')).toBe(false);
    expect(podeCsv('premium')).toBe(true);
  });

  it('plano Grátis bloqueia no 31º agendamento do mês (cancelados não contam)', () => {
    const ref = new Date(2026, 9, 15);
    const lista = Array.from({ length: 30 }, (_, i) => ag((i % 28) + 1));
    lista.push(ag(3, 'cancelado'));
    expect(dentroDoLimiteMensal('gratis', lista, ref)).toBe(false);
    expect(dentroDoLimiteMensal('pro', lista, ref)).toBe(true);
    expect(dentroDoLimiteMensal('gratis', lista.slice(0, 29), ref)).toBe(true);
  });

  it('sinal: só plano pago, por serviço ou por faltas do cliente', () => {
    const base = { preco_centavos: 18000, percentual: 30, servicoExige: false, faltasCliente: 0, faltasParaSinal: 3 as number | null };
    expect(calcularSinal({ ...base, plano: 'gratis', servicoExige: true })).toBe(0);
    expect(calcularSinal({ ...base, plano: 'pro', servicoExige: true })).toBe(5400);
    expect(calcularSinal({ ...base, plano: 'pro', faltasCliente: 3 })).toBe(5400);
    expect(calcularSinal({ ...base, plano: 'pro', faltasCliente: 2 })).toBe(0);
    expect(calcularSinal({ ...base, plano: 'pro', faltasCliente: 9, faltasParaSinal: null })).toBe(0);
  });
});

describe('webhook Mercado Pago', () => {
  it('valida assinatura HMAC correta e rejeita adulterada', () => {
    const secret = 'segredo-teste';
    const ts = '1704908010';
    const manifesto = `id:12345;request-id:req-1;ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifesto).digest('hex');
    expect(validarAssinaturaWebhookMp({ secret, xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '12345' })).toBe(true);
    expect(validarAssinaturaWebhookMp({ secret, xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '99999' })).toBe(false);
    expect(validarAssinaturaWebhookMp({ secret, xSignature: null, xRequestId: 'req-1', dataId: '12345' })).toBe(false);
  });

  it('copia e cola simulado é identificável e determinístico', () => {
    expect(gerarCopiaEColaSimulada(5400, 'abc')).toContain('SIMULADO');
    expect(gerarCopiaEColaSimulada(5400, 'abc')).toBe(gerarCopiaEColaSimulada(5400, 'abc'));
  });
});
