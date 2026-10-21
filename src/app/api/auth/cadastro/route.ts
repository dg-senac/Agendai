import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { cadastroSchema } from '@/server/validators/auth';
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'O Supabase ainda não foi configurado neste ambiente.' }, { status: 503 });
  const parsed = cadastroSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.senha,
    options: { data: { nome: parsed.data.nome }, emailRedirectTo: `${origin}/api/auth/callback` },
  });
  if (error) return NextResponse.json({ error: error.message.includes('already') ? 'Este e-mail já tem uma conta. Tente entrar.' : 'Não foi possível criar sua conta. Tente novamente.' }, { status: 400 });
  return NextResponse.json({ ok: true, precisaConfirmar: !data.session });
}
