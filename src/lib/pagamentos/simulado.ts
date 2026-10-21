import type { CobrancaPix, PaymentProvider } from './types';

/** Copia e cola claramente simulado (demonstração / sem credenciais). */
export const gerarCopiaEColaSimulada = (valorCentavos: number, referencia: string) =>
  `000201SIMULADO-AGENDAI-NAO-PAGUE520400005303986540${String(valorCentavos).length}${valorCentavos}5802BR5913AGENDAI DEMO6009RECIFE62290525${referencia.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}6304SIMU`;

/** Provedor de faz-de-conta: permite testar todo o fluxo sem dinheiro real. */
export class PagamentoSimulado implements PaymentProvider {
  readonly nome = 'simulado';
  readonly simulado = true;

  async criarCobrancaPix(entrada: Parameters<PaymentProvider['criarCobrancaPix']>[0]): Promise<CobrancaPix> {
    const expira = new Date(Date.now() + (entrada.expiraEmMinutos ?? 10) * 60_000);
    return {
      provider: this.nome,
      providerId: `sim-${entrada.referenciaExterna}`,
      copiaCola: gerarCopiaEColaSimulada(entrada.valorCentavos, entrada.referenciaExterna),
      qrBase64: null, // a interface gera o QR a partir do copia e cola
      expiraEm: expira.toISOString(),
      simulado: true,
    };
  }

  async consultarPagamento() {
    return { status: 'pendente' as const, valorCentavos: 0 };
  }

  async estornar() { /* simulação: sucesso imediato */ }

  async criarCheckoutAssinatura() {
    return { checkoutUrl: null, providerSubscriptionId: null }; // demo: ativa na hora
  }
}
