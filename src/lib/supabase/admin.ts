import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com service_role: APENAS no servidor (webhooks, jobs, leitura de
 * credenciais de pagamento). Ignora RLS — nunca exponha ao navegador.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
