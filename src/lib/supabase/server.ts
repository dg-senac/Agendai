import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function configured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

type CookieASerGravado = { name: string; value: string; options: CookieOptions };

export async function supabase() {
  if (!configured()) throw new Error('Configure o Supabase para continuar.');
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values: CookieASerGravado[]) {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Server Components não podem gravar cookies; o middleware renova a sessão.
          }
        },
      },
    },
  );
}
