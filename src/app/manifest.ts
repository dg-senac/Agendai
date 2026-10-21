import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agendaí — Agendamento online',
    short_name: 'Agendaí',
    description: 'Sua página de agendamento com Pix, lembretes automáticos e agenda sem furos.',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8fc',
    theme_color: '#4F46E5',
    lang: 'pt-BR',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
