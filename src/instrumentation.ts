import * as Sentry from '@sentry/nextjs';

/** Inicializa o monitoramento no servidor conforme o runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('../sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('../sentry.edge.config');
}

/** Erros de rotas/RSC sobem para o Sentry (quando configurado). */
export const onRequestError = Sentry.captureRequestError;
