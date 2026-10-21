import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';

const regras = z.object({
  config_sinal_percentual: z.number().int().min(0).max(100),
  config_antecedencia_minima_horas: z.number().int().min(0).max(168),
  config_cancelamento_limite_horas: z.number().int().min(0).max(168),
  config_estorno_cliente_no_prazo: z.boolean(),
  config_faltas_sinal_obrigatorio: z.number().int().min(1).max(20).nullable(),
});

export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = regras.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const { data: me } = await db.from('membros').select('negocio_id, papel').eq('user_id', user.id).single();
  if (!me || me.papel !== 'dono') return NextResponse.json({ error: 'Somente o dono altera as regras.' }, { status: 403 });
  const { error } = await db.from('negocios').update(parsed.data).eq('id', me.negocio_id);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar as regras.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
