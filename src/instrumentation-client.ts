/**
 * Sentry no navegador: o SDK só é baixado quando existe DSN público.
 * Sem DSN, nenhum byte extra entra no bundle das páginas (meta de peso!).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => {
  });
}
