import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { onboardingNegocioSchema } from '@/server/validators/auth';
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'O Supabase ainda não foi configurado neste ambiente.' }, { status: 503 });
  const parsed = onboardingNegocioSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para continuar.' }, { status: 401 });
  const { data, error } = await db.rpc('criar_negocio', {
    p_nome: parsed.data.nome, p_slug: parsed.data.slug, p_nome_dono: parsed.data.nomeDono,
    p_telefone: parsed.data.telefone || null, p_cidade: parsed.data.cidade || null,
  });
  if (error) return NextResponse.json({ error: error.message.replace(/^.*?:\s*/, '') || 'Não foi possível criar o negócio.' }, { status: 400 });
  const { data: membro } = await db.from('membros').select('id').eq('negocio_id', data as string).eq('user_id', user.id).single();
  return NextResponse.json({ ok: true, negocioId: data, membroId: membro?.id });
}
