'use client';
import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Ban, X, Clock3, CheckCheck, UserX, CalendarX2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apenasDigitos, iniciais, novoToken, type Appointment, type Store } from '@/lib/demo';
import { encontrarConflito, formatarHora, gerarSlots, membroAtende, sobrepoe } from '@/lib/disponibilidade';
import { moeda } from '@/lib/utils';

export type PersistFn = (collection: 'services' | 'members' | 'schedules' | 'business' | 'clients' | 'blocks' | 'memberServices', payload: unknown, method?: string, id?: string) => Promise<boolean>;
type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean; persist: PersistFn };

const INICIO_DIA = 7;
const FIM_DIA = 21;
const ALTURA_HORA = 56;
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const STATUS: Record<Appointment['status'], { rotulo: string; bg: string; cor: string }> = {
  confirmado: { rotulo: 'Confirmado', bg: '#eef2ff', cor: '#4338ca' },
  pendente_pagamento: { rotulo: 'Aguardando sinal', bg: '#fff6e3', cor: '#b88c30' },
  concluido: { rotulo: 'Concluído', bg: '#eaf7ef', cor: '#2f8c5b' },
  cancelado: { rotulo: 'Cancelado', bg: '#f3f4f6', cor: '#8a8f9c' },
  faltou: { rotulo: 'Faltou', bg: '#fdecec', cor: '#c04646' },
};

