import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';

const corpo = z.object({
  agendamento_id: z.uuid().nullable().default(null),
  tipo: z.enum(['sinal', 'saldo']),
  metodo: z.enum(['pix', 'dinheiro', 'cartao']),
  valor_centavos: z.number().int().positive().max(10000000),
});

/** Registra um recebimento manual (dinheiro/cartão/Pix fora do app). Dono apenas. */
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const { data: me } = await db.from('membros').select('negocio_id, papel').eq('user_id', user.id).single();
  if (!me || me.papel !== 'dono') return NextResponse.json({ error: 'Somente o dono registra recebimentos.' }, { status: 403 });
  const { error } = await db.from('pagamentos').insert({
    negocio_id: me.negocio_id, agendamento_id: parsed.data.agendamento_id, tipo: parsed.data.tipo,
    metodo: parsed.data.metodo, valor_centavos: parsed.data.valor_centavos,
    status: 'pago', pago_em: new Date().toISOString(), provider: 'manual',
  });
  if (error) return NextResponse.json({ error: 'Não foi possível registrar o recebimento.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
