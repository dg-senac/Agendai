import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/security';
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req); if (csrf) return csrf;
  if (configured()) { const db = await supabase(); await db.auth.signOut(); }
  return NextResponse.json({ ok: true });
}
