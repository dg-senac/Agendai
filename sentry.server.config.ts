import * as Sentry from '@sentry/nextjs';

// Servidor (Node): só liga com DSN. Sem PII por padrão — nada de dados de cliente.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