const dia0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const segundaDaSemana = (d: Date) => addDias(dia0(d), -((d.getDay() + 6) % 7));
const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function AgendaPanel({ store, setStore, live, persist }: Props) {
  const [view, setView] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [filtroMembro, setFiltroMembro] = useState<string>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [bloqueioAberto, setBloqueioAberto] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const membrosVisiveis = store.members.filter((m) => m.ativo && (filtroMembro === 'todos' || m.id === filtroMembro));
  const nomeCli = (id: string) => store.clients.find((c) => c.id === id)?.nome ?? 'Cliente';
  const nomeServ = (id: string) => store.services.find((s) => s.id === id)?.nome ?? 'Serviço';
  const nomeMem = (id: string) => store.members.find((m) => m.id === id)?.nome ?? 'Profissional';
  const selecionado = store.appointments.find((a) => a.id === selecionadoId) ?? null;

  const doDia = (d: Date, membroId?: string) => store.appointments
    .filter((a) => mesmoDia(new Date(a.inicio_ts), d) && (!membroId || a.membro_id === membroId) && (filtroMembro === 'todos' || a.membro_id === filtroMembro))
    .sort((a, b) => a.inicio_ts.localeCompare(b.inicio_ts));

  function navegar(dir: number) {
    setAnchor((a) => view === 'dia' ? addDias(a, dir) : view === 'semana' ? addDias(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  async function salvarAgendamento(ag: Appointment, anterior?: Appointment) {
    if (live) {
      const res = await fetch('/api/agendamentos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ag.id, status: ag.status, inicio_ts: ag.inicio_ts }) });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? 'Não foi possível salvar.'); return false; }
      toast.success('Agenda atualizada.');
      window.location.reload();
      return true;
    }
    setStore((s) => {
      let clients = s.clients;
      // Espelha o trigger do banco: concluir/faltar alimenta os contadores.
      if (anterior && anterior.status !== ag.status && (ag.status === 'concluido' || ag.status === 'faltou')) {
        clients = s.clients.map((c) => c.id === ag.cliente_id
          ? { ...c, total_agendamentos: c.total_agendamentos + 1, total_faltas: c.total_faltas + (ag.status === 'faltou' ? 1 : 0) }
          : c);
      }
      // Negócio cancelou → estorno automático do sinal pago (regra da Fase 3).
      const payments = ag.status === 'cancelado' && anterior && anterior.status !== 'cancelado'
        ? (s.payments ?? []).map((pg) => pg.agendamento_id === ag.id && pg.tipo === 'sinal' && pg.status === 'pago' ? { ...pg, status: 'estornado' as const } : pg)
        : s.payments;
      return { ...s, clients, payments, appointments: s.appointments.map((a) => (a.id === ag.id ? ag : a)) };
    });
    return true;
  }

  async function remarcar(ag: Appointment, novoInicio: Date) {
    const dur = new Date(ag.fim_ts).getTime() - new Date(ag.inicio_ts).getTime();
    const novoFim = new Date(novoInicio.getTime() + dur);
    if (encontrarConflito(store.appointments, { membro_id: ag.membro_id, inicio: novoInicio, fim: novoFim, ignorarId: ag.id })) {
      toast.error('Este horário já está ocupado para o profissional.');
      return;
    }
    if (store.blocks.some((b) => b.membro_id === ag.membro_id && sobrepoe(novoInicio, novoFim, new Date(b.inicio_ts), new Date(b.fim_ts)))) {
      toast.error('O profissional tem um bloqueio neste horário.');
      return;
    }
    if (await salvarAgendamento({ ...ag, inicio_ts: novoInicio.toISOString(), fim_ts: novoFim.toISOString() }, ag)) {
      toast.success(`Remarcado para ${novoInicio.toLocaleDateString('pt-BR')} às ${formatarHora(novoInicio)}.`);
    }
  }

  function aoSoltar(e: DragEndEvent) {
    if (!e.over) return;
    const ag = store.appointments.find((a) => a.id === String(e.active.id));
    if (!ag || !(ag.status === 'confirmado' || ag.status === 'pendente_pagamento')) return;
    const alvo = String(e.over.id);
    const atual = new Date(ag.inicio_ts);
    if (alvo.startsWith('dia:')) {
      const [y, m, d] = alvo.slice(4).split('-').map(Number);
      void remarcar(ag, new Date(y, m - 1, d, atual.getHours(), atual.getMinutes()));
    } else if (alvo.startsWith('hora:')) {
      const base = new Date(alvo.slice(5));
      void remarcar(ag, new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), atual.getMinutes()));
    }
  }

  const titulo = view === 'dia'
    ? `${DIAS_CURTOS[anchor.getDay()]}, ${anchor.getDate()} de ${MESES[anchor.getMonth()]}`
    : view === 'semana'
      ? `Semana de ${segundaDaSemana(anchor).getDate()} a ${addDias(segundaDaSemana(anchor), 6).getDate()} de ${MESES[addDias(segundaDaSemana(anchor), 6).getMonth()]}`
      : `${MESES[anchor.getMonth()]} de ${anchor.getFullYear()}`;

  return (
    <DndContext sensors={sensors} onDragEnd={aoSoltar}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="between" style={{ padding: '16px 20px', flexWrap: 'wrap', gap: 12 }}>
          <div className="row">
            <button aria-label="Anterior" onClick={() => navegar(-1)}><ChevronLeft size={18} /></button>
            <h2 className="section-title" style={{ textTransform: 'capitalize', minWidth: 190, textAlign: 'center' }}>{titulo}</h2>
            <button aria-label="Próximo" onClick={() => navegar(1)}><ChevronRight size={18} /></button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Hoje</Button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <select aria-label="Filtrar por profissional" value={filtroMembro} onChange={(e) => setFiltroMembro(e.target.value)} style={{ width: 'auto', padding: '9px 12px' }}>
              <option value="todos">Toda a equipe</option>
              {store.members.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <div className="row" style={{ gap: 4, background: 'var(--hover)', borderRadius: 10, padding: 4 }} role="tablist" aria-label="Visão da agenda">
              {(['dia', 'semana', 'mes'] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className="badge" style={{ background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--foreground)' : 'var(--muted)', padding: '7px 12px', fontSize: 11, boxShadow: view === v ? '0 1px 4px #0001' : 'none' }}>{v === 'mes' ? 'Mês' : v === 'dia' ? 'Dia' : 'Semana'}</button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setBloqueioAberto(true)}><Ban size={14} />Bloqueio</Button>
            <Button size="sm" onClick={() => setNovoAberto(true)}><Plus size={14} />Novo agendamento</Button>
          </div>
        </div>

        {view === 'dia' && (
          <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `54px repeat(${Math.max(membrosVisiveis.length, 1)}, minmax(170px, 1fr))`, minWidth: 640 }}>
              <div />
              {membrosVisiveis.map((m) => <div key={m.id} className="row" style={{ justifyContent: 'center', padding: '10px 6px', borderLeft: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}><span className="avatar" style={{ width: 24, height: 24, fontSize: 9, background: '#ede8fa', color: '#7961a6' }}>{iniciais(m.nome)}</span>{m.nome.split(' ')[0]}</div>)}
              <div style={{ position: 'relative' }}>
                {Array.from({ length: FIM_DIA - INICIO_DIA }, (_, i) => <div key={i} style={{ height: ALTURA_HORA, fontSize: 10, color: 'var(--muted)', textAlign: 'right', paddingRight: 8, paddingTop: 4 }}>{String(INICIO_DIA + i).padStart(2, '0')}:00</div>)}
              </div>
              {membrosVisiveis.map((m) => (
                <div key={m.id} style={{ position: 'relative', borderLeft: '1px solid var(--border)' }}>
                  {Array.from({ length: FIM_DIA - INICIO_DIA }, (_, i) => {
                    const hora = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), INICIO_DIA + i);
                    return <CelulaHora key={i} id={`hora:${hora.toISOString()}`} />;
                  })}
                  {doDia(anchor, m.id).map((ag) => {
                    const ini = new Date(ag.inicio_ts); const fim = new Date(ag.fim_ts);
                    const top = ((ini.getHours() * 60 + ini.getMinutes()) - INICIO_DIA * 60) / 60 * ALTURA_HORA;
                    const altura = Math.max(((fim.getTime() - ini.getTime()) / 3600_000) * ALTURA_HORA - 4, 32);
                    return <Chip key={ag.id} ag={ag} titulo={nomeCli(ag.cliente_id)} subtitulo={nomeServ(ag.servico_id)} onClick={() => setSelecionadoId(ag.id)} style={{ position: 'absolute', top, height: altura, left: 4, right: 4, zIndex: 2 }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'semana' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(138px, 1fr))', overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
            {Array.from({ length: 7 }, (_, i) => addDias(segundaDaSemana(anchor), i)).map((d) => (
              <ColunaDia key={chaveDia(d)} id={`dia:${chaveDia(d)}`} hoje={mesmoDia(d, new Date())}>
                <div style={{ textAlign: 'center', padding: '10px 4px 8px' }}>
                  <p className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{DIAS_CURTOS[d.getDay()]}</p>
                  <p style={{ fontWeight: 800, fontSize: 16, color: mesmoDia(d, new Date()) ? '#5b4bd6' : undefined }}>{d.getDate()}</p>
                </div>
                <div style={{ display: 'grid', gap: 6, padding: 6, minHeight: 180 }}>
                  {doDia(d).map((ag) => <Chip key={ag.id} ag={ag} titulo={nomeCli(ag.cliente_id)} subtitulo={nomeServ(ag.servico_id)} onClick={() => setSelecionadoId(ag.id)} />)}
                </div>
              </ColunaDia>
            ))}
          </div>
        )}

        {view === 'mes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--border)' }}>
            {Array.from({ length: 42 }, (_, i) => addDias(segundaDaSemana(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), i)).map((d) => {
              const lista = doDia(d);
              const fora = d.getMonth() !== anchor.getMonth();
              return (
                <button key={chaveDia(d)} onClick={() => { setAnchor(d); setView('dia'); }} style={{ minHeight: 86, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 8, textAlign: 'left', opacity: fora ? 0.45 : 1, background: mesmoDia(d, new Date()) ? '#f6f3ff' : undefined }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{d.getDate()}</span>
                  {lista.slice(0, 3).map((ag) => <span key={ag.id} style={{ display: 'block', fontSize: 9, marginTop: 4, background: STATUS[ag.status].bg, color: STATUS[ag.status].cor, borderRadius: 5, padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarHora(new Date(ag.inicio_ts))} {nomeCli(ag.cliente_id).split(' ')[0]}</span>)}
                  {lista.length > 3 && <span className="muted" style={{ fontSize: 9 }}>+{lista.length - 3} mais</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="muted text-[11px] mt-3">💡 Arraste um agendamento para outro dia (visão semana) ou outro horário (visão dia) para remarcar. Clique para ver detalhes e mudar o status.</p>

      {store.blocks.length > 0 && (
        <div className="card mt-5" style={{ padding: 20 }}>
          <h3 className="section-title" style={{ fontSize: 14 }}>Bloqueios e folgas</h3>
          <div className="mt-4 grid gap-2">
            {[...store.blocks].sort((a, b) => a.inicio_ts.localeCompare(b.inicio_ts)).map((b) => (
              <div key={b.id} className="between" style={{ fontSize: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span><strong>{nomeMem(b.membro_id)}</strong> · {new Date(b.inicio_ts).toLocaleDateString('pt-BR')} {formatarHora(new Date(b.inicio_ts))}–{formatarHora(new Date(b.fim_ts))}{b.motivo ? ` · ${b.motivo}` : ''}</span>
                <button aria-label="Remover bloqueio" onClick={async () => { if (live) { if (await persist('blocks', {}, 'DELETE', b.id)) window.location.reload(); } else setStore((s) => ({ ...s, blocks: s.blocks.filter((v) => v.id !== b.id) })); }}><Trash2 size={15} className="text-rose-400" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {novoAberto && <NovoAgendamento store={store} setStore={setStore} live={live} fechar={() => setNovoAberto(false)} />}
      {bloqueioAberto && <NovoBloqueio store={store} setStore={setStore} live={live} persist={persist} fechar={() => setBloqueioAberto(false)} />}

      {selecionado && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelecionadoId(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="detalhe-titulo">
            <div className="between"><h2 id="detalhe-titulo" className="text-xl font-bold">{nomeCli(selecionado.cliente_id)}</h2><button aria-label="Fechar" onClick={() => setSelecionadoId(null)}><X size={20} /></button></div>
            <div className="form-grid" style={{ gap: 12 }}>
              <p style={{ fontSize: 13 }}>{nomeServ(selecionado.servico_id)} com {nomeMem(selecionado.membro_id)}</p>
              <p className="muted row" style={{ fontSize: 12 }}><Clock3 size={14} />{new Date(selecionado.inicio_ts).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatarHora(new Date(selecionado.inicio_ts))}–{formatarHora(new Date(selecionado.fim_ts))}</p>
              <p style={{ fontSize: 13 }}><strong>{moeda(selecionado.preco_centavos)}</strong> {selecionado.sinal_centavos > 0 && <span className="muted">· sinal de {moeda(selecionado.sinal_centavos)}</span>}</p>
              <span className="badge" style={{ background: STATUS[selecionado.status].bg, color: STATUS[selecionado.status].cor, justifySelf: 'start' }}>{STATUS[selecionado.status].rotulo}</span>
              {(selecionado.status === 'confirmado' || selecionado.status === 'pendente_pagamento') && (
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button size="sm" onClick={async () => { if (await salvarAgendamento({ ...selecionado, status: 'concluido' }, selecionado)) setSelecionadoId(null); }}><CheckCheck size={14} />Concluir</Button>
                  <Button size="sm" variant="outline" onClick={async () => { if (await salvarAgendamento({ ...selecionado, status: 'faltou' }, selecionado)) setSelecionadoId(null); }}><UserX size={14} />Faltou</Button>
                  <Button size="sm" variant="outline" onClick={async () => { if (await salvarAgendamento({ ...selecionado, status: 'cancelado' }, selecionado)) setSelecionadoId(null); }}><CalendarX2 size={14} />Cancelar</Button>
                </div>
              )}
              <a className="text-indigo-500 text-xs font-semibold row" href={`/agendamento/${selecionado.token_publico}`} target="_blank" rel="noreferrer">Link do cliente (ver/cancelar/remarcar)<ExternalLink size={12} /></a>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function CelulaHora({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} style={{ height: ALTURA_HORA, borderBottom: '1px dashed var(--border)', background: isOver ? '#eef2ff' : undefined }} />;
}

function ColunaDia({ id, hoje, children }: { id: string; hoje: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} style={{ borderLeft: '1px solid var(--border)', background: isOver ? '#eef2ff' : hoje ? '#faf9ff' : undefined, alignSelf: 'start' }}>{children}</div>;
}

function Chip({ ag, titulo, subtitulo, onClick, style }: { ag: Appointment; titulo: string; subtitulo: string; onClick: () => void; style?: React.CSSProperties }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ag.id, disabled: !(ag.status === 'confirmado' || ag.status === 'pendente_pagamento') });
  const st = STATUS[ag.status];
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} aria-label={`${titulo}, ${subtitulo}, às ${formatarHora(new Date(ag.inicio_ts))}`}
      style={{ ...style, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 30 : style?.zIndex, background: st.bg, color: st.cor, border: `1px solid ${st.cor}33`, borderRadius: 9, padding: '6px 8px', textAlign: 'left', cursor: 'grab', touchAction: 'none', overflow: 'hidden' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarHora(new Date(ag.inicio_ts))} · {titulo.split(' ')[0]}</span>
      <span style={{ display: 'block', fontSize: 9, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitulo}</span>
    </button>
  );
}

function NovoAgendamento({ store, setStore, live, fechar }: Omit<Props, 'persist'> & { fechar: () => void }) {
  const hoje = new Date();
  const [clienteSel, setClienteSel] = useState('novo');
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [servicoId, setServicoId] = useState(store.services[0]?.id ?? '');
  const servico = store.services.find((s) => s.id === servicoId);
  const candidatos = store.members.filter((m) => m.ativo && servico && membroAtende(m, servico.id));
  const [membroId, setMembroId] = useState('');
  const membroEfetivo = membroId && candidatos.some((m) => m.id === membroId) ? membroId : candidatos[0]?.id ?? '';
  const [data, setData] = useState(chaveDia(hoje));
  const [inicioSel, setInicioSel] = useState('');
  const [busy, setBusy] = useState(false);

  const slots = useMemo(() => {
    if (!servico || !membroEfetivo) return [];
    const [y, m, d] = data.split('-').map(Number);
    return gerarSlots({ data: new Date(y, m - 1, d), duracaoMinutos: servico.duracao_minutos, schedules: store.schedules, appointments: store.appointments, blocks: store.blocks, membroId: membroEfetivo, antecedenciaMinimaHoras: 0, agora: new Date(0) });
  }, [data, servico, membroEfetivo, store]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!servico || !membroEfetivo || !inicioSel) { toast.error('Escolha o serviço, o profissional e um horário livre.'); return; }
    const inicio = new Date(inicioSel);
    setBusy(true);
    if (live) {
      const res = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: clienteSel !== 'novo' ? clienteSel : undefined, novo_cliente: clienteSel === 'novo' ? { nome, whatsapp: whats } : undefined, membro_id: membroEfetivo, servico_id: servico.id, inicio_ts: inicio.toISOString() }) });
      const dataRes: { error?: string } = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) { toast.error(dataRes.error ?? 'Não foi possível agendar.'); return; }
      toast.success('Agendamento criado.');
      window.location.reload();
      return;
    }
    const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60_000);
    if (encontrarConflito(store.appointments, { membro_id: membroEfetivo, inicio, fim })) { setBusy(false); toast.error('Este horário acabou de ser ocupado.'); return; }
    setStore((s) => {
      let clients = s.clients;
      let clienteId = clienteSel;
      if (clienteSel === 'novo') {
        const digitos = apenasDigitos(whats);
        const normalizado = digitos.length <= 11 ? `55${digitos}` : digitos;
        const existente = s.clients.find((c) => c.whatsapp === normalizado);
        if (existente) clienteId = existente.id;
        else {
          clienteId = crypto.randomUUID();
          clients = [...s.clients, { id: clienteId, nome: nome.trim(), whatsapp: normalizado, email: '', observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: new Date().toISOString() }];
        }
      }
      const ag: Appointment = { id: crypto.randomUUID(), cliente_id: clienteId, membro_id: membroEfetivo, servico_id: servico.id, inicio_ts: inicio.toISOString(), fim_ts: fim.toISOString(), status: 'confirmado', origem: 'painel', preco_centavos: servico.preco_centavos, sinal_centavos: 0, token_publico: novoToken() };
      return { ...s, clients, appointments: [...s.appointments, ag] };
    });
    setBusy(false);
    toast.success('Agendamento criado.');
    fechar();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="novo-agendamento">
        <div className="between"><h2 id="novo-agendamento" className="text-xl font-bold">Novo agendamento</h2><button aria-label="Fechar" onClick={fechar}><X size={20} /></button></div>
        <form className="form-grid" onSubmit={salvar}>
          <label>Cliente<select value={clienteSel} onChange={(e) => setClienteSel(e.target.value)}><option value="novo">＋ Novo cliente</option>{store.clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          {clienteSel === 'novo' && <div className="grid grid-cols-2 gap-4"><label>Nome<input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" /></label><label>WhatsApp<input required value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(81) 99999-1234" /></label></div>}
          <div className="grid grid-cols-2 gap-4">
            <label>Serviço<select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>{store.services.map((s) => <option key={s.id} value={s.id}>{s.nome} · {moeda(s.preco_centavos)}</option>)}</select></label>
            <label>Profissional<select value={membroEfetivo} onChange={(e) => setMembroId(e.target.value)}>{candidatos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>Data<input type="date" required value={data} onChange={(e) => { setData(e.target.value); setInicioSel(''); }} /></label>
            <label>Horário livre<select required value={inicioSel} onChange={(e) => setInicioSel(e.target.value)}><option value="">Selecione…</option>{slots.map((s) => <option key={s.inicio.toISOString()} value={s.inicio.toISOString()}>{formatarHora(s.inicio)}</option>)}</select></label>
          </div>
          {slots.length === 0 && <p className="muted text-xs">Sem horários livres neste dia para este profissional. Confira a jornada em Horários ou escolha outra data.</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={fechar}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Agendar'}</Button></div>
        </form>
      </div>
    </div>
  );
}

function NovoBloqueio({ store, setStore, live, persist, fechar }: Props & { fechar: () => void }) {
  const [busy, setBusy] = useState(false);
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const membro_id = String(f.get('membro_id'));
    const data = String(f.get('data'));
    const inicio = new Date(`${data}T${String(f.get('inicio'))}:00`);
    const fim = new Date(`${data}T${String(f.get('fim'))}:00`);
    if (fim <= inicio) { toast.error('O fim do bloqueio deve ser depois do início.'); return; }
    setBusy(true);
    if (live) {
      const ok = await persist('blocks', { membro_id, inicio_ts: inicio.toISOString(), fim_ts: fim.toISOString(), motivo: String(f.get('motivo') ?? '') });
      setBusy(false);
      if (ok) window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, blocks: [...s.blocks, { id: crypto.randomUUID(), membro_id, inicio_ts: inicio.toISOString(), fim_ts: fim.toISOString(), motivo: String(f.get('motivo') ?? '') }] }));
    setBusy(false);
    toast.success('Bloqueio criado.');
    fechar();
  }
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="novo-bloqueio">
        <div className="between"><h2 id="novo-bloqueio" className="text-xl font-bold">Bloquear horário</h2><button aria-label="Fechar" onClick={fechar}><X size={20} /></button></div>
        <p className="muted text-xs mt-2">Folgas, férias e compromissos: o horário some da página pública.</p>
        <form className="form-grid" onSubmit={salvar}>
          <label>Profissional<select name="membro_id" required>{store.members.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
          <label>Data<input type="date" name="data" required defaultValue={chaveDia(new Date())} /></label>
          <div className="grid grid-cols-2 gap-4"><label>Das<input type="time" name="inicio" required defaultValue="09:00" /></label><label>Até<input type="time" name="fim" required defaultValue="18:00" /></label></div>
          <label>Motivo (opcional)<input name="motivo" maxLength={200} placeholder="Ex.: Folga, consulta médica…" /></label>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={fechar}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Bloquear'}</Button></div>
        </form>
      </div>
    </div>
  );
}
