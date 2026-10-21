import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';

const corpo = z.object({
  id: z.uuid(),
  publica: z.boolean().optional(),
  resposta: z.string().max(1000).nullable().optional(),
});

/** Dono responde e/ou publica uma avaliação (RLS reforça). */
export async function PATCH(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const updates: Record<string, unknown> = {};
  if (parsed.data.publica !== undefined) updates.publica = parsed.data.publica;
  if (parsed.data.resposta !== undefined) {
    updates.resposta = parsed.data.resposta;
    updates.respondida_em = parsed.data.resposta ? new Date().toISOString() : null;
  }
  const { error } = await db.from('avaliacoes').update(updates).eq('id', parsed.data.id);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
