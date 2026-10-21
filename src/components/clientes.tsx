'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, Plus, X, MessageCircle, Download, Trash2, History, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apenasDigitos, iniciais, type Client, type Store } from '@/lib/demo';
import type { PersistFn } from '@/components/agenda';
import { moeda } from '@/lib/utils';

type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean; persist: PersistFn };

export function ClientesPanel({ store, setStore, live, persist }: Props) {
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const selecionado = store.clients.find((c) => c.id === selecionadoId) ?? null;

  const filtrados = useMemo(() => store.clients.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.whatsapp.includes(apenasDigitos(busca) || '∅') || c.email.toLowerCase().includes(busca.toLowerCase()),
  ), [store.clients, busca]);

  const historico = (id: string) => store.appointments.filter((a) => a.cliente_id === id).sort((a, b) => b.inicio_ts.localeCompare(a.inicio_ts));
  const gasto = (id: string) => historico(id).filter((a) => a.status === 'concluido').reduce((s, a) => s + a.preco_centavos, 0);
  const nomeServ = (id: string) => store.services.find((s) => s.id === id)?.nome ?? 'Serviço';

  const linkWhats = (c: Client) => `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Olá, ${c.nome.split(' ')[0]}! Aqui é do ${store.business.nome} 💜 Passando para saber se está tudo bem e se quer agendar seu próximo horário: ${typeof window !== 'undefined' ? `${window.location.origin}/${store.business.slug}` : ''}`)}`;

  function exportar(c: Client) {
    const dados = { cliente: c, agendamentos: historico(c.id), exportado_em: new Date().toISOString(), origem: 'Agendaí — exportação LGPD' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `dados-${c.nome.toLowerCase().replace(/\s+/g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Dados do cliente exportados (LGPD).');
  }

  async function excluir(c: Client) {
    if (!confirm(`Excluir ${c.nome}? Os agendamentos futuros serão cancelados. Esta ação atende a um pedido de exclusão de dados (LGPD).`)) return;
    if (live) {
      if (await persist('clients', {}, 'DELETE', c.id)) { toast.success('Cliente excluído.'); window.location.reload(); }
      return;
    }
    setStore((s) => ({
      ...s,
      clients: s.clients.filter((v) => v.id !== c.id),
      appointments: s.appointments.map((a) => a.cliente_id === c.id && (a.status === 'confirmado' || a.status === 'pendente_pagamento') && new Date(a.inicio_ts) > new Date() ? { ...a, status: 'cancelado' as const } : a),
    }));
    setSelecionadoId(null);
    toast.success('Cliente excluído.');
  }

  async function salvarObservacoes(c: Client, texto: string) {
    if (live) { if (await persist('clients', { nome: c.nome, whatsapp: c.whatsapp, email: c.email, observacoes: texto }, 'POST', c.id)) { toast.success('Observações salvas.'); window.location.reload(); } return; }
    setStore((s) => ({ ...s, clients: s.clients.map((v) => v.id === c.id ? { ...v, observacoes: texto } : v) }));
    toast.success('Observações salvas.');
  }

  return (
    <>
      <div className="between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div className="relative" style={{ maxWidth: 360, flex: 1 }}>
          <Search size={16} className="absolute muted" style={{ top: 13, left: 14 }} />
          <input aria-label="Buscar cliente por nome, WhatsApp ou e-mail" placeholder="Buscar por nome, WhatsApp ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <Button onClick={() => setFormAberto(true)}><Plus size={15} />Novo cliente</Button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Atendimentos</th><th>Faltas</th><th>Total gasto</th><th>Ações</th></tr></thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td><button className="row" style={{ fontWeight: 600 }} onClick={() => setSelecionadoId(c.id)}><span className="avatar" style={{ width: 30, height: 30, fontSize: 10, background: '#eef2ff', color: '#5b4bd6' }}>{iniciais(c.nome)}</span>{c.nome}</button></td>
                <td className="muted">{c.whatsapp}</td>
                <td>{c.total_agendamentos}</td>
                <td>{c.total_faltas >= 3 ? <span className="badge" style={{ background: '#fdecec', color: '#c04646' }}>{c.total_faltas} faltas</span> : c.total_faltas}</td>
                <td><strong>{moeda(gasto(c.id))}</strong></td>
                <td><div className="row"><a aria-label={`Chamar ${c.nome} no WhatsApp`} href={linkWhats(c)} target="_blank" rel="noreferrer" style={{ color: '#22a06b' }}><MessageCircle size={17} /></a><button aria-label={`Histórico de ${c.nome}`} onClick={() => setSelecionadoId(c.id)}><History size={16} className="muted" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <div className="empty">Nenhum cliente encontrado. {store.clients.length === 0 && 'Cadastre o primeiro ou compartilhe sua página pública.'}</div>}
      </div>

      {formAberto && <ClienteForm store={store} setStore={setStore} live={live} persist={persist} fechar={() => setFormAberto(false)} />}

      {selecionado && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelecionadoId(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cliente-titulo" style={{ maxWidth: 560 }}>
            <div className="between">
              <div className="row"><span className="avatar" style={{ width: 44, height: 44, background: '#eef2ff', color: '#5b4bd6' }}>{iniciais(selecionado.nome)}</span>
                <div><h2 id="cliente-titulo" className="text-lg font-bold">{selecionado.nome}</h2><p className="muted text-[11px]">Cliente desde {new Date(selecionado.created_at).toLocaleDateString('pt-BR')}</p></div></div>
              <button aria-label="Fechar" onClick={() => setSelecionadoId(null)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[{ r: 'Atendimentos', v: String(selecionado.total_agendamentos) }, { r: 'Faltas', v: String(selecionado.total_faltas) }, { r: 'Total gasto', v: moeda(gasto(selecionado.id)) }].map((m) => (
                <div key={m.r} className="card" style={{ padding: 14, textAlign: 'center' }}><p style={{ fontWeight: 800, fontSize: 17 }}>{m.v}</p><p className="muted" style={{ fontSize: 10, marginTop: 4 }}>{m.r}</p></div>
              ))}
            </div>
            <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void salvarObservacoes(selecionado, String(new FormData(e.currentTarget).get('observacoes') ?? '')); }}>
              <label>Observações<textarea name="observacoes" rows={3} defaultValue={selecionado.observacoes} placeholder="Preferências, alergias, aniversário…" /></label>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button type="submit" size="sm">Salvar observações</Button>
                <Button asChild size="sm" variant="outline"><a href={linkWhats(selecionado)} target="_blank" rel="noreferrer"><MessageCircle size={14} />Chamar no WhatsApp</a></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => exportar(selecionado)}><Download size={14} />Exportar dados</Button>
                <button type="button" className="row text-rose-500" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => void excluir(selecionado)}><Trash2 size={14} />Excluir cliente</button>
              </div>
            </form>
            <h3 className="section-title mt-7" style={{ fontSize: 14 }}>Histórico</h3>
            <div className="mt-3 grid gap-2" style={{ maxHeight: 240, overflow: 'auto' }}>
              {historico(selecionado.id).map((a) => (
                <div key={a.id} className="between" style={{ fontSize: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span>{new Date(a.inicio_ts).toLocaleDateString('pt-BR')} · {nomeServ(a.servico_id)}</span>
                  <span className="row" style={{ gap: 8 }}><span className="muted">{moeda(a.preco_centavos)}</span><span className="badge" style={{ background: 'var(--hover)', color: 'var(--muted)' }}>{a.status.replace('_', ' ')}</span></span>
                </div>
              ))}
              {historico(selecionado.id).length === 0 && <p className="muted text-xs flex items-center gap-2"><Star size={13} />Ainda sem atendimentos. Que tal convidar para o primeiro?</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ClienteForm({ store, setStore, live, persist, fechar }: Props & { fechar: () => void }) {
  const [busy, setBusy] = useState(false);
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get('nome') ?? '').trim();
    const digitos = apenasDigitos(String(f.get('whatsapp') ?? ''));
    const whatsapp = digitos.length <= 11 ? `55${digitos}` : digitos;
    const email = String(f.get('email') ?? '');
    if (nome.length < 2) { toast.error('Informe o nome do cliente.'); return; }
    if (digitos.length < 10) { toast.error('Informe um WhatsApp válido com DDD.'); return; }
    setBusy(true);
    if (live) {
      const ok = await persist('clients', { nome, whatsapp, email, observacoes: '' });
      setBusy(false);
      if (ok) window.location.reload();
      return;
    }
    if (store.clients.some((c) => c.whatsapp === whatsapp)) { setBusy(false); toast.error('Já existe um cliente com este WhatsApp.'); return; }
    setStore((s) => ({ ...s, clients: [...s.clients, { id: crypto.randomUUID(), nome, whatsapp, email, observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: new Date().toISOString() }] }));
    setBusy(false);
    toast.success('Cliente cadastrado.');
    fechar();
  }
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="novo-cliente">
        <div className="between"><h2 id="novo-cliente" className="text-xl font-bold">Novo cliente</h2><button aria-label="Fechar" onClick={fechar}><X size={20} /></button></div>
        <form className="form-grid" onSubmit={salvar}>
          <label>Nome completo<input name="nome" required minLength={2} maxLength={100} placeholder="Ex.: Mariana Costa" /></label>
          <label>WhatsApp<input name="whatsapp" required placeholder="(81) 99999-1234" inputMode="tel" /></label>
          <label>E-mail (opcional)<input name="email" type="email" placeholder="cliente@email.com.br" /></label>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={fechar}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Cadastrar'}</Button></div>
        </form>
      </div>
    </div>
  );
}
