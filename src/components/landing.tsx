'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarCheck2, ArrowRight, Check, Wallet, BellRing, BarChart3, ShieldCheck, Star, MessageCircle, ChevronDown } from 'lucide-react';
import { PLANOS, type PlanoId } from '@/lib/planos';
import { moeda } from '@/lib/utils';

const DEPOIMENTOS = [
  { texto: 'Parei de perder cliente por demora no WhatsApp. A agenda se enche sozinha.', nome: 'Ana Souza', negocio: 'Studio Beleza Natural · Recife' },
  { texto: 'O sinal via Pix acabou com as faltas. De 8 por mês para quase zero.', nome: 'Marcos Paulo Vieira', negocio: 'Barbearia do Marcos Paulo Vieira · Olinda' },
  { texto: 'Minha cliente agenda às 23h e eu só vejo a confirmação de manhã. Liberdade!', nome: 'Juliana Ferreira', negocio: 'Espaço Juliana Ferreira Unhas · Jaboatão' },
  { texto: 'Em 10 minutos eu estava com a página no ar. O link na bio do Instagram fez o resto.', nome: 'Rafael Personal', negocio: 'Treino com Rafael Personal · Boa Viagem' },
];

const BENEFICIOS = [
  { icon: MessageCircle, titulo: 'Adeus, agenda no WhatsApp', texto: 'Seu cliente escolhe o horário sozinho, 24h por dia, pela sua página exclusiva. Você só aparece para atender.', grande: true },
  { icon: Wallet, titulo: 'Sinal via Pix', texto: 'Cobre um sinal na reserva e veja as faltas despencarem. O dinheiro cai direto na sua conta do Mercado Pago.' },
  { icon: BellRing, titulo: 'Lembretes automáticos', texto: 'Confirmação e lembretes por e-mail (24h e 2h antes) + lembrete de WhatsApp com 1 clique.' },
  { icon: CalendarCheck2, titulo: 'Zero conflito de horário', texto: 'A disponibilidade é calculada em tempo real e o banco de dados impede reservas duplicadas — nem com dois clientes ao mesmo tempo.' },
  { icon: BarChart3, titulo: 'Financeiro sob controle', texto: 'Sinais, saldos, estornos e relatórios: cada real que entra, sob seus olhos.', grande: true },
  { icon: ShieldCheck, titulo: 'Seus dados, suas regras', texto: 'Isolamento total entre negócios, LGPD desde o formulário e exportação quando quiser.' },
];

const FAQ = [
  { p: 'Preciso de CNPJ para usar?', r: 'Não! Autônomos com CPF usam o Agendaí normalmente. Para receber sinais via Pix, basta uma conta gratuita no Mercado Pago.' },
  { p: 'Meu cliente precisa baixar aplicativo ou criar conta?', r: 'Não. Ele agenda pela sua página no navegador, informando só nome e WhatsApp, e recebe um link para remarcar ou cancelar quando precisar.' },
  { p: 'Como funciona o sinal via Pix?', r: 'Você define quais serviços pedem sinal e o percentual. Na reserva, o cliente paga o Pix (cai na sua conta do Mercado Pago) e o horário confirma na hora. Se ele não pagar em 10 minutos, o horário é liberado automaticamente.' },
  { p: 'Posso testar antes de pagar?', r: 'Pode! Todo negócio novo ganha 14 dias do plano Pro grátis, sem cartão de crédito. Depois, você escolhe continuar ou ficar no Grátis.' },
  { p: 'E se eu já tenho muitos clientes no WhatsApp?', r: 'Perfeito: é só fixar seu link na conversa, na bio do Instagram e no status. Em poucos dias, seus clientes passam a se agendar sozinhos.' },
];

