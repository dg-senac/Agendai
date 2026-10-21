import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CobrancaPix, PaymentProvider, StatusPagamentoProvedor } from './types';

const API = 'https://api.mercadopago.com';

function mapearStatus(mp: string): StatusPagamentoProvedor {
  switch (mp) {
    case 'approved': return 'aprovado';
    case 'refunded': return 'estornado';
    case 'cancelled': return 'cancelado';
    case 'rejected': return 'rejeitado';
    default: return 'pendente'; // pending, in_process, authorized...
  }
}

type RespostaPagamentoMp = {
  id: number | string;
  status: string;
  transaction_amount: number;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  date_of_expiration?: string;
};

/** Implementação real via API REST do Mercado Pago (Checkout Transparente/Pix). */
export class MercadoPagoProvider implements PaymentProvider {
  readonly nome = 'mercado_pago';
  readonly simulado = false;

  constructor(private readonly accessToken: string) {}

  private async chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status} em ${caminho}.`);
    return (await res.json()) as T;
  }

  async criarCobrancaPix(entrada: Parameters<PaymentProvider['criarCobrancaPix']>[0]): Promise<CobrancaPix> {
    const expira = new Date(Date.now() + (entrada.expiraEmMinutos ?? 10) * 60_000);
    const pagamento = await this.chamar<RespostaPagamentoMp>('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `agendai-${entrada.referenciaExterna}` },
      body: JSON.stringify({
        transaction_amount: entrada.valorCentavos / 100,
        description: entrada.descricao,
        payment_method_id: 'pix',
        payer: { email: entrada.emailPagador || 'cliente@agendai.app' },
        external_reference: entrada.referenciaExterna,
        notification_url: entrada.notificationUrl,
        date_of_expiration: expira.toISOString(),
      }),
    });
    const dados = pagamento.point_of_interaction?.transaction_data;
    if (!dados?.qr_code) throw new Error('O Mercado Pago não retornou o código Pix.');
    return {
      provider: this.nome,
      providerId: String(pagamento.id),
      copiaCola: dados.qr_code,
      qrBase64: dados.qr_code_base64 ?? null,
      expiraEm: pagamento.date_of_expiration ?? expira.toISOString(),
      simulado: false,
    };
  }

  async consultarPagamento(providerId: string) {
    const pagamento = await this.chamar<RespostaPagamentoMp>(`/v1/payments/${encodeURIComponent(providerId)}`);
    return { status: mapearStatus(pagamento.status), valorCentavos: Math.round(pagamento.transaction_amount * 100) };
  }

  async estornar(providerId: string, valorCentavos?: number): Promise<void> {
    await this.chamar(`/v1/payments/${encodeURIComponent(providerId)}/refunds`, {
      method: 'POST',
      body: JSON.stringify(valorCentavos ? { amount: valorCentavos / 100 } : {}),
    });
  }

  async criarCheckoutAssinatura(entrada: Parameters<PaymentProvider['criarCheckoutAssinatura']>[0]) {
    // Assinatura recorrente (preapproval) sem plano pré-criado: gera link de checkout.
    const pre = await this.chamar<{ id: string; init_point?: string }>('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: entrada.motivo,
        external_reference: entrada.referenciaExterna,
        payer_email: entrada.emailPagador,
        back_url: entrada.backUrl,
        status: 'pending',
        auto_recurring: {
          frequency: 1, frequency_type: 'months', currency_id: 'BRL',
          transaction_amount: entrada.valorCentavos / 100,
          start_date: new Date().toISOString(),
        },
      }),
    });
    return { checkoutUrl: pre.init_point ?? null, providerSubscriptionId: pre.id ?? null };
  }
}

/**
 * Valida a assinatura do webhook do Mercado Pago (x-signature / x-request-id).
 * Manifesto: "id:{data.id};request-id:{x-request-id};ts:{ts};" com HMAC-SHA256.
 */
export function validarAssinaturaWebhookMp(opts: { secret: string; xSignature: string | null; xRequestId: string | null; dataId: string }): boolean {
  if (!opts.xSignature) return false;
  const partes = Object.fromEntries(opts.xSignature.split(',').map((p) => {
    const [k, ...resto] = p.trim().split('=');
    return [k, resto.join('=')];
  }));
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const manifesto = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId ?? ''};ts:${ts};`;
  const esperado = createHmac('sha256', opts.secret).update(manifesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
