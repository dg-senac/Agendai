'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { LayoutDashboard, CalendarDays, Users, Scissors, UsersRound, Clock3, Wallet, Star, BarChart3, Settings, Plus, ExternalLink, Search } from 'lucide-react';
import type { Store } from '@/lib/demo';

/** Paleta de comandos (Ctrl/⌘+K): navegar, agir e buscar sem tirar a mão do teclado. */
export function CommandPalette({ store }: { store: Store }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const ir = (href: string) => { setAberto(false); router.push(href); };

  const secoes = [
    { rotulo: 'Visão geral', href: '/painel', icon: LayoutDashboard },
    { rotulo: 'Agenda', href: '/painel/agenda', icon: CalendarDays },
    { rotulo: 'Clientes', href: '/painel/clientes', icon: Users },
    { rotulo: 'Serviços', href: '/painel/servicos', icon: Scissors },
    { rotulo: 'Equipe', href: '/painel/equipe', icon: UsersRound },
    { rotulo: 'Horários de trabalho', href: '/painel/horarios', icon: Clock3 },
    { rotulo: 'Financeiro', href: '/painel/financeiro', icon: Wallet },
    { rotulo: 'Avaliações', href: '/painel/avaliacoes', icon: Star },
    { rotulo: 'Relatórios (Premium)', href: '/painel/relatorios', icon: BarChart3 },
    { rotulo: 'Configurações e plano', href: '/painel/configuracoes', icon: Settings },
  ];

  return (
    <>
      <button onClick={() => setAberto(true)} aria-label="Abrir paleta de comandos (Ctrl+K)" title="Buscar e navegar (Ctrl+K)"
        className="row" style={{ gap: 8, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'var(--muted)', background: 'var(--surface)' }}>
        <Search size={14} /><span className="desktop-only">Buscar…</span>
        <kbd style={{ fontSize: 10, background: 'var(--hover)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' }}>Ctrl K</kbd>
      </button>

      {aberto && (
        <div className="cmdk-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberto(false); }}>
          <Command className="cmdk-caixa" label="Paleta de comandos" loop>
            <Command.Input placeholder="Para onde você quer ir? Busque páginas, clientes, serviços…" autoFocus />
            <Command.List>
              <Command.Empty>Nada por aqui com esse nome. Tente “agenda” ou o nome de um cliente. 🔍</Command.Empty>
              <Command.Group heading="Navegar">
                {secoes.map((s) => (
                  <Command.Item key={s.href} value={`ir ${s.rotulo}`} onSelect={() => ir(s.href)}><s.icon size={16} />{s.rotulo}</Command.Item>
                ))}
                <Command.Item value="minha pagina publica ver loja" onSelect={() => ir(`/${store.business.slug}`)}><ExternalLink size={16} />Minha página pública</Command.Item>
              </Command.Group>
              <Command.Group heading="Ações rápidas">
                <Command.Item value="novo agendamento criar marcar horario" onSelect={() => ir('/painel/agenda')}><Plus size={16} />Novo agendamento (na Agenda)</Command.Item>
                <Command.Item value="novo servico cadastrar" onSelect={() => ir('/painel/servicos')}><Plus size={16} />Novo serviço</Command.Item>
                <Command.Item value="novo cliente cadastrar" onSelect={() => ir('/painel/clientes')}><Plus size={16} />Novo cliente</Command.Item>
                <Command.Item value="registrar recebimento dinheiro" onSelect={() => ir('/painel/financeiro')}><Plus size={16} />Registrar recebimento</Command.Item>
              </Command.Group>
              {store.clients.length > 0 && (
                <Command.Group heading="Clientes">
                  {store.clients.slice(0, 40).map((c) => (
                    <Command.Item key={c.id} value={`cliente ${c.nome} ${c.whatsapp}`} onSelect={() => ir('/painel/clientes')}>
                      <Users size={16} />{c.nome}<span className="muted" style={{ fontSize: 11 }}>{c.whatsapp}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {store.services.length > 0 && (
                <Command.Group heading="Serviços">
                  {store.services.map((s) => (
                    <Command.Item key={s.id} value={`servico ${s.nome}`} onSelect={() => ir('/painel/servicos')}>
                      <Scissors size={16} />{s.nome}<span className="muted" style={{ fontSize: 11 }}>{s.duracao_minutos} min</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
