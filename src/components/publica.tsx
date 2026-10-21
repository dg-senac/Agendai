'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const Calendario = dynamic(() => import('./calendario'), { ssr: false, loading: () => <p className="muted" style={{ fontSize: 12, padding: 24 }}>Carregando calendário…</p> });
const CarrosselAvaliacoes = dynamic(() => import('./carrossel-avaliacoes'), { ssr: false });
import { LazyMotion, domAnimation, m, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Clock3, Loader2, MapPin, MessageCircle, Scissors, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemoStore } from '@/components/use-demo-store';
import { apenasDigitos, iniciais, novoToken, type Appointment, type Business, type Member, type Review, type Service } from '@/lib/demo';
import { encontrarConflito, formatarHora, gerarIcs, gerarSlots, membroAtende } from '@/lib/disponibilidade';
import { moeda } from '@/lib/utils';

export type SlotPub = { membro_id: string; inicio: string; fim: string };
export type ResultadoAgendar = { token: string; status: string; sinal_centavos: number; preco_centavos: number; membro_id: string; inicio: string; fim: string };
type DadosCliente = { nome: string; whatsapp: string; email: string; observacoes: string; consentimento: boolean };

type UiProps = {
  business: Business; services: Service[]; members: Member[]; reviews: Review[];
  buscarSlots: (data: Date, servicoId: string, membroId: string | null) => Promise<SlotPub[]>;
  agendar: (d: { servicoId: string; membroId: string | null; inicio: string; cliente: DadosCliente }) => Promise<ResultadoAgendar>;
};

