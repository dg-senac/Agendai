import type { MetadataRoute } from 'next';
// Slugs públicos dos negócios entram na Fase 5 (SEO completo).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agendai.app';
  const agora = new Date();
  return [
    { url: `${base}/`, lastModified: agora, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/cadastro`, lastModified: agora, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/entrar`, lastModified: agora, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
