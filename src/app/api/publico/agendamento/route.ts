import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { tokenAcaoSchema } from '@/server/validators/fase2';
import { dentroDoLimite, ipDaRequisicao } from '@/server/rate-limit';

const mensagem = (error: { message: string }) => error.message.match(/[A-ZÁÉÍÓÚ][^.]+\./)?.[0] ?? 'Não foi possível concluir a operação.';

export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (token.length < 10) return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  const db = await supabase();
  const { data, error } = await db.rpc('agendamento_por_token', { p_token: token });
  if (error || !data) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  return NextResponse.json({ agendamento: data });
}

export async function POST(req: NextRequest) {
  if (!dentroDoLimite(`token:${ipDaRequisicao(req)}`, 20, 60_000)) return NextResponse.json({ error: 'Muitas tentativas seguidas. Aguarde um instante.' }, { status: 429 });
  if (!configured()) return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  const parsed = tokenAcaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = await supabase();
  if (parsed.data.acao === 'cancelar') {
    const { data, error } = await db.rpc('cancelar_agendamento_publico', { p_token: parsed.data.token });
    if (error) return NextResponse.json({ error: mensagem(error) }, { status: 400 });
    return NextResponse.json(data);
  }
  const { data, error } = await db.rpc('remarcar_agendamento_publico', { p_token: parsed.data.token, p_novo_inicio: parsed.data.novo_inicio });
  if (error) return NextResponse.json({ error: mensagem(error) }, { status: 400 });
  return NextResponse.json(data);
}
