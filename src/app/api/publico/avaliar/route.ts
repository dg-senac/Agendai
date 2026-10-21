import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { dentroDoLimite, ipDaRequisicao } from '@/server/rate-limit';

const corpo = z.object({
  token: z.string().min(10),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(1000).default(''),
});

export async function POST(req: NextRequest) {
  if (!dentroDoLimite(`avaliar:${ipDaRequisicao(req)}`, 10, 60_000)) return NextResponse.json({ error: 'Muitas tentativas seguidas.' }, { status: 429 });
  if (!configured()) return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { error } = await db.rpc('avaliar_agendamento', {
    p_token: parsed.data.token, p_nota: parsed.data.nota, p_comentario: parsed.data.comentario || null,
  });
  if (error) {
    const msg = error.message.match(/[A-ZÁÉÍÓÚ][^.]+\./)?.[0] ?? 'Não foi possível registrar a avaliação.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
