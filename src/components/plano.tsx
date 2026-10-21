'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Crown, CreditCard, PlugZap, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PersistFn } from '@/components/agenda';
import type { Store } from '@/lib/demo';
import { PLANOS, planoEfetivo, type PlanoId } from '@/lib/planos';
import { moeda } from '@/lib/utils';

type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean; persist: PersistFn };

const mais30d = () => new Date(Date.now() + 30 * 24 * 3600_000).toISOString();

/** Plano/assinatura, conexão Mercado Pago e regras de sinal (Configurações). */
export function PlanoEIntegracoes({ store, setStore, live }: Props) {
  const b = store.business;
  const efetivo = planoEfetivo(b);
  const [busy, setBusy] = useState<string | null>(null);
  const [tokenMp, setTokenMp] = useState('');
  const [conectado, setConectado] = useState<boolean>(Boolean(b.mp_conectado));
  const diasTrial = b.trial_termina_em ? Math.max(0, Math.ceil((new Date(b.trial_termina_em).getTime() - Date.now()) / 86400_000)) : 0;

  useEffect(() => {
    if (!live) return;
    fetch('/api/configuracoes/integracoes').then((r) => r.json()).then((d: { conectado?: boolean }) => setConectado(Boolean(d.conectado))).catch(() => undefined);
  }, [live]);

  async function alterarPlano(plano: PlanoId) {
    setBusy(plano);
    if (live) {
      const res = await fetch('/api/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'alterar', plano }) });
      const data: { error?: string; checkoutUrl?: string } = await res.json().catch(() => ({}));
      setBusy(null);
      if (!res.ok) { toast.error(data.error ?? 'Não foi possível alterar o plano.'); return; }
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      toast.success(`Plano ${PLANOS[plano].nome} ativado!`);
      window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, business: { ...s.business, plano, status: 'ativo', assinatura_status: 'ativa', assinatura_proxima_cobranca: plano === 'gratis' ? null : mais30d(), carencia_ate: null } }));
    setBusy(null);
    toast.success(plano === 'gratis' ? 'Pronto! Você está no plano Grátis.' : `Plano ${PLANOS[plano].nome} ativado (simulação — sem cobrança real). 🎉`);
  }

  async function cancelar() {
    if (!confirm('Cancelar a assinatura? Você mantém os recursos pagos até o fim do ciclo atual e depois volta ao Grátis.')) return;
    setBusy('cancelar');
    if (live) {
      const res = await fetch('/api/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'cancelar' }) });
      setBusy(null);
      if (!res.ok) { toast.error('Não foi possível cancelar agora.'); return; }
      toast.success('Assinatura cancelada. Sentiremos sua falta!');
      window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, business: { ...s.business, assinatura_status: 'cancelada' } }));
    setBusy(null);
    toast.success('Assinatura cancelada (simulação).');
  }

  async function conectarMp(conectar: boolean) {
    setBusy('mp');
    if (live) {
      const res = await fetch('/api/configuracoes/integracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mp_access_token: conectar ? tokenMp : '' }) });
      const data: { error?: string; conectado?: boolean } = await res.json().catch(() => ({}));
      setBusy(null);
      if (!res.ok) { toast.error(data.error ?? 'Não foi possível salvar.'); return; }
      setConectado(Boolean(data.conectado));
      toast.success(conectar ? 'Mercado Pago conectado! Seus sinais via Pix já podem cair na sua conta.' : 'Mercado Pago desconectado.');
      return;
    }
    setStore((s) => ({ ...s, business: { ...s.business, mp_conectado: conectar } }));
    setConectado(conectar);
    setBusy(null);
    toast.success(conectar ? 'Conectado (simulação). Na demonstração, os Pix continuam simulados.' : 'Desconectado (simulação).');
  }

  async function salvarRegras(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const regras = {
      config_sinal_percentual: Number(f.get('sinal_percentual')),
      config_antecedencia_minima_horas: Number(f.get('antecedencia')),
      config_cancelamento_limite_horas: Number(f.get('cancelamento')),
      config_estorno_cliente_no_prazo: f.get('estorno') === 'on',
      config_faltas_sinal_obrigatorio: f.get('faltas_ativo') === 'on' ? Number(f.get('faltas') || 3) : null,
    };
    setBusy('regras');
    if (live) {
      const res = await fetch('/api/configuracoes/regras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regras) });
      setBusy(null);
      if (!res.ok) { toast.error('Não foi possível salvar as regras.'); return; }
      toast.success('Regras salvas.');
      window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, business: { ...s.business, ...regras } }));
    setBusy(null);
    toast.success('Regras salvas.');
  }

  return (
    <>
      <section className="card p-7" aria-labelledby="plano-titulo">
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2 id="plano-titulo" className="section-title">Plano e assinatura</h2>
          <span className="badge" style={{ background: '#efecfd', color: '#5b4bd6', padding: '7px 11px' }}>
            <Crown size={13} />{b.assinatura_status === 'trial' ? `Trial Pro — ${diasTrial} dia(s) restantes` : `Plano ${PLANOS[efetivo].nome}${b.assinatura_status === 'inadimplente' ? ' · pagamento pendente' : ''}${b.assinatura_status === 'cancelada' ? ' · cancelado' : ''}`}
          </span>
        </div>
        {b.assinatura_proxima_cobranca && b.assinatura_status === 'ativa' && <p className="muted text-xs mt-2">Próxima cobrança: {new Date(b.assinatura_proxima_cobranca).toLocaleDateString('pt-BR')}.</p>}
        <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {(Object.keys(PLANOS) as PlanoId[]).map((id) => {
            const p = PLANOS[id];
            const atual = (b.plano ?? 'gratis') === id && b.assinatura_status !== 'trial' && b.assinatura_status !== 'cancelada';
            return (
              <div key={id} className="card" style={{ padding: 20, borderColor: id === 'pro' ? '#c7c2f7' : undefined, position: 'relative' }}>
                {id === 'pro' && <span className="badge" style={{ position: 'absolute', top: -10, right: 14, background: '#5b4bd6', color: '#fff' }}>Mais popular</span>}
                <p style={{ fontWeight: 800, fontSize: 15 }}>{p.nome}</p>
                <p style={{ marginTop: 8 }}><strong style={{ fontSize: 22 }}>{p.preco_centavos ? moeda(p.preco_centavos) : 'R$ 0'}</strong><span className="muted" style={{ fontSize: 11 }}>/mês</span></p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0', display: 'grid', gap: 7 }}>
                  {p.beneficios.map((ben) => <li key={ben} className="row" style={{ fontSize: 11.5, gap: 7 }}><Check size={13} style={{ color: '#2f8c5b' }} />{ben}</li>)}
                </ul>
                <Button className="w-full" size="sm" variant={atual ? 'outline' : 'default'} disabled={atual || busy !== null} onClick={() => void alterarPlano(id)}>
                  {atual ? 'Seu plano atual' : busy === id ? 'Processando…' : id === 'gratis' ? 'Mudar para o Grátis' : `Assinar o ${p.nome}`}
                </Button>
              </div>
            );
          })}
        </div>
        {b.assinatura_status !== 'cancelada' && (b.plano ?? 'gratis') !== 'gratis' && b.assinatura_status !== 'trial' && (
          <button className="muted mt-4" style={{ fontSize: 12 }} onClick={() => void cancelar()} disabled={busy !== null}>Cancelar assinatura</button>
        )}
        {!live && (
          <div className="card mt-5" style={{ padding: 14, background: 'var(--hover)' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 500, fontSize: 12 }}>🧪 Demonstração — simular status da assinatura:
              <select value={b.assinatura_status ?? 'trial'} style={{ width: 'auto', padding: '7px 10px' }} onChange={(e) => {
                const v = e.target.value as NonNullable<typeof b.assinatura_status>;
                setStore((s) => ({ ...s, business: { ...s.business, assinatura_status: v, carencia_ate: v === 'inadimplente' ? new Date(Date.now() + 7 * 86400_000).toISOString() : s.business.carencia_ate ?? null } }));
              }}>
                <option value="trial">Trial Pro</option><option value="ativa">Ativa</option><option value="inadimplente">Inadimplente (carência de 7 dias)</option><option value="cancelada">Cancelada</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="card p-7" aria-labelledby="mp-titulo">
        <div className="between"><h2 id="mp-titulo" className="section-title">Receber sinais via Pix</h2><CreditCard size={18} className="muted" /></div>
        <p className="muted text-xs mt-2" style={{ lineHeight: 1.7 }}>Conecte sua conta do <strong>Mercado Pago</strong> para os sinais dos clientes caírem direto nela. Pegue seu <em>Access Token</em> em Mercado Pago → Suas integrações → Credenciais. O token fica guardado só no servidor.</p>
        {conectado ? (
          <div className="between mt-5 card" style={{ padding: 16, background: '#eaf7ef', borderColor: '#cfe9d8' }}>
            <span className="row" style={{ fontSize: 13, fontWeight: 600, color: '#256b47' }}><PlugZap size={16} />Mercado Pago conectado</span>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void conectarMp(false)}><Unplug size={13} />Desconectar</Button>
          </div>
        ) : (
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (!tokenMp.trim() && live) { toast.error('Cole seu Access Token do Mercado Pago.'); return; } void conectarMp(true); }}>
            <label>Access Token do Mercado Pago<input type="password" value={tokenMp} onChange={(e) => setTokenMp(e.target.value)} placeholder={live ? 'APP_USR-…' : 'Na demonstração pode deixar vazio'} autoComplete="off" /></label>
            <Button type="submit" disabled={busy !== null}><PlugZap size={14} />{busy === 'mp' ? 'Conectando…' : 'Conectar Mercado Pago'}</Button>
          </form>
        )}
      </section>

      <section className="card p-7" aria-labelledby="regras-titulo">
        <h2 id="regras-titulo" className="section-title">Regras de agendamento e sinal</h2>
        <form className="form-grid" onSubmit={salvarRegras}>
          <div className="grid grid-cols-3 gap-4">
            <label>Sinal padrão (%)<input name="sinal_percentual" type="number" min={0} max={100} defaultValue={b.config_sinal_percentual ?? 30} /></label>
            <label>Antecedência mínima (h)<input name="antecedencia" type="number" min={0} max={168} defaultValue={b.config_antecedencia_minima_horas ?? 2} /></label>
            <label>Cancelar/remarcar até (h antes)<input name="cancelamento" type="number" min={0} max={168} defaultValue={b.config_cancelamento_limite_horas ?? 4} /></label>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 500, fontSize: 13 }}>
            <input type="checkbox" name="estorno" defaultChecked={b.config_estorno_cliente_no_prazo ?? true} style={{ width: 17, height: 17 }} />
            Devolver o sinal automaticamente quando o cliente cancelar dentro do prazo
          </label>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 500, fontSize: 13 }}>
              <input type="checkbox" name="faltas_ativo" defaultChecked={b.config_faltas_sinal_obrigatorio != null} style={{ width: 17, height: 17 }} />
              Exigir sinal de quem faltou
            </label>
            <input name="faltas" type="number" min={1} max={20} defaultValue={b.config_faltas_sinal_obrigatorio ?? 3} style={{ width: 80 }} aria-label="Número de faltas para exigir sinal" />
            <span className="muted" style={{ fontSize: 12 }}>vezes ou mais</span>
          </div>
          <Button type="submit" disabled={busy !== null}>{busy === 'regras' ? 'Salvando…' : 'Salvar regras'}</Button>
        </form>
      </section>
    </>
  );
}
