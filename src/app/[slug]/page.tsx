import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicaDemo, PublicaLive, type NegocioPublico } from '@/components/publica';
import { configured, supabase } from '@/lib/supabase/server';

async function buscarPublico(slug: string): Promise<NegocioPublico | null> {
  if (!configured()) return null;
  try {
    const db = await supabase();
    const { data } = await db.rpc('negocio_publico', { p_slug: slug });
    return (data as NegocioPublico | null) ?? null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dados = await buscarPublico(slug);
  if (!dados) return { title: 'Agende online — Agendaí', description: 'Escolha o serviço, o profissional e o melhor horário. Sem filas no WhatsApp.' };
  const titulo = `${dados.nome} — Agende online`;
  const descricao = dados.descricao ?? `Agende seu horário no ${dados.nome} (${dados.cidade ?? ''}) em menos de 1 minuto.`;
  return {
    title: titulo, description: descricao,
    openGraph: { title: titulo, description: descricao, type: 'website', locale: 'pt_BR' },
    alternates: { canonical: `/${dados.slug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!configured()) return <PublicaDemo slug={slug} />;
  const dados = await buscarPublico(slug);
  if (!dados) notFound();
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: dados.nome, description: dados.descricao ?? undefined, telephone: dados.telefone ?? undefined,
    address: dados.endereco || dados.cidade ? { '@type': 'PostalAddress', streetAddress: dados.endereco ?? undefined, addressLocality: dados.cidade ?? undefined, addressCountry: 'BR' } : undefined,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agendai.app'}/${dados.slug}`,
  };
  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <PublicaLive data={dados} />
  </>);
}
