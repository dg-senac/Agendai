import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { processarFilaNotificacoes } from '@/server/notificacoes';

/**
 * Job consolidado (chamar a cada minuto via pg_cron/pg_net, Edge Function ou
 * cron externo): expira reservas, enfileira lembretes, roda o ciclo de
 * assinaturas e envia os e-mails da fila.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sem service_role.' }, { status: 503 });
  const [reservas, fila, ciclo] = await Promise.all([
    admin.rpc('expirar_reservas'),
    admin.rpc('enfileirar_notificacoes'),
    admin.rpc('processar_ciclo_assinaturas'),
  ]);
  const envio = await processarFilaNotificacoes();
  return NextResponse.json({
    reservas: reservas.data ?? null,
    enfileiradas: fila.data ?? null,
    ciclo: ciclo.data ?? null,
    emails: envio,
  });
}
