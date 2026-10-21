'use client';
import { toast } from 'sonner';
import { BellRing, Check, Mail, MessageCircle, Send } from 'lucide-react';
import type { Notification, Store } from '@/lib/demo';
import { formatarHora } from '@/lib/disponibilidade';
import { mensagemLembreteWhats } from '@/lib/automacao';

type Props = { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; live: boolean };

const TIPO: Record<Notification['tipo'], string> = {
  confirmacao: 'Confirmação enviada',
  lembrete_24h: 'Lembrete de 24h',
  lembrete_2h: 'Lembrete de 2h',
  cancelamento: 'Cancelamento avisado',
  pos_atendimento: 'Pedido de avaliação',
  novo_agendamento: 'Novo agendamento (você)',
  trial_acabando: 'Trial acabando',
  cobranca_falhou: 'Cobrança falhou',
};

/** Lembretes de WhatsApp (1 clique) + histórico recente de notificações. */
export function NotificacoesCard({ store, setStore, live }: Props) {
  const agora = new Date();
  const notificacoes = store.notifications ?? [];
  const whatsPendentes = notificacoes.filter((n) => n.canal === 'whatsapp_link' && n.status === 'pendente' && new Date(n.agendada_para) <= new Date(agora.getTime() + 24 * 3600_000));
  const recentes = [...notificacoes].sort((a, b) => (b.enviada_em ?? b.agendada_para).localeCompare(a.enviada_em ?? a.agendada_para)).slice(0, 5);

  const contexto = (n: Notification) => {
    const ag = store.appointments.find((a) => a.id === n.agendamento_id);
    if (!ag) return null;
    return {
      cliente: store.clients.find((c) => c.id === ag.cliente_id),
      servico: store.services.find((s) => s.id === ag.servico_id)?.nome ?? 'atendimento',
      quando: `${new Date(ag.inicio_ts).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} às ${formatarHora(new Date(ag.inicio_ts))}`,
      token: ag.token_publico,
    };
  };

  async function enviarWhats(n: Notification) {
    const ctx = contexto(n);
    if (!ctx?.cliente) { toast.error('Cliente não encontrado para este lembrete.'); return; }
    const texto = mensagemLembreteWhats(store.business.nome, ctx.cliente.nome, ctx.servico, ctx.quando, `${window.location.origin}/agendamento/${ctx.token}`);
    window.open(`https://wa.me/${ctx.cliente.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank');
    if (live) {
      await fetch('/api/notificacoes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) });
      window.location.reload();
      return;
    }
    setStore((s) => ({ ...s, notifications: (s.notifications ?? []).map((v) => (v.id === n.id ? { ...v, status: 'enviada' as const, enviada_em: new Date().toISOString() } : v)) }));
    toast.success('Lembrete marcado como enviado.');
  }

  return (
    <div className="card mt-5" style={{ padding: 23 }}>
      <div className="between"><h2 className="section-title">Lembretes & avisos</h2><BellRing size={17} style={{ color: '#8170d4' }} /></div>

      {whatsPendentes.length > 0 && (
        <div className="mt-4 grid gap-2">
          {whatsPendentes.map((n) => {
            const ctx = contexto(n);
            if (!ctx) return null;
            return (
              <div key={n.id} className="between" style={{ background: '#eaf7ef', borderRadius: 11, padding: '10px 12px' }}>
                <span style={{ fontSize: 11.5, lineHeight: 1.5 }}><strong>{ctx.cliente?.nome.split(' ')[0]}</strong> · {ctx.servico}<br /><span className="muted">{ctx.quando}</span></span>
                <button onClick={() => void enviarWhats(n)} aria-label={`Enviar lembrete no WhatsApp para ${ctx.cliente?.nome}`} title="Enviar lembrete no WhatsApp" style={{ background: '#22a06b', color: '#fff', borderRadius: 9, padding: 8, display: 'grid', placeItems: 'center' }}><Send size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {recentes.map((n) => (
          <div key={n.id} className="row" style={{ gap: 9, fontSize: 11 }}>
            <span style={{ color: n.canal === 'whatsapp_link' ? '#22a06b' : '#8170d4', display: 'grid', placeItems: 'center' }}>{n.canal === 'whatsapp_link' ? <MessageCircle size={15} /> : <Mail size={15} />}</span>
            <span style={{ flex: 1, lineHeight: 1.5 }}>{TIPO[n.tipo]}<br /><span className="muted" style={{ fontSize: 10 }}>{n.destinatario ?? ''}</span></span>
            {n.status === 'enviada' && <span className="badge" style={{ background: '#eaf7ef', color: '#2f8c5b' }}><Check size={10} />{live ? 'Enviada' : 'Simulada'}</span>}
            {n.status === 'pendente' && <span className="badge" style={{ background: '#fff6e3', color: '#b88c30' }}>Agendada</span>}
            {n.status === 'falhou' && <span className="badge" style={{ background: '#fdecec', color: '#c04646' }}>Falhou</span>}
            {n.status === 'cancelada' && <span className="badge" style={{ background: 'var(--hover)', color: 'var(--muted)' }}>Cancelada</span>}
          </div>
        ))}
        {recentes.length === 0 && <p className="muted" style={{ fontSize: 11, lineHeight: 1.7 }}>Confirmações e lembretes automáticos vão aparecer aqui quando os agendamentos chegarem.</p>}
      </div>
    </div>
  );
}
