// Abstração de provedor de pagamentos: trocar Mercado Pago por Stripe (ou outro)
// não deve tocar no restante do sistema — só implementar esta interface.
export type CobrancaPix = {
  provider: string;
  providerId: string;
  copiaCola: string;
  qrBase64: string | null;
  expiraEm: string;
  simulado: boolean;
};

export type StatusPagamentoProvedor = 'aprovado' | 'pendente' | 'rejeitado' | 'cancelado' | 'estornado';

export interface PaymentProvider {
  readonly nome: string;
  readonly simulado: boolean;
  criarCobrancaPix(entrada: {
    valorCentavos: number;
    descricao: string;
    emailPagador?: string | null;
    referenciaExterna: string; // id do nosso pagamento/agendamento (idempotência)
    expiraEmMinutos?: number;
    notificationUrl?: string;
  }): Promise<CobrancaPix>;
  consultarPagamento(providerId: string): Promise<{ status: StatusPagamentoProvedor; valorCentavos: number }>;
  estornar(providerId: string, valorCentavos?: number): Promise<void>;
  criarCheckoutAssinatura(entrada: {
    motivo: string;
    valorCentavos: number;
    emailPagador: string;
    referenciaExterna: string; // negocio_id
    backUrl: string;
  }): Promise<{ checkoutUrl: string | null; providerSubscriptionId: string | null }>;
}
