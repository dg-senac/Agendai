// Edge Function (Fase 4): dispara o job consolidado do app (reservas,
// lembretes, ciclo de assinaturas e envio de e-mails).
// Secrets necessários: APP_URL (ex.: https://agendai.app) e CRON_SECRET.
// Agende a cada minuto via pg_cron + pg_net ou pelo painel do Supabase.
Deno.serve(async () => {
  const res = await fetch(`${Deno.env.get('APP_URL')}/api/cron/jobs`, {
    method: 'POST',
    headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
