import { NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase as criarSupabase } from '@/lib/supabase/server';

const schema = z.object({ negocioId: z.uuid(), suspenso: z.boolean() });

/** Suspende/reativa um negócio (somente super admin, validado na RPC). */
export async function POST(request: Request) {
  if (!configured()) return NextResponse.json({ erro: 'Administração disponível no modo conectado.' }, { status: 503 });
  const supabase = await criarSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Faça login para continuar.' }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 422 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o negócio e a ação.' }, { status: 422 });
  const { error } = await supabase.rpc('admin_definir_suspensao', { p_negocio: parsed.data.negocioId, p_suspenso: parsed.data.suspenso });
  if (error) return NextResponse.json({ erro: 'Não foi possível aplicar (acesso restrito ao super admin).' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
