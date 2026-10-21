import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.redirect(new URL('/entrar?erro=sem-configuracao', req.url));
  const db = await supabase();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${req.nextUrl.origin}/api/auth/callback` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL('/entrar?erro=google', req.url));
  return NextResponse.redirect(data.url);
}
