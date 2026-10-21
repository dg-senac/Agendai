export const metadata = { title: 'Política de Privacidade — Agendaí' };
const secoes: Array<[string, string]> = [
  ['Quais dados coletamos', 'Do dono do negócio: nome, e-mail e dados do estabelecimento. Dos clientes que agendam: nome, WhatsApp e e-mail, sempre com consentimento explícito no formulário (LGPD, art. 7º, I). Dados de pagamento são processados pelo Mercado Pago; não armazenamos números de cartão.'],
  ['Para que usamos', 'Confirmar, lembrar e permitir remarcar/cancelar agendamentos; operar a assinatura do SaaS; e gerar os relatórios do próprio negócio. Nunca vendemos dados pessoais.'],
  ['Compartilhamento', 'Apenas com operadores essenciais: Supabase (banco de dados/autenticação), Mercado Pago (pagamentos) e Resend (e-mails). Cada negócio enxerga somente os próprios clientes.'],
  ['Seus direitos (LGPD)', 'Clientes podem pedir acesso, correção, exportação e exclusão dos dados diretamente ao negócio onde agendaram — o painel do Agendaí já oferece exportar e excluir com dois cliques. Donos podem encerrar a conta e solicitar a exclusão definitiva.'],
  ['Segurança', 'Acesso isolado por negócio (Row Level Security), conexões criptografadas, segredos apenas no servidor e registro de auditoria das ações sensíveis.'],
  ['Contato', 'Dúvidas sobre privacidade: privacidade@agendai.app. Esta política é um modelo inicial e será revisada por assessoria jurídica antes do lançamento comercial.'],
];
export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: 'auto', padding: '60px 22px 90px' }}>
      <p className="eyebrow">AGENDAÍ</p>
      <h1 style={{ fontSize: 34, fontWeight: 800, marginTop: 10 }}>Política de Privacidade</h1>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>Última atualização: 21 de outubro de 2026.</p>
      {secoes.map(([t, d]) => (
        <section key={t}><h2 style={{ fontSize: 18, fontWeight: 750, marginTop: 34 }}>{t}</h2><p className="muted" style={{ lineHeight: 1.85, marginTop: 10, fontSize: 14 }}>{d}</p></section>
      ))}
    </main>
  );
}
