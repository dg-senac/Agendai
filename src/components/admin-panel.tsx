'use client';
import { useState } from 'react';
import { Ban, Play, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { moeda } from '@/lib/utils';

const dataCurta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');

type NegocioAdmin = { id: string; nome: string; slug: string; plano: string; plano_status: string; suspenso_em: string | null; criado_em: string; total_agendamentos: number; receita_gerada_centavos: number };
type Visao = {
  mrr_centavos: number; negocios: { total: number; ativos: number; trial: number; inadimplentes: number; cancelados: number; suspensos: number };
  novos_30d: number; churn_30d_pct: number; lista: NegocioAdmin[];
};

/** Painel do super admin: métricas da plataforma e ações sobre os negócios. */
export function AdminPanel({ visao }: { visao: Visao }) {
  const [suspensosLocal, setSuspensosLocal] = useState<Record<string, boolean>>({});
  const cards = [
    ['MRR (mensal recorrente)', moeda(visao.mrr_centavos)],
    ['Negócios ativos', `${visao.negocios.ativos} de ${visao.negocios.total}`],
    ['Em trial', `${visao.negocios.trial}`],
    ['Inadimplentes', `${visao.negocios.inadimplentes}`],
    ['Novos (30 dias)', `${visao.novos_30d}`],
    ['Churn (30 dias)', `${visao.churn_30d_pct}%`],
  ];

  async function alternarSuspensao(negocio: NegocioAdmin, suspensoAtual: boolean) {
    const novo = !suspensoAtual;
    const confirmacao = novo
      ? confirm(`Suspender "${negocio.nome}"? A página pública sai do ar e a equipe perde o acesso até você reativar.`)
      : confirm(`Reativar "${negocio.nome}"?`);
    if (!confirmacao) return;
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ negocioId: negocio.id, suspenso: novo }) });
    const dados = (await res.json()) as { erro?: string };
    if (!res.ok) return toast.error(dados.erro ?? 'Não foi possível aplicar.');
    setSuspensosLocal((prev) => ({ ...prev, [negocio.id]: novo }));
    toast.success(novo ? 'Negócio suspenso (registrado na auditoria).' : 'Negócio reativado.');
  }

  return (
    <main style={{ maxWidth: 1080, margin: 'auto', padding: '48px 22px 90px' }}>
      <p className="eyebrow">AGENDAÍ · SUPER ADMIN</p>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>Sua plataforma, num piscar de olhos 👀</h1>
      <div className="grid cols-3" style={{ marginTop: 30 }}>
        {cards.map(([rotulo, valor]) => (
          <section className="card" key={rotulo}><p className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>{rotulo.toUpperCase()}</p><strong style={{ fontSize: 26, display: 'block', marginTop: 8 }}>{valor}</strong></section>
        ))}
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="row" style={{ fontSize: 17, gap: 9 }}><Building2 size={18} />Todos os negócios</h2>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Negócio</th><th>Plano</th><th>Status</th><th>Desde</th><th>Agendamentos</th><th>Receita gerada</th><th>Ação</th></tr></thead>
            <tbody>{visao.lista.map((n) => {
              const suspenso = suspensosLocal[n.id] ?? Boolean(n.suspenso_em);
              return (
                <tr key={n.id}>
                  <td><strong>{n.nome}</strong><br /><span className="muted" style={{ fontSize: 11 }}>@{n.slug}</span></td>
                  <td>{n.plano === 'premium' ? 'Premium' : n.plano === 'pro' ? 'Pro' : 'Grátis'}</td>
                  <td>{suspenso ? <span className="tag" style={{ background: '#fde8e8', color: '#b42318' }}>Suspenso</span> : <span className="tag" style={{ background: '#e8f7ef', color: '#17663f' }}>{n.plano_status}</span>}</td>
                  <td>{dataCurta(n.criado_em.slice(0, 10))}</td>
                  <td>{n.total_agendamentos}</td>
                  <td>{moeda(n.receita_gerada_centavos)}</td>
                  <td><button className="button secondary" style={{ padding: '7px 11px', fontSize: 12 }} onClick={() => alternarSuspensao(n, suspenso)}>{suspenso ? <><Play size={13} /> Reativar</> : <><Ban size={13} /> Suspender</>}</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.7 }}>Ações registradas em <code>auditoria_admin</code>. Anúncios em massa e ajustes globais de preço entram na próxima iteração operacional.</p>
      </section>
    </main>
  );
}
