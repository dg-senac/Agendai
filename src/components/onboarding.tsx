'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck2, ArrowRight, ArrowLeft, Check, Loader2, PartyPopper, Scissors, Clock3, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ETAPAS = ['Seu negócio', 'Primeiro serviço', 'Seus horários', 'Tudo pronto'];
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const slugify = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function Onboarding({ live, nomeInicial = '' }: { live: boolean; nomeInicial?: string }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [negocio, setNegocio] = useState({ nome: '', slug: '', nomeDono: nomeInicial, telefone: '', cidade: '' });
  const [slugEditado, setSlugEditado] = useState(false);
  const [slugLivre, setSlugLivre] = useState<'idle' | 'checcando' | 'livre' | 'ocupado'>('idle');
  const [membroId, setMembroId] = useState<string | null>(null);
  const [servico, setServico] = useState({ nome: '', duracao: 60, preco: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (negocio.slug.length < 3) { setSlugLivre('idle'); return; }
    setSlugLivre('checcando');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slug?slug=${encodeURIComponent(negocio.slug)}`);
        const data: { disponivel: boolean } = await res.json();
        setSlugLivre(data.disponivel ? 'livre' : 'ocupado');
      } catch { setSlugLivre('idle'); }
    }, 450);
  }, [negocio.slug]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível salvar. Tente de novo.');
    return data;
  }

  async function avancarNegocio(e: React.FormEvent) {
    e.preventDefault();
    if (slugLivre === 'ocupado') { toast.error('Este endereço já está em uso. Escolha outro.'); return; }
    if (!live) { setStep(1); return; }
    setBusy(true);
    try {
      const data = await post('/api/onboarding', negocio);
      setMembroId((data.membroId as string) ?? null);
      setStep(1);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro inesperado.'); }
    setBusy(false);
  }

  async function avancarServico(e: React.FormEvent) {
    e.preventDefault();
    if (!live) { setStep(2); return; }
    setBusy(true);
    try {
      await post('/api/fundacao', { collection: 'services', payload: { nome: servico.nome, duracao_minutos: servico.duracao, preco_centavos: Math.round(servico.preco * 100), exige_sinal: false, ativo: true } });
      setStep(2);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro inesperado.'); }
    setBusy(false);
  }

  async function concluir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!live) { setStep(3); return; }
    if (!membroId) { toast.error('Recarregue a página e tente novamente.'); return; }
    setBusy(true);
    try {
      await post('/api/fundacao', {
        collection: 'schedules',
        payload: {
          membro_id: membroId, dia_semana: Number(f.get('dia') ?? 1),
          inicio: String(f.get('inicio') ?? '09:00'), fim: String(f.get('fim') ?? '18:00'),
          intervalo_inicio: (f.get('intervalo_inicio') as string) || null,
          intervalo_fim: (f.get('intervalo_fim') as string) || null,
        },
      });
      setStep(3);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro inesperado.'); }
    setBusy(false);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="between" style={{ padding: '22px 32px' }}>
        <span className="brand"><span className="brand-mark"><CalendarCheck2 size={22} /></span>agendaí<span style={{ color: '#6b5ce7', fontSize: 30 }}>.</span></span>
        <span className="muted text-xs">Etapa {Math.min(step + 1, 4)} de 4</span>
      </header>
      <div style={{ maxWidth: 620, width: '100%', margin: '0 auto', padding: '10px 22px 60px', flex: 1 }}>
        <ol className="flex gap-2 mb-9" aria-label="Progresso da configuração" style={{ listStyle: 'none', padding: 0 }}>
          {ETAPAS.map((label, i) => (
            <li key={label} style={{ flex: 1 }}>
              <div className="progress-track" style={{ height: 6 }}><div style={{ width: i <= step ? '100%' : '0%' }} /></div>
              <span className="muted" style={{ fontSize: 10, fontWeight: i === step ? 700 : 500, display: 'block', marginTop: 7, color: i === step ? 'var(--foreground)' : undefined }}>{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form onSubmit={avancarNegocio} className="card p-8">
            <span style={{ background: '#efecfd', color: '#6550d9', padding: 12, borderRadius: 13, display: 'inline-grid' }}><Building2 size={22} /></span>
            <h1 className="text-2xl font-bold mt-5">Vamos conhecer seu negócio</h1>
            <p className="muted text-sm mt-2">É assim que seus clientes vão te encontrar.</p>
            <div className="form-grid">
              <label>Seu nome<input required minLength={2} maxLength={100} value={negocio.nomeDono} onChange={(e) => setNegocio({ ...negocio, nomeDono: e.target.value })} placeholder="Ex.: Ana Souza" /></label>
              <label>Nome do negócio<input required minLength={2} maxLength={100} value={negocio.nome} onChange={(e) => setNegocio({ ...negocio, nome: e.target.value, slug: slugEditado ? negocio.slug : slugify(e.target.value) })} placeholder="Ex.: Studio Beleza Natural" /></label>
              <label>Endereço da sua página
                <span className="relative block">
                  <input required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={negocio.slug} onChange={(e) => { setSlugEditado(true); setNegocio({ ...negocio, slug: slugify(e.target.value) }); }} placeholder="studio-beleza-natural" style={{ paddingRight: 130 }} />
                  <span className="muted" style={{ position: 'absolute', right: 40, top: 13, fontSize: 11 }}>agendai.app/</span>
                  <span style={{ position: 'absolute', right: 12, top: 12 }}>{slugLivre === 'checcando' ? <Loader2 size={16} className="animate-spin muted" /> : slugLivre === 'livre' ? <Check size={16} className="text-emerald-500" /> : slugLivre === 'ocupado' ? <span className="text-rose-500 text-xs font-bold">em uso</span> : null}</span>
                </span>
                {slugLivre === 'livre' && <span className="text-emerald-600 text-xs font-normal">Endereço disponível! 🎉</span>}
                {slugLivre === 'ocupado' && <span className="text-rose-500 text-xs font-normal">Este endereço já foi escolhido por outro negócio.</span>}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label>WhatsApp<input value={negocio.telefone} onChange={(e) => setNegocio({ ...negocio, telefone: e.target.value })} placeholder="(81) 99999-1234" /></label>
                <label>Cidade<input value={negocio.cidade} onChange={(e) => setNegocio({ ...negocio, cidade: e.target.value })} placeholder="Recife, PE" /></label>
              </div>
              <Button type="submit" disabled={busy || slugLivre === 'ocupado'}>{busy ? 'Criando seu espaço…' : 'Continuar'}<ArrowRight size={15} /></Button>
            </div>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={avancarServico} className="card p-8">
            <span style={{ background: '#fff2e2', color: '#c08b54', padding: 12, borderRadius: 13, display: 'inline-grid' }}><Scissors size={22} /></span>
            <h1 className="text-2xl font-bold mt-5">Qual é o seu serviço mais procurado?</h1>
            <p className="muted text-sm mt-2">Você pode adicionar os outros depois, no painel.</p>
            <div className="form-grid">
              <label>Nome do serviço<input required minLength={2} maxLength={100} value={servico.nome} onChange={(e) => setServico({ ...servico, nome: e.target.value })} placeholder="Ex.: Corte feminino" /></label>
              <div className="grid grid-cols-2 gap-4">
                <label>Duração (minutos)<input type="number" min={15} max={720} step={15} required value={servico.duracao} onChange={(e) => setServico({ ...servico, duracao: Number(e.target.value) })} /></label>
                <label>Preço (R$)<input type="number" min={0} max={100000} step="0.01" required value={servico.preco || ''} onChange={(e) => setServico({ ...servico, preco: Number(e.target.value) })} placeholder="85,00" /></label>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(0)}><ArrowLeft size={15} />Voltar</Button>
                <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Continuar'}<ArrowRight size={15} /></Button>
              </div>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={concluir} className="card p-8">
            <span style={{ background: '#e8f3f5', color: '#4c93a0', padding: 12, borderRadius: 13, display: 'inline-grid' }}><Clock3 size={22} /></span>
            <h1 className="text-2xl font-bold mt-5">Quando você atende?</h1>
            <p className="muted text-sm mt-2">Defina um dia para começar. Ajuste a semana toda depois.</p>
            <div className="form-grid">
              <label>Dia da semana<select name="dia" defaultValue={1}>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-4">
                <label>Começo às<input type="time" name="inicio" required defaultValue="09:00" /></label>
                <label>Termino às<input type="time" name="fim" required defaultValue="18:00" /></label>
                <label>Intervalo começa (opcional)<input type="time" name="intervalo_inicio" /></label>
                <label>Intervalo termina (opcional)<input type="time" name="intervalo_fim" /></label>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft size={15} />Voltar</Button>
                <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Publicar meu espaço'}<ArrowRight size={15} /></Button>
              </div>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="card p-10 text-center">
            <PartyPopper size={46} className="mx-auto text-indigo-500" />
            <h1 className="text-2xl font-bold mt-5">Seu espaço está no ar! 💜</h1>
            <p className="muted text-sm mt-3 leading-6">Seu endereço é <strong style={{ color: 'var(--foreground)' }}>agendai.app/{negocio.slug || 'seu-negocio'}</strong>.<br />A página pública de agendamento será ativada na Fase 2.</p>
            <Button asChild className="mt-7"><Link href="/painel">Ir para o meu painel<ArrowRight size={15} /></Link></Button>
          </div>
        )}
        {!live && <p className="muted text-[11px] text-center mt-6">Modo demonstração: nada é salvo no servidor.</p>}
      </div>
    </main>
  );
}
