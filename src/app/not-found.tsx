import Link from 'next/link';
export default function NotFound(){return <main className="min-h-screen grid place-items-center"><div className="text-center"><h1 className="text-3xl font-bold">Esta página ainda não está por aqui.</h1><p className="muted my-5">Confira o endereço ou volte ao seu espaço.</p><Link className="text-indigo-500" href="/painel">Voltar ao painel →</Link></div></main>;}
