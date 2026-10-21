import type { Metadata } from 'next';
import { Landing } from '@/components/landing';

export const metadata: Metadata = {
  title: 'Agendaí — Agendamento online com Pix para pequenos negócios',
  description: 'Sua página de agendamento própria: o cliente escolhe o horário, paga o sinal via Pix e recebe lembretes automáticos. 14 dias de Pro grátis, sem cartão.',
  openGraph: {
    title: 'Agendaí — Seu negócio, no seu ritmo',
    description: 'Pare de agendar pelo WhatsApp. Página própria, sinal via Pix e agenda sem furos para barbearias, salões, manicures, personal e clínicas.',
    type: 'website', locale: 'pt_BR', siteName: 'Agendaí',
  },
  alternates: { canonical: '/' },
};

export default function Page() {
  return <Landing />;
}
