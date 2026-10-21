import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!configured() || !code) return NextResponse.redirect(new URL('/entrar', req.url));
  const db = await supabase();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/entrar?erro=confirmacao', req.url));
  return NextResponse.redirect(new URL('/painel', req.url)); // /painel redireciona p/ onboarding se faltar negócio
}
