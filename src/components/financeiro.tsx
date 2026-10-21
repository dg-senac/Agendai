'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Plus, Wallet, Clock3, Undo2, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PersistFn } from '@/components/agenda';
import type { Payment, Store } from '@/lib/demo';
import { podeCsv, planoEfetivo } from '@/lib/planos';
import { moeda } from '@/lib/utils';

type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean; persist: PersistFn };

const STATUS: Record<Payment['status'], { rotulo: string; bg: string; cor: string }> = {
  pago: { rotulo: 'Pago', bg: '#eaf7ef', cor: '#2f8c5b' },
  pendente: { rotulo: 'Pendente', bg: '#fff6e3', cor: '#b88c30' },
  expirado: { rotulo: 'Expirado', bg: '#f3f4f6', cor: '#8a8f9c' },
  estornado: { rotulo: 'Estornado', bg: '#fdecec', cor: '#c04646' },
  falhou: { rotulo: 'Falhou', bg: '#fdecec', cor: '#c04646' },
};
const METODO = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' } as const;
const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' }, { id: '7d', rotulo: 'Últimos 7 dias' },
  { id: '30d', rotulo: 'Últimos 30 dias' }, { id: 'mes', rotulo: 'Este mês' }, { id: 'tudo', rotulo: 'Tudo' },
] as const;

function inicioPeriodo(id: string): Date {
  const agora = new Date();
  switch (id) {
    case 'hoje': return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    case '7d': return new Date(agora.getTime() - 7 * 24 * 3600_000);
    case 'mes': return new Date(agora.getFullYear(), agora.getMonth(), 1);
    case 'tudo': return new Date(0);
    default: return new Date(agora.getTime() - 30 * 24 * 3600_000);
  }
}

