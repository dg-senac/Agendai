import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { entrarSchema } from '@/server/validators/auth';
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'O Supabase ainda não foi configurado neste ambiente.' }, { status: 503 });
  const parsed = entrarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  if (error) return NextResponse.json({ error: 'E-mail ou senha incorretos. Confira e tente de novo.' }, { status: 401 });
  return NextResponse.json({ ok: true });
}
