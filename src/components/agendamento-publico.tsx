'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarPlus, CalendarX2, CheckCircle2, Clock3, MapPin, MessageCircle, RefreshCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeletorHorario, type SlotPub } from '@/components/publica';
import { useDemoStore } from '@/components/use-demo-store';
import { apenasDigitos, iniciais } from '@/lib/demo';
import { encontrarConflito, formatarHora, gerarIcs, gerarSlots } from '@/lib/disponibilidade';
import { moeda } from '@/lib/utils';

export type AgendamentoVM = {
  token: string; status: string; inicio: string; fim: string; preco_centavos: number; sinal_centavos: number;
  servicoId: string; servicoNome: string; membroId: string; membroNome: string; clienteNome: string;
  negocioNome: string; slug: string; telefone: string; endereco: string; cidade: string; cor: string; limiteHoras: number;
};

type Acoes = {
  vm: AgendamentoVM;
  buscarSlots: (data: Date, servicoId: string, membroId: string | null) => Promise<SlotPub[]>;
  onCancelar: () => Promise<void>;
  onRemarcar: (novoInicioISO: string) => Promise<void>;
};

const STATUS_INFO: Record<string, { rotulo: string; classe: string }> = {
  confirmado: { rotulo: 'Confirmado', classe: '#2f8c5b' },
  pendente_pagamento: { rotulo: 'Aguardando pagamento do sinal', classe: '#b88c30' },
  concluido: { rotulo: 'Concluído', classe: '#5b4bd6' },
  cancelado: { rotulo: 'Cancelado', classe: '#8a8f9c' },
  faltou: { rotulo: 'Não compareceu', classe: '#c04646' },
};

