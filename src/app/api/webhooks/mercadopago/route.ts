import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MercadoPagoProvider, validarAssinaturaWebhookMp } from '@/lib/pagamentos/mercado-pago';

type EventoMp = { id?: number | string; type?: string; action?: string; data?: { id?: string | number } };

/**
 * Webhook do Mercado Pago: valida a assinatura, é idempotente
 * (webhooks_recebidos com evento único) e NUNCA confia no corpo — reconsulta
 * o pagamento na API antes de confirmar o agendamento.
 */
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sem service_role.' }, { status: 503 });
  const corpo = (await req.json().catch(() => null)) as EventoMp | null;
  const dataId = String(req.nextUrl.searchParams.get('data.id') ?? corpo?.data?.id ?? '');
  const tipo = req.nextUrl.searchParams.get('type') ?? corpo?.type ?? '';
  if (!dataId) return NextResponse.json({ ok: true }); // ping/ignorar

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret && !validarAssinaturaWebhookMp({ secret, xSignature: req.headers.get('x-signature'), xRequestId: req.headers.get('x-request-id'), dataId })) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }

  const eventoId = `${tipo || 'payment'}:${dataId}:${corpo?.id ?? corpo?.action ?? 'evento'}`;
  const { error: erroRegistro } = await admin.from('webhooks_recebidos')
    .insert({ provider: 'mercado_pago', evento_id: eventoId, payload: corpo ?? {} });
  if (erroRegistro) {
    if (erroRegistro.code === '23505') return NextResponse.json({ ok: true, duplicado: true }); // idempotência
    return NextResponse.json({ error: 'Falha ao registrar o evento.' }, { status: 500 });
  }

  try {
    if (tipo === 'payment' || !tipo) await processarPagamento(admin, dataId);
    await admin.from('webhooks_recebidos').update({ processado: true }).eq('evento_id', eventoId).eq('provider', 'mercado_pago');
    return NextResponse.json({ ok: true });
  } catch (e) {
    await admin.from('webhooks_recebidos').update({ erro: e instanceof Error ? e.message : 'erro' }).eq('evento_id', eventoId).eq('provider', 'mercado_pago');
    return NextResponse.json({ error: 'Falha ao processar.' }, { status: 500 });
  }
}

type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;

async function processarPagamento(admin: Admin, providerPaymentId: string) {
  const { data: pg } = await admin.from('pagamentos')
    .select('id, negocio_id, agendamento_id, status, valor_centavos')
    .eq('provider', 'mercado_pago').eq('provider_id', providerPaymentId).maybeSingle();
  if (!pg || pg.status === 'pago') return;
  const { data: integ } = await admin.from('negocio_integracoes').select('mp_access_token').eq('negocio_id', pg.negocio_id).maybeSingle();
  const token = integ?.mp_access_token ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Negócio sem token do Mercado Pago.');
  const consulta = await new MercadoPagoProvider(token).consultarPagamento(providerPaymentId);

  if (consulta.status === 'aprovado') {
    if (consulta.valorCentavos !== pg.valor_centavos) throw new Error('Valor divergente do esperado.');
    await admin.from('pagamentos').update({ status: 'pago', pago_em: new Date().toISOString() }).eq('id', pg.id);
    if (pg.agendamento_id) {
      await admin.from('agendamentos').update({ status: 'confirmado', reserva_expira_em: null })
        .eq('id', pg.agendamento_id).eq('status', 'pendente_pagamento');
    }
  } else if (consulta.status === 'estornado') {
    await admin.from('pagamentos').update({ status: 'estornado' }).eq('id', pg.id);
  } else if (consulta.status === 'rejeitado' || consulta.status === 'cancelado') {
    await admin.from('pagamentos').update({ status: 'falhou' }).eq('id', pg.id);
  }
}
