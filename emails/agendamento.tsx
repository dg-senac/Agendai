import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

export type DadosEmailAgendamento = {
  negocio: string; cor?: string; cliente: string; servico: string; profissional: string;
  quando: string; endereco?: string | null; linkGerenciar: string; precoFormatado?: string;
};

const base = (cor: string) => ({
  corpo: { backgroundColor: '#f7f8fc', fontFamily: 'Arial, Helvetica, sans-serif' },
  caixa: { backgroundColor: '#ffffff', borderRadius: 16, padding: 36, maxWidth: 520, margin: '32px auto' },
  botao: { backgroundColor: cor, color: '#ffffff', borderRadius: 10, padding: '13px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none' },
  texto: { fontSize: 14, lineHeight: '24px', color: '#20243c' },
  muda: { fontSize: 12, lineHeight: '20px', color: '#7a8094' },
});

function Layout({ previa, cor, children }: { previa: string; cor: string; children: React.ReactNode }) {
  return (
    <Html lang="pt-BR"><Head /><Preview>{previa}</Preview>
      <Body style={base(cor).corpo}><Container style={base(cor).caixa}>
        {children}
        <Hr style={{ borderColor: '#eaecef', margin: '26px 0 16px' }} />
        <Text style={base(cor).muda}>Agendamento online com agendaí. 💜<br />Se você não reconhece este agendamento, pode ignorar este e-mail.</Text>
      </Container></Body>
    </Html>
  );
}

export function EmailConfirmacao(d: DadosEmailAgendamento) {
  const cor = d.cor ?? '#4F46E5'; const s = base(cor);
  return (
    <Layout previa={`Seu horário no ${d.negocio} está confirmado`} cor={cor}>
      <Heading as="h1" style={{ fontSize: 23 }}>Horário confirmado, {d.cliente.split(' ')[0]}! 🎉</Heading>
      <Text style={s.texto}>Estamos te esperando no <strong>{d.negocio}</strong>:</Text>
      <Section style={{ background: '#f7f8fc', borderRadius: 12, padding: 18 }}>
        <Text style={s.texto}><strong>{d.servico}</strong> com {d.profissional}<br />📅 {d.quando}{d.endereco ? <><br />📍 {d.endereco}</> : null}{d.precoFormatado ? <><br />💰 {d.precoFormatado}</> : null}</Text>
      </Section>
      <Text style={s.texto}>Anexamos o arquivo <strong>.ics</strong> para você adicionar ao seu calendário com 1 toque.</Text>
      <Button href={d.linkGerenciar} style={s.botao}>Ver, remarcar ou cancelar meu horário</Button>
    </Layout>
  );
}

export function EmailLembrete(d: DadosEmailAgendamento & { falta: string }) {
  const cor = d.cor ?? '#4F46E5'; const s = base(cor);
  return (
    <Layout previa={`Lembrete: seu horário no ${d.negocio} é ${d.falta}`} cor={cor}>
      <Heading as="h1" style={{ fontSize: 23 }}>É {d.falta}, {d.cliente.split(' ')[0]}! ⏰</Heading>
      <Text style={s.texto}>Passando para lembrar do seu <strong>{d.servico}</strong> com {d.profissional} no <strong>{d.negocio}</strong>:</Text>
      <Section style={{ background: '#f7f8fc', borderRadius: 12, padding: 18 }}>
        <Text style={s.texto}>📅 {d.quando}{d.endereco ? <><br />📍 {d.endereco}</> : null}</Text>
      </Section>
      <Text style={s.texto}>Surgiu um imprevisto? Sem problema — remarque pelo botão abaixo (respeitando o prazo do negócio).</Text>
      <Button href={d.linkGerenciar} style={s.botao}>Gerenciar meu horário</Button>
    </Layout>
  );
}

export function EmailCancelamento(d: DadosEmailAgendamento) {
  const cor = d.cor ?? '#4F46E5'; const s = base(cor);
  return (
    <Layout previa={`Seu horário no ${d.negocio} foi cancelado`} cor={cor}>
      <Heading as="h1" style={{ fontSize: 23 }}>Agendamento cancelado</Heading>
      <Text style={s.texto}>Oi, {d.cliente.split(' ')[0]}. O horário de <strong>{d.servico}</strong> em {d.quando} no <strong>{d.negocio}</strong> foi cancelado.</Text>
      <Text style={s.texto}>Se havia sinal pago, o estorno segue a política do negócio e cai de volta via Pix quando aplicável. Quando quiser, será um prazer te receber de novo.</Text>
      <Button href={d.linkGerenciar} style={s.botao}>Ver detalhes</Button>
    </Layout>
  );
}

export function EmailPosAtendimento(d: DadosEmailAgendamento) {
  const cor = d.cor ?? '#4F46E5'; const s = base(cor);
  return (
    <Layout previa={`Como foi seu atendimento no ${d.negocio}?`} cor={cor}>
      <Heading as="h1" style={{ fontSize: 23 }}>E aí, {d.cliente.split(' ')[0]}, como foi? ⭐</Heading>
      <Text style={s.texto}>Esperamos que tenha adorado o <strong>{d.servico}</strong> com {d.profissional}. Sua avaliação leva menos de 1 minuto e ajuda o {d.negocio} a cuidar ainda melhor de você (e de quem vier depois).</Text>
      <Button href={d.linkGerenciar} style={s.botao}>Avaliar meu atendimento</Button>
    </Layout>
  );
}
