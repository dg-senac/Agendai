import 'server-only';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/render';

export type AnexoEmail = { filename: string; content: string };
export type ResultadoEnvio = { id: string; simulado: boolean };

/**
 * Envia e-mail via Resend quando há RESEND_API_KEY; sem chave, simula com log
 * estruturado (demonstração/dev) — o chamador registra em `notificacoes`.
 */
export async function enviarEmail(opts: { para: string; assunto: string; react: ReactElement; anexos?: AnexoEmail[] }): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Agendaí <lembretes@agendai.app>';
  if (!apiKey) {
    console.info(JSON.stringify({ nivel: 'info', evento: 'email_simulado', para: opts.para, assunto: opts.assunto }));
    return { id: `sim-${Date.now()}`, simulado: true };
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: opts.para,
    subject: opts.assunto,
    react: opts.react,
    attachments: opts.anexos?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'utf8') })),
  });
  if (error || !data) throw new Error(error?.message ?? 'Falha ao enviar o e-mail.');
  return { id: data.id, simulado: false };
}

export const renderizarHtml = (elemento: ReactElement) => render(elemento);
