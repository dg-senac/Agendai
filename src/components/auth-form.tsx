'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarCheck2, ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cadastroSchema, entrarSchema } from '@/server/validators/auth';
import type { z } from 'zod';

type Cadastro = z.infer<typeof cadastroSchema>;
type Entrar = z.infer<typeof entrarSchema>;

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-hidden="true">
        <div className="brand" style={{ color: '#fff' }}><span className="brand-mark" style={{ background: '#ffffff2b', boxShadow: 'none' }}><CalendarCheck2 size={22} /></span>agendaí<span style={{ fontSize: 30 }}>.</span></div>
        <div>
          <h2 style={{ fontSize: 42, lineHeight: 1.12, fontWeight: 800 }}>Seu talento merece<br />uma agenda cheia.</h2>
          <p style={{ marginTop: 18, fontSize: 15, lineHeight: 1.8, opacity: 0.85, maxWidth: 420 }}>Pare de agendar pelo WhatsApp. Seus clientes escolhem o horário, pagam o sinal no Pix e você só aparece para brilhar.</p>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7 }}>14 dias grátis do plano Pro · Sem cartão de crédito</p>
      </section>
      <section style={{ display: 'flex' }}><div className="auth-form">{children}</div></section>
    </main>
  );
}

export function AuthForm({ modo, live }: { modo: 'entrar' | 'cadastro'; live: boolean }) {
  const [show, setShow] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const cadastro = modo === 'cadastro';
  const form = useForm<Cadastro & Entrar>({ resolver: zodResolver(cadastro ? cadastroSchema : entrarSchema) as never });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function submit(values: Cadastro & Entrar) {
    if (!live) { toast.info('Ambiente de demonstração: explore o painel sem criar conta.'); window.location.href = '/painel'; return; }
    const res = await fetch(cadastro ? '/api/auth/cadastro' : '/api/auth/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    const result: { error?: string; precisaConfirmar?: boolean } = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(result.error ?? 'Algo não saiu como esperado. Tente novamente.'); return; }
    if (cadastro && result.precisaConfirmar) { setConfirmar(true); return; }
    window.location.href = cadastro ? '/onboarding' : '/painel';
  }

  if (confirmar) return (
    <div className="text-center py-10">
      <MailCheck size={44} className="mx-auto text-indigo-500" />
      <h1 className="text-2xl font-bold mt-5">Confira seu e-mail 💌</h1>
      <p className="muted mt-3 text-sm leading-6">Enviamos um link de confirmação. Depois de confirmar, você cria seu negócio em menos de 10 minutos.</p>
      <Link className="text-indigo-500 text-sm font-semibold inline-block mt-6" href="/entrar">Ir para o login →</Link>
    </div>
  );

  return (
    <>
      <h1 className="text-[28px] font-bold">{cadastro ? 'Crie sua conta grátis' : 'Que bom te ver de volta 👋'}</h1>
      <p className="muted mt-2 text-sm">{cadastro ? '14 dias de plano Pro, sem cartão de crédito.' : 'Entre para cuidar da sua agenda.'}</p>
      {!live && <div className="card p-4 mt-6 text-xs" style={{ background: '#fff8e6', borderColor: '#f3e3b3', color: '#7a5d12' }}><strong>Modo demonstração:</strong> o Supabase ainda não foi configurado aqui. Você pode explorar o painel com dados de exemplo.</div>}
      <form onSubmit={handleSubmit(submit)} className="form-grid" noValidate>
        {cadastro && <label>Seu nome<input autoComplete="name" placeholder="Ex.: Ana Souza" {...register('nome')} />{errors.nome && <span className="text-rose-500 text-xs font-normal">{errors.nome.message}</span>}</label>}
        <label>E-mail<input type="email" autoComplete="email" placeholder="voce@seunegocio.com.br" {...register('email')} />{errors.email && <span className="text-rose-500 text-xs font-normal">{errors.email.message}</span>}</label>
        <label>Senha<span className="relative block"><input type={show ? 'text' : 'password'} autoComplete={cadastro ? 'new-password' : 'current-password'} placeholder={cadastro ? 'Mínimo de 8 caracteres' : 'Sua senha'} {...register('senha')} style={{ paddingRight: 44 }} /><button type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-3 muted" onClick={() => setShow(!show)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{errors.senha && <span className="text-rose-500 text-xs font-normal">{errors.senha.message}</span>}</label>
        <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Um instante…' : cadastro ? 'Criar minha conta' : 'Entrar no meu espaço'}<ArrowRight size={15} /></Button>
      </form>
      <div className="between my-6 muted text-[11px]"><span style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span className="px-3">ou</span><span style={{ flex: 1, height: 1, background: 'var(--border)' }} /></div>
      <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = '/api/auth/google'; }}>Continuar com o Google</Button>
      <p className="muted text-xs text-center mt-7">{cadastro ? <>Já tem conta? <Link className="text-indigo-500 font-semibold" href="/entrar">Entrar</Link></> : <>Ainda não tem conta? <Link className="text-indigo-500 font-semibold" href="/cadastro">Criar grátis</Link></>}</p>
      {cadastro && <p className="muted text-[11px] text-center mt-4 leading-5">Ao criar sua conta, você concorda com nossos Termos de Uso e nossa Política de Privacidade (LGPD).</p>}
    </>
  );
}
