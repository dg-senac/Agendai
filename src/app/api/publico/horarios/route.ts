import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { dentroDoLimite, ipDaRequisicao } from '@/server/rate-limit';

export async function GET(req: NextRequest) {
  if (!dentroDoLimite(`horarios:${ipDaRequisicao(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Muitas buscas seguidas. Aguarde um instante.' }, { status: 429 });
  if (!configured()) return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const servico = req.nextUrl.searchParams.get('servico') ?? '';
  const membro = req.nextUrl.searchParams.get('membro');
  const data = req.nextUrl.searchParams.get('data') ?? '';
  if (!slug || !servico || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  const db = await supabase();
  const { data: slots, error } = await db.rpc('horarios_disponiveis', { p_slug: slug, p_servico_id: servico, p_membro_id: membro || null, p_data: data });
  if (error) return NextResponse.json({ error: 'Não foi possível buscar os horários.' }, { status: 400 });
  return NextResponse.json({ slots });
}
