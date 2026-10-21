'use client';
import { useEffect } from 'react';
import { relatarErro } from '@/lib/relatar-erro';

/** Fronteira de erro das páginas: reporta e oferece uma saída gentil. */
export default function ErroPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void relatarErro(error); }, [error]);
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <p style={{ fontSize: 40 }}>😵‍💫</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 14 }}>Ops! Algo saiu do lugar.</h1>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginTop: 10 }}>
          Já anotamos o problema por aqui. Tente de novo — se insistir, fale com a gente pelo WhatsApp do negócio.
        </p>
        <button className="button primary" style={{ marginTop: 20 }} onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  );
}
