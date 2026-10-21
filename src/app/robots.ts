import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agendai.app';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/painel', '/api', '/onboarding', '/agendamento'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
