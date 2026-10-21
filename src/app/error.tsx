'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="min-h-screen grid place-items-center p-8"><div className="card p-10 text-center max-w-lg"><h1 className="text-2xl font-bold">Não conseguimos carregar seu espaço</h1><p className="muted my-5">Tente novamente. Se o problema continuar, confira a configuração do Supabase e a instalação do SQL.</p><Button onClick={reset}>Tentar novamente</Button></div></main>;}
