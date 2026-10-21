'use client';
import { useEffect } from 'react';
import { relatarErro } from '@/lib/relatar-erro';

/** Última linha de defesa (erro no layout raiz): HTML próprio e mínimo. */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void relatarErro(error); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 40 }}>😵‍💫</p>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Ops! Algo saiu do lugar.</h1>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: '#555' }}>Já anotamos o problema. Tente de novo em instantes.</p>
          <button onClick={reset} style={{ marginTop: 18, padding: '12px 20px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
