import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components';

const corpo = { backgroundColor: '#f7f8fc', fontFamily: 'Arial, Helvetica, sans-serif' };
const caixa = { backgroundColor: '#ffffff', borderRadius: 16, padding: 36, maxWidth: 520, margin: '32px auto' };
const texto = { fontSize: 14, lineHeight: '24px', color: '#20243c' };
const botao = { backgroundColor: '#4F46E5', color: '#ffffff', borderRadius: 10, padding: '13px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none' };

function Layout({ previa, children }: { previa: string; children: React.ReactNode }) {
  return (
    <Html lang="pt-BR"><Head /><Preview>{previa}</Preview>
      <Body style={corpo}><Container style={caixa}>{children}
        <Hr style={{ borderColor: '#eaecef', margin: '26px 0 16px' }} />
        <Text style={{ fontSize: 12, color: '#7a8094' }}>agendaí. — seu negócio, no seu ritmo. 💜</Text>
      </Container></Body>
    </Html>
  );
}

export function EmailNovoAgendamentoDono(d: { negocio: string; cliente: string; servico: string; profissional: string; quando: string; linkPainel: string }) {
  return (
    <Layout previa={`Novo agendamento no ${d.negocio}: ${d.cliente}, ${d.quando}`}>
      <Heading as="h1" style={{ fontSize: 23 }}>Novo agendamento! 📅</Heading>
      <Text style={texto}><strong>{d.cliente}</strong> agendou <strong>{d.servico}</strong> com {d.profissional} para <strong>{d.quando}</strong>.</Text>
      <Button href={d.linkPainel} style={botao}>Ver na minha agenda</Button>
    </Layout>
  );
}

export function EmailTrialAcabando(d: { negocio: string; dias: number; linkPlanos: string }) {
  return (
    <Layout previa={`Seu trial Pro do Agendaí termina em ${d.dias} ${d.dias === 1 ? 'dia' : 'dias'}`}>
      <Heading as="h1" style={{ fontSize: 23 }}>Seu trial Pro está acabando ⏳</Heading>
      <Text style={texto}>Faltam <strong>{d.dias} {d.dias === 1 ? 'dia' : 'dias'}</strong> para o período gratuito do <strong>{d.negocio}</strong> terminar. Assine o Pro por <strong>R$ 29,90/mês</strong> e continue com agendamentos ilimitados, sinal via Pix e lembretes automáticos — sem perder nada do que você configurou.</Text>
      <Button href={d.linkPlanos} style={botao}>Assinar agora</Button>
      <Text style={{ ...texto, fontSize: 12, color: '#7a8094' }}>Sem assinatura, sua conta volta ao plano Grátis (1 profissional e 30 agendamentos/mês). Seus dados continuam salvos.</Text>
    </Layout>
  );
}

export function EmailCobrancaFalhou(d: { negocio: string; linkPlanos: string }) {
  return (
    <Layout previa="Não conseguimos cobrar sua assinatura do Agendaí">
      <Heading as="h1" style={{ fontSize: 23 }}>Hmm, a cobrança não passou 💳</Heading>
      <Text style={texto}>Não conseguimos cobrar a assinatura do <strong>{d.negocio}</strong>. Você tem <strong>7 dias de carência</strong> com tudo funcionando — depois disso, os recursos pagos pausam até a regularização.</Text>
      <Button href={d.linkPlanos} style={botao}>Regularizar minha assinatura</Button>
    </Layout>
  );
}
