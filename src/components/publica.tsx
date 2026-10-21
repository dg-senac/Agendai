'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const CarrosselAvaliacoes = dynamic(() => import('./carrossel-avaliacoes'), { ssr: false });
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Clock3, Copy, Loader2, MapPin, MessageCircle, QrCode, Scissors, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apenasDigitos, iniciais, type Business, type Member, type Review, type Service } from '@/lib/demo';
import { formatarHora, gerarIcs, membroAtende } from '@/lib/disponibilidade';
import { moeda } from '@/lib/utils';

export type { SlotPub } from './seletor-horario';
import { SeletorHorario, type SlotPub } from './seletor-horario';
export type PagamentoPix = { id: string; copia_cola: string; qr_base64?: string | null; expira_em: string; valor_centavos: number; simulado: boolean };
export type ResultadoAgendar = { id?: string; token: string; status: string; sinal_centavos: number; preco_centavos: number; membro_id: string; inicio: string; fim: string; pagamento?: PagamentoPix };
type DadosCliente = { nome: string; whatsapp: string; email: string; observacoes: string; consentimento: boolean };

export type UiProps = {
  business: Business; services: Service[]; members: Member[]; reviews: Review[];
  buscarSlots: (data: Date, servicoId: string, membroId: string | null) => Promise<SlotPub[]>;
  agendar: (d: { servicoId: string; membroId: string | null; inicio: string; cliente: DadosCliente }) => Promise<ResultadoAgendar>;
  consultarStatus?: (token: string) => Promise<{ status: string }>;
  simularPix?: (token: string, acao: 'pagar' | 'expirar') => Promise<void>;
};

