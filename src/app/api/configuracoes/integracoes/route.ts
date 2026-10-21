import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';

export async function GET() {
  if (!configured()) return NextResponse.json({ conectado: false, demo: true });
  const db = await supabase();
  const { data } = await db.rpc('integracao_mp_status');
  return NextResponse.json(data ?? { conectado: false });
}

const corpo = z.object({ mp_access_token: z.string().max(400), mp_public_key: z.string().max(400).optional() });
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const db = await supabase();
  const { data, error } = await db.rpc('salvar_credenciais_mp', { p_token: parsed.data.mp_access_token, p_public_key: parsed.data.mp_public_key ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
