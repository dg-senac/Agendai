/** Reporta um erro do cliente ao Sentry — se (e somente se) houver DSN. */
export async function relatarErro(erro: unknown): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(erro);
  } catch {
    /* monitoramento nunca pode quebrar a experiência */
  }
}