const formatarWhats = (v: string) => {
  const d = apenasDigitos(v).replace(/^55/, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const ETAPAS = ['Serviço', 'Profissional', 'Data e hora', 'Seus dados', 'Resumo'];

export function PublicaUI({ business, services, members, reviews, buscarSlots, agendar, consultarStatus, simularPix }: UiProps) {
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

  async function celebrar() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 }, colors: [cor, '#a5b4fc', '#fbcfe8'] });
    }
  }

  async function confirmar() {
    if (!servico || !slot) return;
    setBusy(true);
    try {
      const r = await agendar({ servicoId: servico.id, membroId: membroSel, inicio: slot.inicio, cliente });
      setResultado(r);
      if (r.status === 'pendente_pagamento' && r.pagamento) {
        setStep(5); // tela do Pix
      } else {
        setStep(6);
        await celebrar();
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

            <div key={step} className="etapa-animada">
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
                      {sinalPrevisao > 0 && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Este serviço pede um sinal de {moeda(sinalPrevisao)} para reservar o horário. Na tela seguinte você paga o sinal via Pix (QR Code ou copia e cola) e o horário é confirmado na hora. A reserva vale por 10 minutos.</p>}
                    </div>
                    <Button className="w-full mt-5" style={{ background: cor, padding: 15 }} disabled={busy} onClick={confirmar}>{busy ? <><Loader2 size={16} className="animate-spin" />Reservando seu horário…</> : <>Confirmar agendamento<Check size={16} /></>}</Button>
                    <p className="muted text-center" style={{ fontSize: 11, marginTop: 10 }}>Cancelamento gratuito até {business.config_cancelamento_limite_horas ?? 4}h antes, pelo link que você receberá.</p>
                  </div>
                )}

                {step === 5 && resultado?.pagamento && servico && (
                  <PixEtapa cor={cor} pagamento={resultado.pagamento} token={resultado.token}
                    consultarStatus={consultarStatus} simularPix={simularPix}
                    onConfirmado={() => { setResultado((r) => (r ? { ...r, status: 'confirmado' } : r)); setStep(6); void celebrar(); }}
                    onRefazer={() => { setStep(2); setSlot(null); setResultado(null); }} />
                )}

                {step === 6 && resultado && servico && (
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
            </div>
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
  );
}

function PixEtapa({ cor, pagamento, token, consultarStatus, simularPix, onConfirmado, onRefazer }: {
  cor: string; pagamento: PagamentoPix; token: string;
  consultarStatus?: UiProps['consultarStatus']; simularPix?: UiProps['simularPix'];
  onConfirmado: () => void; onRefazer: () => void;
}) {
  const [restante, setRestante] = useState(() => Math.max(0, Math.floor((new Date(pagamento.expira_em).getTime() - Date.now()) / 1000)));
  const [qrUrl, setQrUrl] = useState<string | null>(pagamento.qr_base64 ? `data:image/png;base64,${pagamento.qr_base64}` : null);
  const [expirou, setExpirou] = useState(false);
  const [agindo, setAgindo] = useState(false);

  useEffect(() => {
    if (qrUrl) return;
    let ativo = true;
    import('qrcode').then((QR) => QR.toDataURL(pagamento.copia_cola, { width: 240, margin: 1 })).then((url) => { if (ativo) setQrUrl(url); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [pagamento.copia_cola, qrUrl]);

  useEffect(() => {
    const t = setInterval(() => {
      const seg = Math.max(0, Math.floor((new Date(pagamento.expira_em).getTime() - Date.now()) / 1000));
      setRestante(seg);
      if (seg === 0) setExpirou(true);
    }, 1000);
    return () => clearInterval(t);
  }, [pagamento.expira_em]);

  useEffect(() => {
    if (!consultarStatus || expirou) return;
    const t = setInterval(async () => {
      try {
        const r = await consultarStatus(token);
        if (r.status === 'confirmado' || r.status === 'concluido') { clearInterval(t); onConfirmado(); }
        else if (r.status === 'cancelado') { clearInterval(t); setExpirou(true); }
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 3000);
    return () => clearInterval(t);
  }, [consultarStatus, token, expirou, onConfirmado]);

  const mm = String(Math.floor(restante / 60)).padStart(2, '0');
  const ss = String(restante % 60).padStart(2, '0');

  if (expirou) {
    return (
      <div className="text-center mt-4" style={{ padding: '10px 4px' }}>
        <Clock3 size={44} className="mx-auto muted" />
        <h2 className="text-xl font-bold mt-4">O tempo para pagar o sinal acabou ⏰</h2>
        <p className="muted mt-3" style={{ fontSize: 13, lineHeight: 1.8 }}>A reserva foi liberada para não travar a agenda. Sem problemas: é só escolher outro horário.</p>
        <Button className="mt-6" style={{ background: cor }} onClick={onRefazer}>Escolher novo horário</Button>
      </div>
    );
  }

  return (
    <div className="text-center mt-4">
      <span className="badge" style={{ background: `${cor}1a`, color: cor, padding: '7px 12px' }}><QrCode size={13} />Pagamento do sinal via Pix</span>
      <h2 className="text-xl font-bold mt-4">Falta só o sinal de {moeda(pagamento.valor_centavos)}</h2>
      <p className="muted mt-2" style={{ fontSize: 12.5, lineHeight: 1.7 }}>Pague no app do seu banco para confirmar o horário.<br />Sua reserva expira em <strong style={{ color: restante < 120 ? '#c04646' : 'var(--foreground)' }}>{mm}:{ss}</strong>.</p>
      {qrUrl
        ? <img src={qrUrl} alt="QR Code do Pix para pagar o sinal" width={220} height={220} style={{ margin: '18px auto', borderRadius: 16, border: '1px solid var(--border)', background: '#fff', padding: 8 }} />
        : <p className="muted row mt-6" style={{ justifyContent: 'center', fontSize: 12 }}><Loader2 size={15} className="animate-spin" />Gerando QR Code…</p>}
      <div className="card" style={{ padding: 12, maxWidth: 420, margin: 'auto', background: 'var(--hover)' }}>
        <p style={{ fontSize: 10, wordBreak: 'break-all', textAlign: 'left', lineHeight: 1.6 }} className="muted">{pagamento.copia_cola}</p>
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { void navigator.clipboard?.writeText(pagamento.copia_cola); toast.success('Código Pix copiado! Cole no app do seu banco.'); }}><Copy size={13} />Copiar código Pix</Button>
      </div>
      <p className="muted row mt-5" style={{ justifyContent: 'center', fontSize: 12 }}><Loader2 size={14} className="animate-spin" />Aguardando a confirmação do pagamento… pode deixar esta tela aberta.</p>
      {pagamento.simulado && simularPix && (
        <div className="card mt-5" style={{ padding: 14, background: '#fff8e6', borderColor: '#f3e3b3', maxWidth: 420, marginInline: 'auto' }}>
          <p style={{ fontSize: 11, color: '#7a5d12', fontWeight: 700 }}>🧪 Pix simulado (demonstração — nenhum dinheiro se move)</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" style={{ flex: 1, background: '#2f8c5b' }} disabled={agindo} onClick={async () => { setAgindo(true); await simularPix(token, 'pagar'); onConfirmado(); }}>Já paguei (simular)</Button>
            <Button size="sm" variant="outline" disabled={agindo} onClick={async () => { setAgindo(true); await simularPix(token, 'expirar'); setExpirou(true); }}>Simular expiração</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Demonstração (localStorage) ──────────────────────────────────────────── */
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
    const json: { agendamento?: ResultadoAgendar; error?: string } = await res.json();
    if (!res.ok || !json.agendamento) throw new Error(json.error ?? 'Não foi possível agendar.');
    const r = json.agendamento;
    if (r.status === 'pendente_pagamento' && r.id) {
      const resPix = await fetch('/api/publico/pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: r.token, agendamento_id: r.id }) });
      const pix: { pagamento?: PagamentoPix; error?: string } = await resPix.json();
      if (!resPix.ok || !pix.pagamento) throw new Error(pix.error ?? 'Não foi possível gerar o Pix do sinal.');
      return { ...r, pagamento: pix.pagamento };
    }
    return r;
  };

  const consultarStatus: UiProps['consultarStatus'] = async (token) => {
    const res = await fetch(`/api/publico/pix?token=${encodeURIComponent(token)}`);
    const json: { status?: string } = await res.json();
    return { status: json.status ?? 'pendente_pagamento' };
  };
  return <PublicaUI business={business} services={services} members={members} reviews={reviews} buscarSlots={buscarSlots} agendar={agendar} consultarStatus={consultarStatus} />;
}
