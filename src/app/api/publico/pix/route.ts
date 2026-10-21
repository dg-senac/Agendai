import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { provedorDoNegocio } from '@/lib/pagamentos';
import { dentroDoLimite, ipDaRequisicao } from '@/server/rate-limit';

const erro = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });
const corpo = z.object({ token: z.string().min(10), agendamento_id: z.uuid() });

/** Cria (ou reaproveita) a cobrança Pix do sinal de um agendamento pendente. */
export async function POST(req: NextRequest) {
  if (!dentroDoLimite(`pix:${ipDaRequisicao(req)}`, 10, 60_000)) return erro('Muitas tentativas seguidas. Aguarde um instante.', 429);
  if (!configured()) return erro('Indisponível no modo demonstração.', 503);
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return erro('Solicitação inválida.', 400);
  const admin = supabaseAdmin();
  if (!admin) return erro('Pagamentos ainda não configurados no servidor.', 503);

  // Confere token × agendamento (o token é a credencial do cliente).
  const { data: ag } = await admin.from('agendamentos')
    .select('id, negocio_id, status, sinal_centavos, reserva_expira_em, token_publico')
    .eq('id', parsed.data.agendamento_id).single();
  if (!ag || ag.token_publico !== parsed.data.token) return erro('Agendamento não encontrado.', 404);
  if (ag.status !== 'pendente_pagamento' || ag.sinal_centavos <= 0) return erro('Este agendamento não tem sinal pendente.', 400);
  if (ag.reserva_expira_em && new Date(ag.reserva_expira_em) < new Date()) return erro('A reserva expirou. Faça um novo agendamento.', 410);

  const { data: existente } = await admin.from('pagamentos')
    .select('id, pix_copia_cola, pix_qr_base64, expira_em, valor_centavos, provider')
    .eq('agendamento_id', ag.id).eq('tipo', 'sinal').eq('status', 'pendente')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existente?.pix_copia_cola) {
    return NextResponse.json({ pagamento: { id: existente.id, copia_cola: existente.pix_copia_cola, qr_base64: existente.pix_qr_base64, expira_em: existente.expira_em, valor_centavos: existente.valor_centavos, simulado: existente.provider === 'simulado' } });
  }

  const { data: integ } = await admin.from('negocio_integracoes').select('mp_access_token').eq('negocio_id', ag.negocio_id).maybeSingle();
  const { data: negocio } = await admin.from('negocios').select('nome').eq('id', ag.negocio_id).single();
  const provedor = provedorDoNegocio(integ?.mp_access_token);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  const { data: pg, error: pgErro } = await admin.from('pagamentos').insert({
    negocio_id: ag.negocio_id, agendamento_id: ag.id, tipo: 'sinal', metodo: 'pix',
    valor_centavos: ag.sinal_centavos, status: 'pendente', provider: provedor.nome,
    expira_em: ag.reserva_expira_em,
  }).select('id').single();
  if (pgErro || !pg) return erro('Não foi possível gerar a cobrança agora.', 500);

  try {
    const cobranca = await provedor.criarCobrancaPix({
      valorCentavos: ag.sinal_centavos,
      descricao: `Sinal — ${negocio?.nome ?? 'Agendaí'}`,
      referenciaExterna: pg.id,
      expiraEmMinutos: 10,
      notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
    });
    await admin.from('pagamentos').update({ provider_id: cobranca.providerId, pix_copia_cola: cobranca.copiaCola, pix_qr_base64: cobranca.qrBase64, expira_em: cobranca.expiraEm }).eq('id', pg.id);
    return NextResponse.json({ pagamento: { id: pg.id, copia_cola: cobranca.copiaCola, qr_base64: cobranca.qrBase64, expira_em: cobranca.expiraEm, valor_centavos: ag.sinal_centavos, simulado: cobranca.simulado } });
  } catch {
    await admin.from('pagamentos').update({ status: 'falhou' }).eq('id', pg.id);
    return erro('Não foi possível gerar o Pix agora. Tente de novo em instantes.', 502);
  }
}

/** Status para a tela do Pix acompanhar (polling). */
export async function GET(req: NextRequest) {
  if (!configured()) return erro('Indisponível no modo demonstração.', 503);
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (token.length < 10) return erro('Link inválido.', 400);
  const db = await supabase();
  const { data } = await db.rpc('agendamento_por_token', { p_token: token });
  if (!data) return erro('Agendamento não encontrado.', 404);
  return NextResponse.json({ status: (data as { status: string }).status });
}
