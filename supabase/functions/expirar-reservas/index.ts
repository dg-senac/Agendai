// Edge Function (Fase 3): libera horários de Pix não pagos.
// Agende no Supabase com pg_cron + pg_net a cada minuto (instruções no README
// da Fase 4). Requer os secrets SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('nao autorizado', { status: 401 });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.rpc('expirar_reservas');
  return new Response(JSON.stringify(error ? { erro: error.message } : data), {
    status: error ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
