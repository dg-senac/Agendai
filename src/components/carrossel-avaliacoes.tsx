'use client';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { Review } from '@/lib/demo';

/** Carrossel de avaliações (Embla) — carregado sob demanda na página pública. */
export default function CarrosselAvaliacoes({ reviews, cor }: { reviews: Review[]; cor: string }) {
  const [ref, api] = useEmblaCarousel({ align: 'start', loop: false });
  return (
    <section style={{ marginTop: 36 }}>
      <div className="between"><h2 className="section-title">Quem já veio, recomenda 💬</h2>
        <span className="row"><button aria-label="Avaliações anteriores" onClick={() => api?.scrollPrev()}><ChevronLeft size={18} /></button><button aria-label="Próximas avaliações" onClick={() => api?.scrollNext()}><ChevronRight size={18} /></button></span></div>
      <div className="embla mt-4" ref={ref}>
        <div className="embla__container">
          {reviews.map((r) => (
            <div key={r.id} className="embla__slide">
              <div className="card" style={{ padding: 20, height: '100%' }}>
                <div className="row" style={{ gap: 2, color: cor }}>{Array.from({ length: r.nota }, (_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>“{r.comentario}”</p>
                <p className="muted" style={{ fontSize: 11, marginTop: 10, fontWeight: 600 }}>{r.cliente}</p>
                {r.resposta && <p style={{ fontSize: 11, marginTop: 8, background: 'var(--hover)', padding: 10, borderRadius: 9 }}><strong>Resposta:</strong> {r.resposta}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
