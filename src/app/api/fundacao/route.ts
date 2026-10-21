import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { businessSchema, serviceSchema, memberSchema, scheduleSchema } from '@/server/validators/foundation';

const envelope = z.object({
  collection: z.enum(['business', 'services', 'members', 'schedules']),
  payload: z.unknown(),
  id: z.uuid().optional(),
});

type Erro = { error: string };
const erro = (mensagem: string, status: number) => NextResponse.json<Erro>({ error: mensagem }, { status });

async function mutate(req: NextRequest) {
  const csrf = sameOrigin(req);
  if (csrf) return csrf;
  if (!configured()) return erro('Supabase não configurado neste ambiente.', 503);

  const body = envelope.safeParse(await req.json().catch(() => null));
  if (!body.success) return erro('Solicitação inválida.', 400);
  const { collection, payload, id } = body.data;

  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return erro('Entre na sua conta para continuar.', 401);

  // Apenas o DONO altera configurações da fundação (o RLS reforça no banco).
  const { data: me } = await db
    .from('membros').select('negocio_id, papel')
    .eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).single();
  if (!me || me.papel !== 'dono') return erro('Somente o dono pode alterar estas configurações.', 403);
  const negocioId = me.negocio_id as string;

  // ── Exclusão (soft delete onde faz sentido) ────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id || collection === 'business') return erro('Registro inválido.', 400);
    if (collection === 'members') {
      const { data: alvo } = await db.from('membros').select('papel').eq('id', id).eq('negocio_id', negocioId).single();
      if (!alvo) return erro('Profissional não encontrado.', 404);
      if (alvo.papel === 'dono') return erro('O proprietário do negócio não pode ser removido.', 400);
    }
    const agora = new Date().toISOString();
    const result =
      collection === 'schedules'
        ? await db.from('horarios_trabalho').delete().eq('id', id).eq('negocio_id', negocioId)
        : collection === 'services'
          ? await db.from('servicos').update({ deleted_at: agora, ativo: false }).eq('id', id).eq('negocio_id', negocioId)
          : await db.from('membros').update({ deleted_at: agora, ativo: false }).eq('id', id).eq('negocio_id', negocioId);
    if (result.error) return erro('Não foi possível remover. Tente novamente.', 400);
    return NextResponse.json({ ok: true });
  }

  // ── Criação / atualização validadas com Zod ───────────────────────────────
  if (collection === 'business') {
    const parsed = businessSchema.safeParse(payload);
    if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
    const { error } = await db.from('negocios').update(parsed.data).eq('id', negocioId);
    if (error) return erro(error.code === '23505' ? 'Este endereço já está em uso.' : 'Não foi possível salvar.', 400);
    return NextResponse.json({ ok: true });
  }

  if (collection === 'services') {
    const parsed = serviceSchema.safeParse(payload);
    if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
    const values = { ...parsed.data, negocio_id: negocioId };
    const { error } = id
      ? await db.from('servicos').update(values).eq('id', id).eq('negocio_id', negocioId)
      : await db.from('servicos').insert(values);
    if (error) return erro('Não foi possível salvar o serviço.', 400);
    return NextResponse.json({ ok: true });
  }

  if (collection === 'members') {
    const parsed = memberSchema.safeParse(payload);
    if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
    if (parsed.data.papel === 'dono') {
      // Só é permitido editar o próprio registro de dono; nunca criar outro.
      const { data: alvo } = id
        ? await db.from('membros').select('user_id').eq('id', id).eq('negocio_id', negocioId).single()
        : { data: null };
      if (!alvo || alvo.user_id !== user.id) return erro('Não é permitido criar outro proprietário.', 403);
    }
    const values = { ...parsed.data, negocio_id: negocioId };
    const { error } = id
      ? await db.from('membros').update(values).eq('id', id).eq('negocio_id', negocioId)
      : await db.from('membros').insert(values);
    if (error) return erro('Não foi possível salvar o profissional.', 400);
    return NextResponse.json({ ok: true });
  }

  // schedules
  const parsed = scheduleSchema.safeParse(payload);
  if (!parsed.success) return erro(parsed.error.issues[0].message, 400);
  const { data: membro } = await db.from('membros').select('id').eq('id', parsed.data.membro_id).eq('negocio_id', negocioId).single();
  if (!membro) return erro('Profissional não pertence ao seu negócio.', 400);
  const values = { ...parsed.data, negocio_id: negocioId };
  const { error } = id
    ? await db.from('horarios_trabalho').update(values).eq('id', id).eq('negocio_id', negocioId)
    : await db.from('horarios_trabalho').insert(values);
  if (error) return erro(error.code === '23505' ? 'Já existe um horário para este dia da semana.' : 'Não foi possível salvar o horário.', 400);
  return NextResponse.json({ ok: true });
}

export const POST = mutate;
export const DELETE = mutate;