export function Landing() {
  const raizRef = useRef<HTMLDivElement>(null);
  const magneticoRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelado = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }, { SplitText }, { DrawSVGPlugin }, lenisMod] = await Promise.all([
        import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText'), import('gsap/DrawSVGPlugin'), import('lenis'),
      ]);
      if (cancelado || !raizRef.current) return;
      gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

      const Lenis = lenisMod.default;
      const lenis = new Lenis({ lerp: 0.11, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      const rafLenis = (tempo: number) => lenis.raf(tempo * 1000);
      gsap.ticker.add(rafLenis);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        // Hero: título palavra a palavra com máscara
        const split = new SplitText('.hero-titulo', { type: 'words', mask: 'words' });
        gsap.from(split.words, { yPercent: 115, rotate: 3, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.1 });
        gsap.from('.hero-sub, .hero-ctas, .hero-prova', { opacity: 0, y: 24, duration: 0.8, ease: 'power2.out', stagger: 0.12, delay: 0.55 });
        gsap.from('.hero-mockup', { opacity: 0, y: 60, rotateX: 8, duration: 1.1, ease: 'power3.out', delay: 0.45 });
        gsap.to('.hero-mockup-flutuante', { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        gsap.to('.hero-mockup', { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });

        // Revelações por rolagem
        gsap.utils.toArray<HTMLElement>('.revelar').forEach((el) => {
          gsap.from(el, { opacity: 0, y: 34, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 86%' } });
        });
        gsap.utils.toArray<HTMLElement>('.revelar-grupo').forEach((grupo) => {
          gsap.from(grupo.children, { opacity: 0, y: 30, duration: 0.65, ease: 'power2.out', stagger: 0.08, scrollTrigger: { trigger: grupo, start: 'top 84%' } });
        });

        // Linha do "Como funciona" desenhando com a rolagem
        gsap.from('.linha-passos', { drawSVG: '0%', ease: 'none', scrollTrigger: { trigger: '.passos', start: 'top 75%', end: 'bottom 45%', scrub: 1 } });

        // Contadores
        gsap.utils.toArray<HTMLElement>('[data-contador]').forEach((el) => {
          const alvo = Number(el.dataset.contador ?? 0);
          const objeto = { valor: 0 };
          gsap.to(objeto, {
            valor: alvo, duration: 1.6, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            onUpdate: () => { el.textContent = Math.round(objeto.valor).toLocaleString('pt-BR'); },
          });
        });

        // Botão magnético (desktop)
        const mm = gsap.matchMedia();
        mm.add('(pointer: fine)', () => {
          const botao = magneticoRef.current;
          if (!botao) return;
          const xTo = gsap.quickTo(botao, 'x', { duration: 0.35, ease: 'power2.out' });
          const yTo = gsap.quickTo(botao, 'y', { duration: 0.35, ease: 'power2.out' });
          const mover = (e: MouseEvent) => {
            const r = botao.getBoundingClientRect();
            xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
            yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
          };
          const soltar = () => { xTo(0); yTo(0); };
          botao.addEventListener('mousemove', mover);
          botao.addEventListener('mouseleave', soltar);
          return () => { botao.removeEventListener('mousemove', mover); botao.removeEventListener('mouseleave', soltar); };
        });
      }, raizRef);

      cleanup = () => { ctx.revert(); gsap.ticker.remove(rafLenis); lenis.destroy(); };
    })();

    return () => { cancelado = true; cleanup?.(); };
  }, []);

  return (
    <div ref={raizRef} style={{ overflowX: 'clip' }}>
      {/* Cabeçalho */}
      <header style={{ position: 'fixed', inset: '0 0 auto 0', zIndex: 50, backdropFilter: 'blur(12px)', background: 'color-mix(in srgb, var(--surface) 80%, transparent)', borderBottom: '1px solid var(--border)' }}>
        <div className="between" style={{ maxWidth: 1140, margin: 'auto', padding: '13px 22px' }}>
          <Link href="/" className="brand" style={{ fontSize: 24 }}><span className="brand-mark"><CalendarCheck2 size={20} /></span>agendaí<span style={{ color: '#6b5ce7' }}>.</span></Link>
          <nav className="row desktop-only" style={{ gap: 26, fontSize: 13 }} aria-label="Navegação">
            <a href="#beneficios">Benefícios</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="#faq">Dúvidas</a>
          </nav>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/entrar" style={{ fontSize: 13, fontWeight: 600, padding: '9px 12px' }}>Entrar</Link>
            <Link href="/cadastro" style={{ background: '#4F46E5', color: '#fff', borderRadius: 11, padding: '10px 16px', fontSize: 13, fontWeight: 700 }}>Começar grátis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero hero-fundo" style={{ padding: '168px 22px 70px', position: 'relative' }}>
        <div style={{ maxWidth: 1140, margin: 'auto', textAlign: 'center', position: 'relative' }}>
          <span className="badge" style={{ background: '#efecfd', color: '#5b4bd6', padding: '8px 14px', fontSize: 11 }}>✨ 14 dias de Pro grátis · sem cartão de crédito</span>
          <h1 className="hero-titulo" style={{ fontSize: 'clamp(40px, 7vw, 74px)', fontWeight: 850, lineHeight: 1.05, letterSpacing: '-0.04em', marginTop: 26 }}>
            Seu talento merece uma <span style={{ background: 'linear-gradient(100deg,#4F46E5,#7C3AED)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>agenda cheia</span>, não um WhatsApp lotado.
          </h1>
          <p className="hero-sub muted" style={{ fontSize: 'clamp(16px, 2.4vw, 20px)', lineHeight: 1.65, maxWidth: 680, margin: '24px auto 0' }}>
            Página de agendamento própria, sinal via Pix para acabar com as faltas e lembretes automáticos. Feito para barbearias, salões, manicures, personal trainers e pequenas clínicas do Brasil. 💜
          </p>
          <div className="hero-ctas row" style={{ justifyContent: 'center', marginTop: 34, flexWrap: 'wrap' }}>
            <Link ref={magneticoRef} href="/cadastro" style={{ background: '#4F46E5', color: '#fff', borderRadius: 14, padding: '16px 26px', fontSize: 15, fontWeight: 750, display: 'inline-flex', gap: 9, alignItems: 'center', boxShadow: '0 14px 34px #4f46e555' }}>
              Criar minha página grátis<ArrowRight size={17} />
            </Link>
            <Link href="/studio-beleza-natural" style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, padding: '16px 26px', fontSize: 15, fontWeight: 650 }}>Ver uma página de verdade</Link>
          </div>
          <p className="hero-prova muted" style={{ fontSize: 12, marginTop: 22 }}>
            <span style={{ color: '#c99947' }}>★★★★★</span> “Minha agenda se enche sozinha.” — Ana Souza, Studio Beleza Natural (Recife)
          </p>

          {/* Mockup do painel */}
          <div className="hero-mockup" style={{ maxWidth: 860, margin: '56px auto 0', perspective: 1000 }}>
            <div className="hero-mockup-flutuante card" style={{ padding: 0, overflow: 'hidden', borderRadius: 22, boxShadow: '0 40px 90px #4f46e52e', textAlign: 'left' }}>
              <div className="between" style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'var(--hover)' }}>
                <span className="row" style={{ gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 10, background: '#f28b82' }} /><span style={{ width: 10, height: 10, borderRadius: 10, background: '#f6cf7d' }} /><span style={{ width: 10, height: 10, borderRadius: 10, background: '#8fd0a4' }} /></span>
                <span className="muted" style={{ fontSize: 11 }}>agendai.app/painel</span>
                <span className="badge" style={{ background: '#eaf7ef', color: '#2f8c5b' }}>Novo agendamento ✓</span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', padding: 18 }}>
                {[['Faturamento do mês', 'R$ 4.850,00', '↗ 18,6%'], ['Agendamentos hoje', '12', '8 confirmados'], ['Novos clientes', '28', '↗ 12%'], ['Comparecimento', '96,8%', 'Excelente!']].map(([r, v, s]) => (
                  <div key={r} className="card" style={{ padding: 14 }}><p className="muted" style={{ fontSize: 10 }}>{r}</p><p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{v}</p><p style={{ fontSize: 10, color: '#2f8c5b', marginTop: 3 }}>{s}</p></div>
                ))}
              </div>
              <div style={{ padding: '0 18px 18px', display: 'grid', gap: 8 }}>
                {[['Mariana Costa.', 'Corte feminino', '09:00'], ['Beatriz Almeida.', 'Coloração completa · sinal pago ✓', '10:00'], ['Juliana Ferreira.', 'Manicure & pedicure', '14:00']].map(([c, s, h]) => (
                  <div key={c} className="between card" style={{ padding: '11px 14px', borderRadius: 12 }}><span style={{ fontSize: 12 }}><strong>{c}</strong><span className="muted"> · {s}</span></span><span className="badge" style={{ background: '#eef2ff', color: '#4338ca' }}>{h}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee-faixa" aria-hidden="true">
        <div className="marquee-trilha">
          {[...DEPOIMENTOS, ...DEPOIMENTOS].map((d, i) => (
            <span key={i} className="marquee-item"><Star size={13} fill="#c99947" style={{ color: '#c99947', flexShrink: 0 }} />“{d.texto}” <strong>— {d.nome}</strong></span>
          ))}
        </div>
      </div>

      {/* Benefícios (bento) */}
      <section id="beneficios" style={{ maxWidth: 1140, margin: 'auto', padding: '96px 22px 30px' }}>
        <p className="eyebrow revelar" style={{ textAlign: 'center' }}>POR QUE O AGENDAÍ?</p>
        <h2 className="revelar" style={{ fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 800, textAlign: 'center', marginTop: 12 }}>Menos tempo no celular.<br />Mais tempo cuidando de pessoas.</h2>
        <div className="revelar-grupo bento-grade" style={{ marginTop: 48 }}>
          {BENEFICIOS.map((b) => (
            <article key={b.titulo} className={`card bento-item${b.grande ? ' bento-grande' : ''}`} style={{ padding: 28 }}>
              <span style={{ background: '#efecfd', color: '#5b4bd6', padding: 13, borderRadius: 14, display: 'inline-grid' }}><b.icon size={24} /></span>
              <h3 style={{ fontSize: 19, fontWeight: 750, marginTop: 18 }}>{b.titulo}</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.75, marginTop: 9 }}>{b.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Números */}
      <section className="revelar" style={{ maxWidth: 960, margin: '60px auto 0', padding: '0 22px' }}>
        <div className="card" style={{ padding: 34, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 22, textAlign: 'center', background: 'linear-gradient(120deg,#4F46E5,#7C3AED)', color: '#fff', border: 'none' }}>
          {[{ v: 2000, s: '+', r: 'agendamentos feitos' }, { v: 350, s: '+', r: 'negócios atendidos' }, { v: 97, s: '%', r: 'de comparecimento médio' }, { v: 10, s: ' min', r: 'para publicar sua página' }].map((n) => (
            <div key={n.r}><p style={{ fontSize: 36, fontWeight: 850 }}><span data-contador={n.v}>0</span>{n.s}</p><p style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4 }}>{n.r}</p></div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="passos" style={{ maxWidth: 980, margin: 'auto', padding: '110px 22px 20px' }}>
        <p className="eyebrow revelar" style={{ textAlign: 'center' }}>COMO FUNCIONA</p>
        <h2 className="revelar" style={{ fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 800, textAlign: 'center', marginTop: 12 }}>No ar em 3 passos</h2>
        <svg viewBox="0 0 900 60" style={{ width: '100%', marginTop: 40, overflow: 'visible' }} aria-hidden="true">
          <path d="M20 40 C 220 5, 340 55, 450 30 S 720 10, 880 32" fill="none" stroke="#e3e0fb" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8" />
          <path className="linha-passos" d="M20 40 C 220 5, 340 55, 450 30 S 720 10, 880 32" fill="none" stroke="#5b4bd6" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <div className="revelar-grupo grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 10 }}>
          {[
            { n: '1', t: 'Monte sua página', d: 'Cadastre o negócio, os serviços, a equipe e os horários. Nosso passo a passo leva menos de 10 minutos.' },
            { n: '2', t: 'Compartilhe seu link', d: 'Cole na bio do Instagram, no status e nas conversas do WhatsApp: agendai.app/seu-negocio.' },
            { n: '3', t: 'Receba sem esforço', d: 'O cliente agenda, paga o sinal no Pix e recebe os lembretes. Você só confere a agenda cheia. 💜' },
          ].map((p) => (
            <article key={p.n} className="card" style={{ padding: 26 }}>
              <span className="avatar" style={{ width: 44, height: 44, background: '#5b4bd6', color: '#fff', fontSize: 18 }}>{p.n}</span>
              <h3 style={{ fontSize: 18, fontWeight: 750, marginTop: 16 }}>{p.t}</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.75, marginTop: 8 }}>{p.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" style={{ maxWidth: 1080, margin: 'auto', padding: '110px 22px 20px' }}>
        <p className="eyebrow revelar" style={{ textAlign: 'center' }}>PLANOS</p>
        <h2 className="revelar" style={{ fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 800, textAlign: 'center', marginTop: 12 }}>Cabe no bolso de quem está começando</h2>
        <p className="revelar muted" style={{ textAlign: 'center', marginTop: 12, fontSize: 14 }}>14 dias de Pro grátis em todo cadastro novo. Sem cartão, sem fidelidade.</p>
        <div className="revelar-grupo grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 48, alignItems: 'stretch' }}>
          {(Object.keys(PLANOS) as PlanoId[]).map((id) => {
            const p = PLANOS[id];
            const destaque = id === 'pro';
            return (
              <article key={id} className={destaque ? 'plano-destaque' : 'card'} style={{ padding: 30, borderRadius: 22, position: 'relative', background: destaque ? 'var(--surface)' : undefined }}>
                {destaque && <span className="badge" style={{ position: 'absolute', top: -12, left: 24, background: '#5b4bd6', color: '#fff', padding: '6px 12px' }}>Mais popular</span>}
                <h3 style={{ fontSize: 17, fontWeight: 750 }}>{p.nome}</h3>
                <p style={{ marginTop: 12 }}><strong style={{ fontSize: 34 }}>{p.preco_centavos ? moeda(p.preco_centavos) : 'R$ 0'}</strong><span className="muted" style={{ fontSize: 12 }}>/mês</span></p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 26px', display: 'grid', gap: 10 }}>
                  {p.beneficios.map((b) => <li key={b} className="row" style={{ fontSize: 13, gap: 8 }}><Check size={15} style={{ color: '#2f8c5b', flexShrink: 0 }} />{b}</li>)}
                </ul>
                <Link href="/cadastro" style={{ display: 'block', textAlign: 'center', borderRadius: 12, padding: '13px 18px', fontWeight: 700, fontSize: 14, background: destaque ? '#5b4bd6' : 'var(--hover)', color: destaque ? '#fff' : 'var(--foreground)', border: destaque ? 'none' : '1px solid var(--border)' }}>
                  {id === 'gratis' ? 'Começar grátis' : `Testar o ${p.nome} grátis`}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Depoimentos */}
      <section style={{ maxWidth: 1080, margin: 'auto', padding: '90px 22px 10px' }}>
        <h2 className="revelar" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, textAlign: 'center' }}>Quem usa, recomenda 💬</h2>
        <div className="revelar-grupo grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 42 }}>
          {DEPOIMENTOS.map((d) => (
            <figure key={d.nome} className="card" style={{ padding: 26 }}>
              <span className="row" style={{ gap: 2, color: '#c99947' }}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill="currentColor" />)}</span>
              <blockquote style={{ fontSize: 14.5, lineHeight: 1.75, margin: '14px 0' }}>“{d.texto}”</blockquote>
              <figcaption><strong style={{ fontSize: 13 }}>{d.nome}</strong><span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{d.negocio}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 760, margin: 'auto', padding: '100px 22px 20px' }}>
        <h2 className="revelar" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, textAlign: 'center' }}>Perguntas frequentes</h2>
        <div className="revelar grid gap-3" style={{ marginTop: 40 }}>
          {FAQ.map((f) => (
            <details key={f.p} className="card faq-item" style={{ padding: '18px 22px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 14.5, listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 12 }}>{f.p}<ChevronDown size={17} className="muted faq-seta" style={{ flexShrink: 0 }} /></summary>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.8, marginTop: 12 }}>{f.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="revelar" style={{ maxWidth: 980, margin: '70px auto 0', padding: '0 22px 90px' }}>
        <div style={{ background: 'linear-gradient(120deg,#4F46E5,#7C3AED)', borderRadius: 26, padding: '54px 30px', textAlign: 'center', color: '#fff' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4.4vw, 40px)', fontWeight: 850 }}>Sua próxima agenda cheia começa agora</h2>
          <p style={{ opacity: 0.9, marginTop: 14, fontSize: 15 }}>Grátis para começar. No ar em menos de 10 minutos.</p>
          <Link href="/cadastro" style={{ background: '#fff', color: '#4F46E5', borderRadius: 14, padding: '16px 28px', fontWeight: 800, fontSize: 15, display: 'inline-flex', gap: 9, alignItems: 'center', marginTop: 28 }}>Criar minha página<ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '34px 22px 44px' }}>
        <div className="between" style={{ maxWidth: 1140, margin: 'auto', flexWrap: 'wrap', gap: 16 }}>
          <span className="brand" style={{ fontSize: 20 }}><span className="brand-mark" style={{ width: 30, height: 30 }}><CalendarCheck2 size={17} /></span>agendaí<span style={{ color: '#6b5ce7' }}>.</span></span>
          <nav className="row muted" style={{ fontSize: 12.5, gap: 22 }} aria-label="Rodapé">
            <Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><Link href="/entrar">Entrar</Link><Link href="/cadastro">Criar conta</Link>
          </nav>
          <span className="muted" style={{ fontSize: 11.5 }}>Feito em Recife, para quem cuida de pessoas. 💜</span>
        </div>
      </footer>
    </div>
  );
}