export function FinanceiroPanel({ store, setStore, live }: Props) {
  const [periodo, setPeriodo] = useState<string>('30d');
  const [status, setStatus] = useState<string>('todos');
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const plano = planoEfetivo(store.business);
  const csvLiberado = podeCsv(plano);

  const clienteDoPagamento = (p: Payment) => {
    const ag = store.appointments.find((a) => a.id === p.agendamento_id);
    if (!ag) return p.tipo === 'assinatura' ? 'Assinatura Agendaí' : 'Recebimento avulso';
    const cliente = store.clients.find((c) => c.id === ag.cliente_id)?.nome ?? 'Cliente';
    const servico = store.services.find((s) => s.id === ag.servico_id)?.nome ?? '';
    return `${cliente}${servico ? ` · ${servico}` : ''}`;
  };

  const filtrados = useMemo(() => {
    const ini = inicioPeriodo(periodo);
    return (store.payments ?? []).filter((p) => new Date(p.created_at) >= ini && (status === 'todos' || p.status === status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [store.payments, periodo, status]);

  const totais = useMemo(() => ({
    recebido: filtrados.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor_centavos, 0),
    pendente: filtrados.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.valor_centavos, 0),
    estornado: filtrados.filter((p) => p.status === 'estornado').reduce((s, p) => s + p.valor_centavos, 0),
  }), [filtrados]);

  function exportarCsv() {
    if (!csvLiberado) { toast.info('A exportação CSV é um recurso do plano Premium. Veja em Configurações → Plano.'); return; }
    const linhas = [
      'data;descricao;tipo;metodo;status;valor_brl',
      ...filtrados.map((p) => [
        new Date(p.created_at).toLocaleString('pt-BR'),
        `"${clienteDoPagamento(p).replace(/"/g, '""')}"`,
        p.tipo, METODO[p.metodo], STATUS[p.status].rotulo,
        (p.valor_centavos / 100).toFixed(2).replace('.', ','),
      ].join(';')),
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `financeiro-${store.business.slug}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado.');
  }

  return (
    <>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {[
          { rotulo: 'Recebido no período', valor: moeda(totais.recebido), icon: Wallet, cor: '#2f8c5b', bg: '#eaf7ef' },
          { rotulo: 'Aguardando pagamento', valor: moeda(totais.pendente), icon: Clock3, cor: '#b88c30', bg: '#fff6e3' },
          { rotulo: 'Estornado', valor: moeda(totais.estornado), icon: Undo2, cor: '#c04646', bg: '#fdecec' },
        ].map((m) => (
          <div key={m.rotulo} className="card metric">
            <div className="between"><span className="muted" style={{ fontSize: 11 }}>{m.rotulo}</span><span style={{ padding: 9, borderRadius: 10, color: m.cor, background: m.bg }}><m.icon size={17} /></span></div>
            <p className="metric-value">{m.valor}</p>
          </div>
        ))}
      </div>

      <div className="between mt-6" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: 'auto', padding: '10px 12px' }}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
          <select aria-label="Status do pagamento" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto', padding: '10px 12px' }}>
            <option value="todos">Todos os status</option>
            <option value="pago">Pagos</option><option value="pendente">Pendentes</option>
            <option value="estornado">Estornados</option><option value="expirado">Expirados</option>
          </select>
        </div>
        <div className="row">
          <Button variant="outline" size="sm" onClick={exportarCsv} aria-label="Exportar CSV">{csvLiberado ? <Download size={14} /> : <Lock size={14} />}Exportar CSV{!csvLiberado && <span className="badge" style={{ background: '#efecfd', color: '#5b4bd6' }}>Premium</span>}</Button>
          <Button size="sm" onClick={() => setRegistrarAberto(true)}><Plus size={14} />Registrar recebimento</Button>
        </div>
      </div>

      <div className="card table-wrap mt-4">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Método</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td className="muted">{new Date(p.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ fontWeight: 550 }}>{clienteDoPagamento(p)}{p.provider === 'simulado' && <span className="muted" style={{ fontSize: 10 }}> · simulação</span>}</td>
                <td className="muted">{p.tipo === 'sinal' ? 'Sinal' : p.tipo === 'saldo' ? 'Saldo/atendimento' : 'Assinatura'}</td>
                <td className="muted">{METODO[p.metodo]}</td>
                <td><span className="badge" style={{ background: STATUS[p.status].bg, color: STATUS[p.status].cor }}>{STATUS[p.status].rotulo}</span></td>
                <td><strong>{moeda(p.valor_centavos)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <div className="empty">Nenhum pagamento neste filtro. Sinais pagos pela página pública e recebimentos manuais aparecem aqui.</div>}
      </div>

      {registrarAberto && <RegistrarRecebimento store={store} setStore={setStore} live={live} fechar={() => setRegistrarAberto(false)} />}
    </>
  );
}

function RegistrarRecebimento({ store, setStore, live, fechar }: Omit<Props, 'persist'> & { fechar: () => void }) {
  const [busy, setBusy] = useState(false);
  const elegiveis = store.appointments.filter((a) => a.status === 'concluido' || a.status === 'confirmado')
    .sort((a, b) => b.inicio_ts.localeCompare(a.inicio_ts)).slice(0, 30);
  const nomeCli = (id: string) => store.clients.find((c) => c.id === id)?.nome ?? 'Cliente';

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const agendamento_id = (f.get('agendamento_id') as string) || null;
    const metodo = f.get('metodo') as Payment['metodo'];
    const valor = Math.round(Number(String(f.get('valor')).replace(',', '.')) * 100);
    if (!(valor > 0)) { toast.error('Informe um valor maior que zero.'); return; }
    setBusy(true);
    if (live) {
      const res = await fetch('/api/financeiro/registrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agendamento_id, tipo: 'saldo', metodo, valor_centavos: valor }) });
      const data: { error?: string } = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) { toast.error(data.error ?? 'Não foi possível registrar.'); return; }
      toast.success('Recebimento registrado.');
      window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, payments: [...(s.payments ?? []), { id: crypto.randomUUID(), agendamento_id, tipo: 'saldo', metodo, valor_centavos: valor, status: 'pago', provider: 'manual', created_at: new Date().toISOString(), pago_em: new Date().toISOString() }] }));
    setBusy(false);
    toast.success('Recebimento registrado.');
    fechar();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="registrar-recebimento">
        <div className="between"><h2 id="registrar-recebimento" className="text-xl font-bold">Registrar recebimento</h2><button aria-label="Fechar" onClick={fechar}><X size={20} /></button></div>
        <p className="muted text-xs mt-2">Para dinheiro, cartão na maquininha ou Pix recebido fora do Agendaí.</p>
        <form className="form-grid" onSubmit={salvar}>
          <label>Atendimento (opcional)<select name="agendamento_id"><option value="">— Recebimento avulso —</option>{elegiveis.map((a) => <option key={a.id} value={a.id}>{new Date(a.inicio_ts).toLocaleDateString('pt-BR')} · {nomeCli(a.cliente_id)} · {moeda(a.preco_centavos)}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-4">
            <label>Método<select name="metodo"><option value="dinheiro">Dinheiro</option><option value="pix">Pix (manual)</option><option value="cartao">Cartão</option></select></label>
            <label>Valor recebido (R$)<input name="valor" type="number" min="0.01" step="0.01" required placeholder="85,00" /></label>
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={fechar}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Registrar'}</Button></div>
        </form>
      </div>
    </div>
  );
}
