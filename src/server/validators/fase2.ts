import { z } from 'zod';

const dataHora = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data/hora inválida.');

export const agendamentoPublicoSchema = z.object({
  slug: z.string().min(3).max(60),
  servico_id: z.uuid(),
  membro_id: z.uuid().nullable().default(null),
  inicio: dataHora,
  nome: z.string().trim().min(2, 'Informe seu nome.').max(100),
  whatsapp: z.string().min(10, 'Informe um WhatsApp válido com DDD.').max(20),
  email: z.union([z.email('Informe um e-mail válido.'), z.literal('')]).default(''),
  observacoes: z.string().max(500).default(''),
  consentimento: z.literal(true, { error: 'É necessário autorizar o uso dos seus dados (LGPD).' }),
});

export const tokenAcaoSchema = z.discriminatedUnion('acao', [
  z.object({ token: z.string().min(10), acao: z.literal('cancelar') }),
  z.object({ token: z.string().min(10), acao: z.literal('remarcar'), novo_inicio: dataHora }),
]);

export const clientSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente.').max(100),
  whatsapp: z.string().transform((v) => v.replace(/\D/g, '')).pipe(z.string().min(10, 'Informe um WhatsApp válido com DDD.').max(13)),
  email: z.union([z.email('Informe um e-mail válido.'), z.literal('')]).default(''),
  observacoes: z.string().max(1000).default(''),
});

export const blockSchema = z.object({
  membro_id: z.uuid(),
  inicio_ts: dataHora,
  fim_ts: dataHora,
  motivo: z.string().max(200).default(''),
}).refine((v) => v.fim_ts > v.inicio_ts, 'O fim do bloqueio deve ser depois do início.');

export const memberServicesSchema = z.object({
  membro_id: z.uuid(),
  servico_ids: z.array(z.uuid()).max(200),
});

export const agendamentoPainelSchema = z.object({
  cliente_id: z.uuid().optional(),
  novo_cliente: z.object({ nome: z.string().trim().min(2).max(100), whatsapp: z.string().min(10).max(20) }).optional(),
  membro_id: z.uuid(),
  servico_id: z.uuid(),
  inicio_ts: dataHora,
  observacoes: z.string().max(500).default(''),
}).refine((v) => v.cliente_id || v.novo_cliente, 'Escolha um cliente ou cadastre um novo.');

export const agendamentoPatchSchema = z.object({
  id: z.uuid(),
  status: z.enum(['confirmado', 'concluido', 'cancelado', 'faltou', 'pendente_pagamento']).optional(),
  inicio_ts: dataHora.optional(),
});
