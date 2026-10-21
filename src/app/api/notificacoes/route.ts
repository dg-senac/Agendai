import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';

/** Marca um lembrete de WhatsApp como enviado (clique do dono). */
export async function PATCH(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return NextResponse.json({ error: 'Supabase não configurado neste ambiente.' }, { status: 503 });
  const parsed = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
  const db = await supabase();
  const { error } = await db.from('notificacoes')
    .update({ status: 'enviada', enviada_em: new Date().toISOString() })
    .eq('id', parsed.data.id).eq('canal', 'whatsapp_link');
  if (error) return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
