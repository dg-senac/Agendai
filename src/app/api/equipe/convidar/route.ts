import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sameOrigin } from '@/server/security';

const corpo = z.object({ nome: z.string().trim().min(2).max(100), email: z.email('Informe um e-mail válido.') });

/** Convida um profissional: cria o acesso (Supabase Auth) e o vínculo no negócio. */
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const { data: me } = await db.from('membros').select('negocio_id, papel').eq('user_id', user.id).single();
  if (!me || me.papel !== 'dono') return NextResponse.json({ error: 'Somente o dono convida a equipe.' }, { status: 403 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sem service_role para enviar convites.' }, { status: 503 });

  const origem = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const convite = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { nome: parsed.data.nome },
    redirectTo: `${origem}/api/auth/callback`,
  });
  let userId = convite.data.user?.id ?? null;
  if (convite.error) {
    // E-mail já tem conta: localiza o usuário para vincular mesmo assim.
    const lista = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = lista.data.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase())?.id ?? null;
    if (!userId) return NextResponse.json({ error: 'Não foi possível enviar o convite para este e-mail.' }, { status: 400 });
  }
  const { error } = await db.from('membros').insert({
    negocio_id: me.negocio_id, user_id: userId, papel: 'profissional',
    nome: parsed.data.nome, email: parsed.data.email, ativo: true,
  });
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Esta pessoa já está vinculada a um negócio.' : 'Não foi possível adicionar à equipe.' }, { status: 400 });
  return NextResponse.json({ ok: true, conviteEnviado: !convite.error });
}
