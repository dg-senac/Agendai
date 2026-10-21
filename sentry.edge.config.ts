import * as Sentry from '@sentry/nextjs';

// Edge (middleware): mesma regra — desligado sem DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