export function AgendamentoUI({ vm, buscarSlots, onCancelar, onRemarcar }: Acoes) {
  const [confirmando, setConfirmando] = useState(false);
  const [remarcando, setRemarcando] = useState(false);
  const [slot, setSlot] = useState<SlotPub | null>(null);
  const [busy, setBusy] = useState(false);
  const ini = new Date(vm.inicio);
  const ativo = vm.status === 'confirmado' || vm.status === 'pendente_pagamento';
  const dentroDoPrazo = ini.getTime() - Date.now() >= vm.limiteHoras * 3600_000;
  const podeAlterar = ativo && dentroDoPrazo;
  const whats = apenasDigitos(vm.telefone);
  const st = STATUS_INFO[vm.status] ?? STATUS_INFO.cancelado;

  async function executar(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); setConfirmando(false); setRemarcando(false); setSlot(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Algo não saiu como esperado.'); }
    setBusy(false);
  }

  function baixarIcs() {
    const ics = gerarIcs({ titulo: `${vm.servicoNome} — ${vm.negocioNome}`, inicio: ini, fim: new Date(vm.fim), descricao: `Gerencie seu agendamento: ${window.location.origin}/agendamento/${vm.token}`, local: `${vm.endereco} ${vm.cidade}`, uid: vm.token });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = 'meu-agendamento.ics'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--background)', padding: '28px 18px 60px' }}>
      <div style={{ maxWidth: 560, margin: 'auto' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="avatar" style={{ width: 46, height: 46, background: vm.cor, color: '#fff' }}>{iniciais(vm.negocioNome)}</span>
          <div><p style={{ fontWeight: 800, fontSize: 16 }}>{vm.negocioNome}</p><p className="muted" style={{ fontSize: 11 }}>{vm.cidade}</p></div>
        </div>

        <div className="card mt-6" style={{ padding: 26 }}>
          <div className="between">
            <h1 className="text-xl font-bold">Olá, {vm.clienteNome.split(' ')[0]}! 👋</h1>
            <span className="badge" style={{ background: `${st.classe}1a`, color: st.classe }}>{ativo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{st.rotulo}</span>
          </div>
          <div className="mt-5 grid gap-3" style={{ fontSize: 14 }}>
            <p><strong>{vm.servicoNome}</strong> com {vm.membroNome}</p>
            <p className="muted row" style={{ fontSize: 13 }}><Clock3 size={14} />{ini.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatarHora(ini)}–{formatarHora(new Date(vm.fim))}</p>
            {vm.endereco && <p className="muted row" style={{ fontSize: 13 }}><MapPin size={14} />{vm.endereco} · {vm.cidade}</p>}
            <p style={{ fontSize: 13 }}>Total: <strong>{moeda(vm.preco_centavos)}</strong>{vm.sinal_centavos > 0 && <span className="muted"> · sinal de {moeda(vm.sinal_centavos)}</span>}</p>
          </div>

          {ativo && (
            <div className="flex flex-col gap-3 mt-6">
              <Button variant="outline" onClick={baixarIcs}><CalendarPlus size={15} />Adicionar ao calendário</Button>
              {podeAlterar && !remarcando && <Button style={{ background: vm.cor }} onClick={() => setRemarcando(true)}><RefreshCcw size={15} />Remarcar horário</Button>}
              {remarcando && (
                <div className="card" style={{ padding: 18 }}>
                  <SeletorHorario cor={vm.cor} buscarSlots={buscarSlots} servicoId={vm.servicoId} membroId={vm.membroId} slotSel={slot} onSelect={setSlot} />
                  <div className="flex gap-2 mt-5">
                    <Button variant="outline" onClick={() => { setRemarcando(false); setSlot(null); }}>Voltar</Button>
                    <Button style={{ background: vm.cor, flex: 1 }} disabled={!slot || busy} onClick={() => slot && void executar(() => onRemarcar(slot.inicio), 'Pronto! Seu horário foi remarcado. 💜')}>{busy ? 'Remarcando…' : 'Confirmar novo horário'}</Button>
                  </div>
                </div>
              )}
              {podeAlterar && (confirmando
                ? <div className="card" style={{ padding: 16, background: '#fdf2f2', borderColor: '#f3d2d2' }}><p style={{ fontSize: 13 }}>Tem certeza de que quer cancelar? O horário será liberado para outra pessoa.</p><div className="flex gap-2 mt-3"><Button variant="outline" size="sm" onClick={() => setConfirmando(false)}>Manter meu horário</Button><Button size="sm" style={{ background: '#c04646' }} disabled={busy} onClick={() => void executar(onCancelar, 'Agendamento cancelado. Até breve!')}>Sim, cancelar</Button></div></div>
                : <button className="row" style={{ color: '#c04646', fontSize: 13, justifyContent: 'center', gap: 6 }} onClick={() => setConfirmando(true)}><CalendarX2 size={15} />Cancelar agendamento</button>)}
              {ativo && !dentroDoPrazo && <p className="muted text-center" style={{ fontSize: 12, lineHeight: 1.7 }}>Faltam menos de {vm.limiteHoras}h para o seu horário, por isso cancelamento e remarcação online não estão mais disponíveis. Fale com o negócio pelo WhatsApp. 💬</p>}
            </div>
          )}

          {vm.status === 'cancelado' && <p className="muted mt-6" style={{ fontSize: 13, lineHeight: 1.7 }}>Este agendamento foi cancelado. Quando quiser, será um prazer te receber de novo:</p>}
          {vm.status === 'concluido' && <p className="muted mt-6" style={{ fontSize: 13 }}>Esperamos que tenha adorado! ⭐ A avaliação chega na Fase 4 do Agendaí.</p>}
          <div className="flex flex-wrap gap-2 mt-5">
            <Button asChild variant="outline" size="sm"><Link href={`/${vm.slug}`}>Agendar novo horário</Link></Button>
            {whats && <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}`} target="_blank" rel="noreferrer"><MessageCircle size={13} />Falar com o negócio</a></Button>}
          </div>
        </div>
        <p className="muted text-center mt-6" style={{ fontSize: 11 }}>Link pessoal do seu agendamento — não compartilhe. Feito com <strong>agendaí.</strong></p>
      </div>
    </main>
  );
}

/* ── Demonstração ─────────────────────────────────────────────────────────── */
export function AgendamentoDemo({ token }: { token: string }) {
  const { store, setStore, ready } = useDemoStore();
  const ag = store.appointments.find((a) => a.token_publico === token);

  const vm: AgendamentoVM | null = useMemo(() => {
    if (!ag) return null;
    const b = store.business;
    return {
      token, status: ag.status, inicio: ag.inicio_ts, fim: ag.fim_ts, preco_centavos: ag.preco_centavos, sinal_centavos: ag.sinal_centavos,
      servicoId: ag.servico_id, servicoNome: store.services.find((s) => s.id === ag.servico_id)?.nome ?? 'Serviço',
      membroId: ag.membro_id, membroNome: store.members.find((m) => m.id === ag.membro_id)?.nome ?? 'Profissional',
      clienteNome: store.clients.find((c) => c.id === ag.cliente_id)?.nome ?? 'Cliente',
      negocioNome: b.nome, slug: b.slug, telefone: b.telefone, endereco: b.endereco ?? '', cidade: b.cidade,
      cor: b.cor_primaria ?? '#4F46E5', limiteHoras: b.config_cancelamento_limite_horas ?? 4,
    };
  }, [ag, store, token]);

  if (ready && !vm) return <NaoEncontrado />;
  if (!vm || !ag) return <main className="min-h-screen grid place-items-center"><p className="muted">Carregando seu agendamento…</p></main>;

  const buscarSlots: Acoes['buscarSlots'] = async (data, servicoId, membroId) => {
    const serv = store.services.find((s) => s.id === servicoId);
    if (!serv) return [];
    return gerarSlots({ data, duracaoMinutos: serv.duracao_minutos, schedules: store.schedules, appointments: store.appointments.filter((a) => a.id !== ag.id), blocks: store.blocks, membroId, antecedenciaMinimaHoras: store.business.config_antecedencia_minima_horas ?? 2 })
      .map((s) => ({ membro_id: s.membro_id, inicio: s.inicio.toISOString(), fim: s.fim.toISOString() }));
  };

  return <AgendamentoUI vm={vm} buscarSlots={buscarSlots}
    onCancelar={async () => {
      // Regra configurável: cancelou dentro do prazo → estorna o sinal pago.
      const estorna = store.business.config_estorno_cliente_no_prazo ?? true;
      setStore((s) => ({
        ...s,
        appointments: s.appointments.map((a) => a.id === ag.id ? { ...a, status: 'cancelado' as const } : a),
        payments: (s.payments ?? []).map((pg) => pg.agendamento_id === ag.id && pg.tipo === 'sinal'
          ? { ...pg, status: pg.status === 'pago' ? (estorna ? 'estornado' as const : pg.status) : pg.status === 'pendente' ? 'expirado' as const : pg.status }
          : pg),
      }));
      if (estorna && (store.payments ?? []).some((pg) => pg.agendamento_id === ag.id && pg.tipo === 'sinal' && pg.status === 'pago')) {
        toast.success('Sinal estornado (simulação). Em produção, cai de volta via Pix.');
      }
    }}
    onRemarcar={async (novoInicio) => {
      const ini = new Date(novoInicio);
      const dur = new Date(ag.fim_ts).getTime() - new Date(ag.inicio_ts).getTime();
      const fim = new Date(ini.getTime() + dur);
      if (encontrarConflito(store.appointments, { membro_id: ag.membro_id, inicio: ini, fim, ignorarId: ag.id })) throw new Error('Este horário acabou de ser reservado por outra pessoa.');
      setStore((s) => ({ ...s, appointments: s.appointments.map((a) => a.id === ag.id ? { ...a, inicio_ts: ini.toISOString(), fim_ts: fim.toISOString() } : a) }));
    }} />;
}

/* ── Modo real ────────────────────────────────────────────────────────────── */
type TokenJson = {
  status: string; inicio: string; fim: string; preco_centavos: number; sinal_centavos: number;
  negocio: { nome: string; slug: string; telefone: string | null; endereco: string | null; cidade: string | null; cor_primaria: string; cancelamento_limite_horas: number };
  servico: { id: string; nome: string }; profissional: { id: string; nome: string }; cliente: { nome: string };
};

const paraVm = (token: string, d: TokenJson): AgendamentoVM => ({
  token, status: d.status, inicio: d.inicio, fim: d.fim, preco_centavos: d.preco_centavos, sinal_centavos: d.sinal_centavos,
  servicoId: d.servico.id, servicoNome: d.servico.nome, membroId: d.profissional.id, membroNome: d.profissional.nome,
  clienteNome: d.cliente.nome, negocioNome: d.negocio.nome, slug: d.negocio.slug, telefone: d.negocio.telefone ?? '',
  endereco: d.negocio.endereco ?? '', cidade: d.negocio.cidade ?? '', cor: d.negocio.cor_primaria, limiteHoras: d.negocio.cancelamento_limite_horas,
});

export function AgendamentoLive({ token, inicial }: { token: string; inicial: TokenJson }) {
  const [vm, setVm] = useState(() => paraVm(token, inicial));

  const buscarSlots: Acoes['buscarSlots'] = async (dia, servicoId, membroId) => {
    const dataStr = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    const qs = new URLSearchParams({ slug: vm.slug, servico: servicoId, data: dataStr, ...(membroId ? { membro: membroId } : {}) });
    const res = await fetch(`/api/publico/horarios?${qs}`);
    const json: { slots?: Array<{ membro_id: string; inicio_ts: string; fim_ts: string }>; error?: string } = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar horários.');
    return (json.slots ?? []).map((s) => ({ membro_id: s.membro_id, inicio: s.inicio_ts, fim: s.fim_ts }));
  };

  async function acao(body: unknown) {
    const res = await fetch('/api/publico/agendamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json: { error?: string } = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Não foi possível concluir.');
    const atual = await fetch(`/api/publico/agendamento?token=${encodeURIComponent(token)}`);
    const dados: { agendamento?: TokenJson } = await atual.json();
    if (dados.agendamento) setVm(paraVm(token, dados.agendamento));
  }

  return <AgendamentoUI vm={vm} buscarSlots={buscarSlots}
    onCancelar={() => acao({ token, acao: 'cancelar' })}
    onRemarcar={(novo) => acao({ token, acao: 'remarcar', novo_inicio: novo })} />;
}

function NaoEncontrado() {
  return <main className="min-h-screen grid place-items-center p-8"><div className="text-center"><h1 className="text-2xl font-bold">Agendamento não encontrado 😕</h1><p className="muted my-4">O link pode estar incompleto. Confira a mensagem de confirmação que você recebeu.</p><Link className="text-indigo-500 font-semibold" href="/painel">Ir para o Agendaí →</Link></div></main>;
}
