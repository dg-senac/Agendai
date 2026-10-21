export const metadata = { title: 'Termos de Uso — Agendaí' };
const secoes: Array<[string, string]> = [
  ['O serviço', 'O Agendaí é uma plataforma de agendamento online por assinatura (SaaS) para pequenos negócios. Cada negócio é responsável pelos serviços, preços e atendimentos que oferece aos seus clientes.'],
  ['Planos e pagamento', 'Planos Grátis, Pro (R$ 29,90/mês) e Premium (R$ 59,90/mês), com trial de 14 dias do Pro. A cobrança recorrente é processada pelo Mercado Pago; em caso de falha, há 7 dias de carência antes da pausa dos recursos pagos. Você pode cancelar quando quiser, sem multa.'],
  ['Sinais via Pix', 'Os sinais pagos pelos clientes vão direto para a conta Mercado Pago do negócio. Estornos seguem as regras configuradas pelo próprio negócio (prazo de cancelamento e devolução).'],
  ['Responsabilidades', 'Mantemos a plataforma com o melhor esforço de disponibilidade e segurança, mas não respondemos por indisponibilidades de terceiros (provedores de pagamento, e-mail ou hospedagem) nem pela relação comercial entre negócio e cliente final.'],
  ['Encerramento', 'Contas suspensas por uso indevido (fraude, spam, conteúdo ilegal) podem ser encerradas mediante aviso. Estes termos são um modelo inicial e serão revisados juridicamente antes do lançamento comercial.'],
];
export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: 'auto', padding: '60px 22px 90px' }}>
      <p className="eyebrow">AGENDAÍ</p>
      <h1 style={{ fontSize: 34, fontWeight: 800, marginTop: 10 }}>Termos de Uso</h1>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>Última atualização: 21 de outubro de 2026.</p>
      {secoes.map(([t, d]) => (
        <section key={t}><h2 style={{ fontSize: 18, fontWeight: 750, marginTop: 34 }}>{t}</h2><p className="muted" style={{ lineHeight: 1.85, marginTop: 10, fontSize: 14 }}>{d}</p></section>
      ))}
    </main>
  );
}
