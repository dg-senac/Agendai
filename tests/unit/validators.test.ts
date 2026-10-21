import { describe, it, expect } from 'vitest';
import { serviceSchema, scheduleSchema, businessSchema } from '@/server/validators/foundation';
import { cadastroSchema } from '@/server/validators/auth';
import { moeda } from '@/lib/utils';

describe('validações da fundação', () => {
  it('aceita serviço válido e rejeita duração menor que 15 min', () => {
    expect(serviceSchema.safeParse({ nome: 'Corte', duracao_minutos: 60, preco_centavos: 8500 }).success).toBe(true);
    expect(serviceSchema.safeParse({ nome: 'Corte', duracao_minutos: 10, preco_centavos: 8500 }).success).toBe(false);
  });
  it('rejeita intervalo fora do expediente', () => {
    const base = { membro_id: 'x', dia_semana: 1, inicio: '09:00', fim: '18:00' };
    expect(scheduleSchema.safeParse({ ...base, intervalo_inicio: '12:00', intervalo_fim: '13:00' }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...base, intervalo_inicio: '19:00', intervalo_fim: '20:00' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, intervalo_inicio: null, intervalo_fim: null }).success).toBe(true);
  });
  it('bloqueia slugs reservados e formatos inválidos', () => {
    expect(businessSchema.safeParse({ nome: 'Painel', slug: 'painel' }).success).toBe(false);
    expect(businessSchema.safeParse({ nome: 'Studio', slug: 'Studio Beleza' }).success).toBe(false);
    expect(businessSchema.safeParse({ nome: 'Studio', slug: 'studio-beleza' }).success).toBe(true);
  });
  it('exige senha mínima de 8 caracteres no cadastro', () => {
    expect(cadastroSchema.safeParse({ nome: 'Ana', email: 'ana@example.com.br', senha: '1234567' }).success).toBe(false);
    expect(cadastroSchema.safeParse({ nome: 'Ana', email: 'ana@example.com.br', senha: '12345678' }).success).toBe(true);
  });
  it('formata centavos em reais (pt-BR)', () => {
    const normalizar = (v: string) => v.replace(/\u00a0/g, ' ');
    expect(normalizar(moeda(8500))).toBe('R$ 85,00');
    expect(normalizar(moeda(0))).toBe('R$ 0,00');
  });
});
