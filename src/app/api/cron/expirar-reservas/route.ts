import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Libera horários de Pix não pagos. Chamado pelo pg_cron/Edge Function (Fase 4). */
export async function POST(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sem service_role.' }, { status: 503 });
  const { data, error } = await admin.rpc('expirar_reservas');
  if (error) return NextResponse.json({ error: 'Falha ao expirar reservas.' }, { status: 500 });
  return NextResponse.json(data);
}
