import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
import { provedorDaPlataforma } from '@/lib/pagamentos';
import { PLANOS, type PlanoId } from '@/lib/planos';

const erro = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });
const corpo = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('alterar'), plano: z.enum(['gratis', 'pro', 'premium']) }),
  z.object({ acao: z.literal('cancelar') }),
]);

export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (!configured()) return erro('Supabase não configurado neste ambiente.', 503);
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return erro('Solicitação inválida.', 400);
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return erro('Entre na sua conta para continuar.', 401);

  if (parsed.data.acao === 'cancelar') {
    const { error } = await db.rpc('cancelar_assinatura');
    if (error) return erro('Não foi possível cancelar agora.', 400);
    return NextResponse.json({ ok: true });
  }

  const plano = parsed.data.plano as PlanoId;
  if (plano === 'gratis') {
    const { error } = await db.rpc('alterar_plano', { p_plano: 'gratis' });
    if (error) return erro(error.message, 400);
    return NextResponse.json({ ok: true });
  }

  const { data: me } = await db.from('membros').select('negocio_id').eq('user_id', user.id).single();
  if (!me) return erro('Negócio não encontrado.', 404);
  const provedor = provedorDaPlataforma();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const checkout = await provedor.criarCheckoutAssinatura({
    motivo: `Agendaí ${PLANOS[plano].nome}`,
    valorCentavos: PLANOS[plano].preco_centavos,
    emailPagador: user.email ?? '',
    referenciaExterna: me.negocio_id as string,
    backUrl: `${baseUrl}/painel/configuracoes`,
  });
  if (checkout.checkoutUrl) return NextResponse.json({ ok: true, checkoutUrl: checkout.checkoutUrl });
  // Simulação (sem credenciais da plataforma): ativa na hora.
  const { error } = await db.rpc('alterar_plano', { p_plano: plano, p_provider: provedor.nome, p_provider_subscription_id: checkout.providerSubscriptionId });
  if (error) return erro('Não foi possível ativar o plano.', 400);
  return NextResponse.json({ ok: true, simulado: provedor.simulado });
}
