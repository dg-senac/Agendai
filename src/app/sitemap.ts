import type { MetadataRoute } from 'next';
import { configured, supabase as criarSupabase } from '@/lib/supabase/server';

/** Sitemap dinâmico: landing + páginas públicas de todos os negócios (SEO). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agendai.app';
  const estaticas: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/cadastro`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/privacidade`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/termos`, changeFrequency: 'monthly', priority: 0.3 },
  ];
  if (!configured()) return estaticas;
  try {
    const supabase = await criarSupabase();
    const { data } = await supabase.rpc('slugs_publicos', { p_limite: 5000 });
    const negocios = (Array.isArray(data) ? data : []).map((linha) => ({
      url: `${base}/${linha.slug}`,
      lastModified: linha.atualizado_em ? new Date(linha.atualizado_em) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    return [...estaticas, ...negocios];
  } catch {
    return estaticas;
  }
}
