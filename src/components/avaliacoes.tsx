'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Star, Eye, EyeOff, MessageSquareReply, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PersistFn } from '@/components/agenda';
import { iniciais, type Review, type Store } from '@/lib/demo';

type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean; persist: PersistFn };

export function AvaliacoesPanel({ store, setStore, live }: Props) {
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const reviews = store.reviews;
  const media = reviews.length ? reviews.reduce((s, r) => s + r.nota, 0) / reviews.length : 0;
  const servicoDe = (r: Review) => {
    const ag = store.appointments.find((a) => a.id === r.agendamento_id);
    return ag ? store.services.find((s) => s.id === ag.servico_id)?.nome : undefined;
  };

  async function atualizar(r: Review, campos: { publica?: boolean; resposta?: string | null }) {
    if (live) {
      const res = await fetch('/api/avaliacoes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...campos }) });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? 'Não foi possível salvar.'); return false; }
      window.location.reload();
      return true;
    }
    setStore((s) => ({ ...s, reviews: s.reviews.map((v) => (v.id === r.id ? { ...v, ...campos } : v)) }));
    return true;
  }

  return (
    <>
      <div className="card between" style={{ padding: 22, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ gap: 16 }}>
          <span style={{ background: '#fff5e2', color: '#c99947', padding: 13, borderRadius: 13, display: 'grid', placeItems: 'center' }}><Star size={24} fill="currentColor" /></span>
          <div>
            <p style={{ fontSize: 24, fontWeight: 800 }}>{reviews.length ? media.toFixed(1).replace('.', ',') : '—'} <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>média em {reviews.length} avaliaç{reviews.length === 1 ? 'ão' : 'ões'}</span></p>
            <p className="muted" style={{ fontSize: 11, marginTop: 3 }}>{reviews.filter((r) => r.publica).length} aparecendo na sua página pública</p>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, maxWidth: 300, lineHeight: 1.7 }}>Os clientes avaliam pelo link do agendamento após o atendimento. Você escolhe o que fica público e pode responder com carinho. 💜</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {reviews.map((r) => (
          <article key={r.id} className="card" style={{ padding: 20 }}>
            <div className="between">
              <span className="row"><span className="avatar" style={{ width: 34, height: 34, fontSize: 11, background: '#eef2ff', color: '#5b4bd6' }}>{iniciais(r.cliente)}</span>
                <span><span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{r.cliente}</span>{servicoDe(r) && <span className="muted" style={{ fontSize: 10 }}>{servicoDe(r)}</span>}</span></span>
              <span className="badge" style={{ background: r.publica ? '#eaf7ef' : 'var(--hover)', color: r.publica ? '#2f8c5b' : 'var(--muted)' }}>{r.publica ? 'Pública' : 'Privada'}</span>
            </div>
            <div className="row mt-3" style={{ gap: 2, color: '#c99947' }} aria-label={`${r.nota} de 5 estrelas`}>
              {Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill={i < r.nota ? 'currentColor' : 'none'} opacity={i < r.nota ? 1 : 0.35} />)}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>“{r.comentario || 'Sem comentário.'}”</p>
            {r.resposta && <p style={{ fontSize: 12, marginTop: 12, background: 'var(--hover)', padding: 12, borderRadius: 10, lineHeight: 1.6 }}><strong>Sua resposta:</strong> {r.resposta}</p>}

            {respondendo === r.id ? (
              <form className="mt-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); if (await atualizar(r, { resposta: texto.trim() || null })) { setRespondendo(null); toast.success('Resposta salva.'); } setBusy(false); }}>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} placeholder="Agradeça, conte um cuidado extra…" aria-label="Sua resposta à avaliação" />
                <div className="row mt-2" style={{ gap: 8 }}>
                  <Button type="submit" size="sm" disabled={busy}><Send size={13} />{busy ? 'Enviando…' : 'Responder'}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRespondendo(null)}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <div className="row mt-4" style={{ gap: 8 }}>
                <Button size="sm" variant="outline" onClick={() => { setRespondendo(r.id); setTexto(r.resposta ?? ''); }}><MessageSquareReply size={13} />{r.resposta ? 'Editar resposta' : 'Responder'}</Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (await atualizar(r, { publica: !r.publica })) toast.success(r.publica ? 'Avaliação agora é privada.' : 'Avaliação publicada na sua página!'); }}>
                  {r.publica ? <EyeOff size={13} /> : <Eye size={13} />}{r.publica ? 'Tornar privada' : 'Publicar'}
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      {reviews.length === 0 && <div className="card empty"><Star className="mx-auto mb-4" />Ainda não há avaliações. Elas chegam automaticamente após os atendimentos concluídos.</div>}
    </>
  );
}
