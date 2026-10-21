import 'server-only';
import { MercadoPagoProvider } from './mercado-pago';
import { PagamentoSimulado } from './simulado';
import type { PaymentProvider } from './types';

export type { PaymentProvider, CobrancaPix } from './types';
export { validarAssinaturaWebhookMp } from './mercado-pago';

/** Provedor de um negócio: token próprio do MP ou simulação (demonstração). */
export const provedorDoNegocio = (mpAccessToken?: string | null): PaymentProvider =>
  mpAccessToken ? new MercadoPagoProvider(mpAccessToken) : new PagamentoSimulado();

/** Provedor da plataforma Agendaí (assinatura do SaaS). */
export const provedorDaPlataforma = (): PaymentProvider =>
  process.env.MERCADOPAGO_ACCESS_TOKEN ? new MercadoPagoProvider(process.env.MERCADOPAGO_ACCESS_TOKEN) : new PagamentoSimulado();