const formatarWhats = (v: string) => {
  const d = apenasDigitos(v).replace(/^55/, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const ETAPAS = ['Serviço', 'Profissional', 'Data e hora', 'Seus dados', 'Resumo'];

export function PublicaUI({ business, services, members, reviews, buscarSlots, agendar }: UiProps) {
  const cor = business.cor_primaria ?? '#4F46E5';
  const [step, setStep] = useState(0);
  const [servico, setServico] = useState<Service | null>(null);
  const [membroSel, setMembroSel] = useState<string | null>(null); // null = qualquer
  const [slot, setSlot] = useState<SlotPub | null>(null);
  const [cliente, setCliente] = useState<DadosCliente>({ nome: '', whatsapp: '', email: '', observacoes: '', consentimento: false });
  const [resultado, setResultado] = useState<ResultadoAgendar | null>(null);
  const [busy, setBusy] = useState(false);
  const wizardRef = useRef<HTMLDivElement>(null);

  const profissionaisDoServico = useMemo(() => (servico ? members.filter((m) => m.ativo && membroAtende(m, servico.id)) : []), [servico, members]);
  const sinalPrevisao = servico?.exige_sinal ? Math.round(servico.preco_centavos * (business.config_sinal_percentual ?? 30) / 100) : 0;
  const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.nome} ${business.endereco ?? ''} ${business.cidade}`)}`;
  const whatsNegocio = apenasDigitos(business.telefone ?? '');

  const irPara = (s: number) => { setStep(s); wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  async function confirmar() {
    if (!servico || !slot) return;
    setBusy(true);
    try {
      const r = await agendar({ servicoId: servico.id, membroId: membroSel, inicio: slot.inicio, cliente });
      setResultado(r);
      setStep(5);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 }, colors: [cor, '#a5b4fc', '#fbcfe8'] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.');
    }
    setBusy(false);
  }

  function baixarIcs() {
    if (!resultado || !servico) return;
    const ics = gerarIcs({ titulo: `${servico.nome} — ${business.nome}`, inicio: new Date(resultado.inicio), fim: new Date(resultado.fim), descricao: `Seu horário no ${business.nome}. Gerencie em ${window.location.origin}/agendamento/${resultado.token}`, local: `${business.endereco ?? ''} ${business.cidade}`, uid: resultado.token });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = 'meu-agendamento.ics'; a.click();
    URL.revokeObjectURL(url);
  }

  const membroResultado = resultado ? members.find((m) => m.id === resultado.membro_id) : null;

  return (
    <LazyMotion features={domAnimation}>
      <div style={{ ['--pub-cor' as string]: cor, minHeight: '100vh', background: 'var(--background)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(10px)', background: 'color-mix(in srgb, var(--surface) 82%, transparent)', borderBottom: '1px solid var(--border)' }}>
          <div className="between" style={{ maxWidth: 880, margin: 'auto', padding: '12px 20px' }}>
            <div className="row"><span className="avatar" style={{ width: 38, height: 38, background: cor, color: '#fff', fontSize: 13 }}>{iniciais(business.nome)}</span><div><p style={{ fontWeight: 800, fontSize: 15 }}>{business.nome}</p><p className="muted" style={{ fontSize: 11 }}>{business.cidade}</p></div></div>
            {whatsNegocio && <a className="badge" style={{ background: '#e6f7ee', color: '#178a52', padding: '8px 12px', fontSize: 11 }} href={`https://wa.me/${whatsNegocio.length <= 11 ? `55${whatsNegocio}` : whatsNegocio}`} target="_blank" rel="noreferrer"><MessageCircle size={13} />WhatsApp</a>}
          </div>
        </header>

        <main style={{ maxWidth: 880, margin: 'auto', padding: '26px 20px 70px' }}>
          <section style={{ textAlign: 'center', padding: '18px 6px 28px' }}>
            <span className="avatar" style={{ width: 76, height: 76, background: cor, color: '#fff', fontSize: 26, margin: 'auto' }}>{iniciais(business.nome)}</span>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 16 }}>{business.nome}</h1>
            {business.descricao && <p className="muted" style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, maxWidth: 520, marginInline: 'auto' }}>{business.descricao}</p>}
            {business.endereco && <a href={mapaUrl} target="_blank" rel="noreferrer" className="row muted" style={{ justifyContent: 'center', fontSize: 12, marginTop: 12, gap: 5 }}><MapPin size={13} />{business.endereco} · {business.cidade} — ver no mapa</a>}
          </section>

          <div ref={wizardRef} className="card" style={{ padding: 24, scrollMarginTop: 90 }} aria-live="polite">
            {step < 5 && (
              <>
                <ol className="flex gap-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Etapas do agendamento">
                  {ETAPAS.map((e, i) => (
                    <li key={e} style={{ flex: 1 }}>
                      <div className="progress-track"><div style={{ width: i <= step ? '100%' : '0%', background: cor, transition: 'width .3s' }} /></div>
                      <span style={{ fontSize: 9, fontWeight: i === step ? 800 : 500, color: i === step ? 'var(--foreground)' : 'var(--muted)', display: 'block', marginTop: 5 }}>{e}</span>
                    </li>
                  ))}
                </ol>
                {step > 0 && <button className="row muted mt-4" style={{ fontSize: 12, gap: 5 }} onClick={() => setStep(step - 1)}><ArrowLeft size={13} />Voltar</button>}
              </>
            )}

            <AnimatePresence mode="wait">
              <m.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                {step === 0 && (
                  <div className="mt-5">
                    <h2 className="text-lg font-bold">O que você quer fazer hoje? ✨</h2>
                    <div className="grid gap-3 mt-4">
                      {services.filter((s) => s.ativo).map((s) => (
                        <button key={s.id} className="card between" style={{ padding: 18, textAlign: 'left', borderColor: servico?.id === s.id ? cor : undefined }} onClick={() => { setServico(s); setMembroSel(null); setSlot(null); irPara(1); }}>
                          <span className="row" style={{ gap: 14 }}><span style={{ background: `${cor}1a`, color: cor, padding: 11, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Scissors size={19} /></span><span><span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{s.nome}</span>{s.descricao && <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{s.descricao}</span>}<span className="muted row" style={{ fontSize: 11, marginTop: 5, gap: 5 }}><Clock3 size={11} />{s.duracao_minutos} min{s.exige_sinal ? ' · pede sinal para reservar' : ''}</span></span></span>
                          <strong style={{ fontSize: 15 }}>{moeda(s.preco_centavos)}</strong>
                        </button>
                      ))}
                      {services.length === 0 && <p className="empty">Este negócio ainda não publicou serviços.</p>}
                    </div>
                  </div>
                )}

                {step === 1 && servico && (
                  <div className="mt-4">
                    <h2 className="text-lg font-bold">Com quem você quer ser atendido(a)?</h2>
                    <div className="grid gap-3 mt-4">
                      <button className="card between" style={{ padding: 16, textAlign: 'left' }} onClick={() => { setMembroSel(null); setSlot(null); irPara(2); }}>
                        <span className="row"><span className="avatar" style={{ width: 42, height: 42, background: `${cor}1a`, color: cor }}><UserRound size={19} /></span><span><span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>Qualquer profissional</span><span className="muted" style={{ fontSize: 11 }}>Mais horários disponíveis</span></span></span><ArrowRight size={15} className="muted" />
                      </button>
                      {profissionaisDoServico.map((mem) => (
                        <button key={mem.id} className="card between" style={{ padding: 16, textAlign: 'left' }} onClick={() => { setMembroSel(mem.id); setSlot(null); irPara(2); }}>
                          <span className="row"><span className="avatar" style={{ width: 42, height: 42, background: '#ede8fa', color: '#7961a6' }}>{iniciais(mem.nome)}</span><span style={{ fontWeight: 700, fontSize: 13 }}>{mem.nome}</span></span><ArrowRight size={15} className="muted" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && servico && <SeletorHorario cor={cor} buscarSlots={buscarSlots} servicoId={servico.id} membroId={membroSel} slotSel={slot} onSelect={(s) => { setSlot(s); }} onContinuar={() => irPara(3)} />}

                {step === 3 && (
                  <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (apenasDigitos(cliente.whatsapp).length < 10) { toast.error('Informe um WhatsApp válido com DDD.'); return; } if (!cliente.consentimento) { toast.error('Autorize o uso dos seus dados para continuar (LGPD).'); return; } irPara(4); }}>
                    <h2 className="text-lg font-bold">Quase lá! Seus dados</h2>
                    <div className="form-grid" style={{ marginTop: 18 }}>
                      <label>Seu nome<input required minLength={2} maxLength={100} value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Ex.: Maria Silva" autoComplete="name" /></label>
                      <label>WhatsApp<input required value={cliente.whatsapp} onChange={(e) => setCliente({ ...cliente, whatsapp: formatarWhats(e.target.value) })} placeholder="(81) 99999-1234" inputMode="tel" autoComplete="tel" /></label>
                      <label>E-mail (para receber a confirmação)<input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} placeholder="voce@email.com.br" autoComplete="email" /></label>
                      <label>Alguma observação? (opcional)<input value={cliente.observacoes} onChange={(e) => setCliente({ ...cliente, observacoes: e.target.value })} placeholder="Ex.: primeira vez aqui" maxLength={500} /></label>
                      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400, fontSize: 12, lineHeight: 1.6 }}>
                        <input type="checkbox" checked={cliente.consentimento} onChange={(e) => setCliente({ ...cliente, consentimento: e.target.checked })} style={{ width: 17, height: 17, marginTop: 2 }} />
                        Autorizo o {business.nome} a usar meu nome, WhatsApp e e-mail para confirmar e lembrar deste agendamento, conforme a LGPD. Posso pedir a exclusão dos meus dados quando quiser.
                      </label>
                      <Button type="submit" style={{ background: cor }}>Ver resumo<ArrowRight size={15} /></Button>
                    </div>
                  </form>
                )}

                {step === 4 && servico && slot && (
                  <div className="mt-4">
                    <h2 className="text-lg font-bold">Confira seu agendamento</h2>
                    <div className="card mt-4" style={{ padding: 18, background: 'var(--hover)' }}>
                      {[
                        ['Serviço', servico.nome],
                        ['Profissional', membroSel ? (members.find((m) => m.id === membroSel)?.nome ?? '') : (members.find((m) => m.id === slot.membro_id)?.nome ?? 'A definir')],
                        ['Quando', `${new Date(slot.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às ${formatarHora(new Date(slot.inicio))}`],
                        ['Cliente', `${cliente.nome} · ${cliente.whatsapp}`],
                      ].map(([r, v]) => <div key={r} className="between" style={{ padding: '8px 0', fontSize: 13 }}><span className="muted">{r}</span><strong style={{ textAlign: 'right' }}>{v}</strong></div>)}
                      <div className="between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6, fontSize: 14 }}><span>Total no atendimento</span><strong style={{ fontSize: 17 }}>{moeda(servico.preco_centavos)}</strong></div>
                      {sinalPrevisao > 0 && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Este serviço pede um sinal de {moeda(sinalPrevisao)} para reservar o horário. O pagamento via Pix será solicitado na próxima etapa do Agendaí (Fase 3); por enquanto, seu horário fica reservado e o negócio confirma com você.</p>}
                    </div>
                    <Button className="w-full mt-5" style={{ background: cor, padding: 15 }} disabled={busy} onClick={confirmar}>{busy ? <><Loader2 size={16} className="animate-spin" />Reservando seu horário…</> : <>Confirmar agendamento<Check size={16} /></>}</Button>
                    <p className="muted text-center" style={{ fontSize: 11, marginTop: 10 }}>Cancelamento gratuito até {business.config_cancelamento_limite_horas ?? 4}h antes, pelo link que você receberá.</p>
                  </div>
                )}

                {step === 5 && resultado && servico && (
                  <div className="text-center" style={{ padding: '14px 4px 6px' }}>
                    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label="Agendamento confirmado" style={{ margin: 'auto' }}>
                      <circle cx="42" cy="42" r="38" fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray="239" strokeDashoffset="0" style={{ animation: 'drawCircle .6s ease-out' }} />
                      <path d="M27 43 L38 54 L58 32" fill="none" stroke={cor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="46" strokeDashoffset="0" style={{ animation: 'drawCircle .45s .35s ease-out backwards' }} />
                    </svg>
                    <h2 className="text-2xl font-bold mt-5">{resultado.status === 'pendente_pagamento' ? 'Horário reservado! ⏳' : 'Agendamento confirmado! 🎉'}</h2>
                    <p className="muted mt-3" style={{ fontSize: 13, lineHeight: 1.8 }}>
                      {servico.nome} com {membroResultado?.nome ?? 'a equipe'}<br />
                      {new Date(resultado.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às {formatarHora(new Date(resultado.inicio))}
                      {resultado.status === 'pendente_pagamento' && <><br />Falta só o sinal de {moeda(resultado.sinal_centavos)} — o Pix chega na Fase 3 do Agendaí; o negócio falará com você no WhatsApp.</>}
                    </p>
                    <div className="flex flex-col gap-3 mt-7" style={{ maxWidth: 340, marginInline: 'auto' }}>
                      <Button asChild style={{ background: cor }}><Link href={`/agendamento/${resultado.token}`}>Ver / remarcar / cancelar meu agendamento</Link></Button>
                      <Button variant="outline" onClick={baixarIcs}><CalendarPlus size={15} />Adicionar ao calendário (.ics)</Button>
                      <button className="muted" style={{ fontSize: 12 }} onClick={() => { setStep(0); setSlot(null); setResultado(null); }}>Agendar outro serviço</button>
                    </div>
                    <p className="muted mt-6" style={{ fontSize: 11 }}>Guarde o link acima: é com ele que você remarca ou cancela, sem precisar de senha. 💜</p>
                  </div>
                )}
              </m.div>
            </AnimatePresence>
          </div>

          {members.length > 0 && (
            <section style={{ marginTop: 36 }}>
              <h2 className="section-title">Quem vai cuidar de você</h2>
              <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {members.filter((m) => m.ativo).map((mem) => (
                  <div key={mem.id} className="card" style={{ padding: 18, textAlign: 'center' }}>
                    <span className="avatar" style={{ width: 54, height: 54, background: '#ede8fa', color: '#7961a6', fontSize: 17, margin: 'auto' }}>{iniciais(mem.nome)}</span>
                    <p style={{ fontWeight: 700, fontSize: 13, marginTop: 10 }}>{mem.nome}</p>
                    <p className="muted" style={{ fontSize: 11, marginTop: 3 }}>{mem.papel === 'dono' ? 'Fundadora' : 'Especialista'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reviews.length > 0 && <CarrosselAvaliacoes reviews={reviews} cor={cor} />}

          <footer className="muted text-center" style={{ marginTop: 44, fontSize: 11 }}>
            <p>Agendamento online por <strong>agendaí.</strong> 💜</p>
          </footer>
        </main>
      </div>
    </LazyMotion>
  );
}

export function SeletorHorario({ cor, buscarSlots, servicoId, membroId, slotSel, onSelect, onContinuar }: {
  cor: string; buscarSlots: UiProps['buscarSlots']; servicoId: string; membroId: string | null;
  slotSel: SlotPub | null; onSelect: (s: SlotPub) => void; onContinuar?: () => void;
}) {
  const [data, setData] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<SlotPub[]>([]);
  const [carregando, setCarregando] = useState(false);
  const hoje = useMemo(() => new Date(), []);
  const limite = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 60), [hoje]);

  const carregar = useCallback(async (d: Date) => {
    setCarregando(true);
    try { setSlots(await buscarSlots(d, servicoId, membroId)); }
    catch { toast.error('Não foi possível buscar os horários deste dia.'); setSlots([]); }
    setCarregando(false);
  }, [buscarSlots, servicoId, membroId]);

  useEffect(() => { if (data) void carregar(data); }, [data, carregar]);

  const tempos = useMemo(() => {
    const mapa = new Map<string, SlotPub>();
    for (const s of slots) if (!mapa.has(s.inicio)) mapa.set(s.inicio, s);
    return [...mapa.values()];
  }, [slots]);

  return (
    <div className="mt-4">
      <h2 className="text-lg font-bold">Escolha o dia e o horário</h2>
      <div className="pub-calendario mt-4">
        <Calendario selected={data} onSelect={setData} hoje={hoje} limite={limite} />
      </div>
      {data && (
        <div className="mt-5">
          <p style={{ fontSize: 13, fontWeight: 700 }}>Horários livres — {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          {carregando ? <p className="muted row mt-4" style={{ fontSize: 12 }}><Loader2 size={15} className="animate-spin" />Buscando horários…</p>
            : tempos.length === 0 ? <p className="muted mt-4" style={{ fontSize: 12, lineHeight: 1.7 }}>Nenhum horário livre neste dia. 😕<br />Experimente outra data — a agenda abre novas vagas toda semana.</p>
            : (
              <div className="flex flex-wrap gap-2 mt-3">
                {tempos.map((s) => {
                  const ativo = slotSel?.inicio === s.inicio;
                  return <button key={s.inicio} onClick={() => onSelect(s)} aria-pressed={ativo} className="badge" style={{ padding: '10px 14px', fontSize: 12, borderRadius: 10, background: ativo ? cor : 'var(--hover)', color: ativo ? '#fff' : 'var(--foreground)', border: `1px solid ${ativo ? cor : 'var(--border)'}` }}>{formatarHora(new Date(s.inicio))}</button>;
                })}
              </div>
            )}
          {onContinuar && <Button className="w-full mt-6" style={{ background: cor }} disabled={!slotSel || !data || new Date(slotSel.inicio).toDateString() !== data.toDateString()} onClick={onContinuar}>Continuar<ArrowRight size={15} /></Button>}
        </div>
      )}
      {!data && <p className="muted mt-4" style={{ fontSize: 12 }}>Toque em um dia do calendário para ver os horários livres.</p>}
    </div>
  );
}

/* ── Demonstração (localStorage) ──────────────────────────────────────────── */
export function PublicaDemo({ slug }: { slug: string }) {
  const { store, setStore, ready } = useDemoStore();

  const buscarSlots: UiProps['buscarSlots'] = async (data, servicoId, membroId) => {
    const servicoAtual = store.services.find((s) => s.id === servicoId);
    if (!servicoAtual) return [];
    const aptos = new Set(store.members.filter((m) => m.ativo && membroAtende(m, servicoId)).map((m) => m.id));
    return gerarSlots({
      data, duracaoMinutos: servicoAtual.duracao_minutos,
      schedules: store.schedules.filter((h) => aptos.has(h.membro_id)),
      appointments: store.appointments, blocks: store.blocks,
      membroId, antecedenciaMinimaHoras: store.business.config_antecedencia_minima_horas ?? 2,
    }).map((s) => ({ membro_id: s.membro_id, inicio: s.inicio.toISOString(), fim: s.fim.toISOString() }));
  };

  const agendar: UiProps['agendar'] = async ({ servicoId, membroId, inicio, cliente }) => {
    const servicoAtual = store.services.find((s) => s.id === servicoId);
    if (!servicoAtual) throw new Error('Serviço não encontrado.');
    const ini = new Date(inicio);
    const livres = await buscarSlots(ini, servicoId, membroId);
    const escolhido = livres.find((s) => s.inicio === ini.toISOString());
    if (!escolhido) throw new Error('Este horário não está mais disponível. Escolha outro, por favor.');
    const fim = new Date(ini.getTime() + servicoAtual.duracao_minutos * 60_000);
    if (encontrarConflito(store.appointments, { membro_id: escolhido.membro_id, inicio: ini, fim })) {
      throw new Error('Este horário acabou de ser reservado por outra pessoa.');
    }
    const digitos = apenasDigitos(cliente.whatsapp);
    const whats = digitos.length <= 11 ? `55${digitos}` : digitos;
    const sinal = servicoAtual.exige_sinal ? Math.round(servicoAtual.preco_centavos * (store.business.config_sinal_percentual ?? 30) / 100) : 0;
    const token = novoToken();
    setStore((s) => {
      const existente = s.clients.find((c) => c.whatsapp === whats);
      const clienteId = existente?.id ?? crypto.randomUUID();
      const clients = existente
        ? s.clients.map((c) => c.id === clienteId ? { ...c, nome: cliente.nome, email: cliente.email || c.email } : c)
        : [...s.clients, { id: clienteId, nome: cliente.nome, whatsapp: whats, email: cliente.email, observacoes: '', total_agendamentos: 0, total_faltas: 0, created_at: new Date().toISOString() }];
      const ag: Appointment = { id: crypto.randomUUID(), cliente_id: clienteId, membro_id: escolhido.membro_id, servico_id: servicoId, inicio_ts: ini.toISOString(), fim_ts: fim.toISOString(), status: sinal > 0 ? 'pendente_pagamento' : 'confirmado', origem: 'pagina_publica', preco_centavos: servicoAtual.preco_centavos, sinal_centavos: sinal, token_publico: token, observacoes: cliente.observacoes };
      return { ...s, clients, appointments: [...s.appointments, ag] };
    });
    return { token, status: sinal > 0 ? 'pendente_pagamento' : 'confirmado', sinal_centavos: sinal, preco_centavos: servicoAtual.preco_centavos, membro_id: escolhido.membro_id, inicio: ini.toISOString(), fim: fim.toISOString() };
  };

  if (ready && slug !== store.business.slug) {
    return <main className="min-h-screen grid place-items-center p-8"><div className="text-center"><h1 className="text-2xl font-bold">Negócio não encontrado 😕</h1><p className="muted my-4">Confira o endereço. Na demonstração, o negócio ativo é <strong>{store.business.nome}</strong>.</p><Link className="text-indigo-500 font-semibold" href={`/${store.business.slug}`}>Ir para /{store.business.slug} →</Link></div></main>;
  }
  return <PublicaUI business={store.business} services={store.services} members={store.members} reviews={store.reviews} buscarSlots={buscarSlots} agendar={agendar} />;
}

/* ── Modo real (RPCs do Supabase) ─────────────────────────────────────────── */
export type NegocioPublico = Business & {
  id: string; slug: string;
  servicos: Array<Omit<Service, 'ativo'>>;
  equipe: Array<{ id: string; nome: string; foto_url: string | null }>;
  avaliacoes: Array<{ nota: number; comentario: string | null; resposta: string | null }>;
};

export function PublicaLive({ data }: { data: NegocioPublico }) {
  const business: Business = { nome: data.nome, slug: data.slug, telefone: data.telefone ?? '', cidade: data.cidade ?? '', descricao: data.descricao, endereco: data.endereco, cor_primaria: data.cor_primaria, fuso_horario: data.fuso_horario, config_cancelamento_limite_horas: 4, config_sinal_percentual: 30 };
  const services: Service[] = data.servicos.map((s) => ({ ...s, ativo: true }));
  const members: Member[] = data.equipe.map((m) => ({ id: m.id, nome: m.nome, papel: 'profissional', ativo: true, foto_url: m.foto_url, servico_ids: [] }));
  const reviews: Review[] = data.avaliacoes.map((a, i) => ({ id: `av-${i}`, nota: a.nota, comentario: a.comentario ?? '', resposta: a.resposta, cliente: 'Cliente' }));

  const buscarSlots: UiProps['buscarSlots'] = async (dia, servicoId, membroId) => {
    const dataStr = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    const qs = new URLSearchParams({ slug: data.slug, servico: servicoId, data: dataStr, ...(membroId ? { membro: membroId } : {}) });
    const res = await fetch(`/api/publico/horarios?${qs}`);
    const json: { slots?: Array<{ membro_id: string; inicio_ts: string; fim_ts: string }>; error?: string } = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar horários.');
    return (json.slots ?? []).map((s) => ({ membro_id: s.membro_id, inicio: s.inicio_ts, fim: s.fim_ts }));
  };

  const agendar: UiProps['agendar'] = async ({ servicoId, membroId, inicio, cliente }) => {
    const res = await fetch('/api/publico/agendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: data.slug, servico_id: servicoId, membro_id: membroId, inicio, nome: cliente.nome, whatsapp: cliente.whatsapp, email: cliente.email, observacoes: cliente.observacoes, consentimento: cliente.consentimento }) });
    const json: { agendamento?: ResultadoAgendar & { inicio: string }; error?: string } = await res.json();
    if (!res.ok || !json.agendamento) throw new Error(json.error ?? 'Não foi possível agendar.');
    return json.agendamento;
  };

  return <PublicaUI business={business} services={services} members={members} reviews={reviews} buscarSlots={buscarSlots} agendar={agendar} />;
}
