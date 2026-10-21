'use client';
import Link from 'next/link';
import { Crown, TrendingUp, Users, CalendarCheck2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Store } from '@/lib/demo';
import { planoEfetivo } from '@/lib/planos';
import { comparecimento, horariosPico, novosClientesPorSemana, receitaPorDia, topProfissionais, topServicos } from '@/lib/relatorios';
import { moeda } from '@/lib/utils';

export function RelatoriosPanel({ store }: { store: Store }) {
  const plano = planoEfetivo(store.business);
  const receita = receitaPorDia(store.payments ?? [], 30);
  const maxReceita = Math.max(...receita.map((r) => r.total_centavos), 1);
  const totalReceita = receita.reduce((s, r) => s + r.total_centavos, 0);
  const servicos = topServicos(store.appointments, store.services);
  const profissionais = topProfissionais(store.appointments, store.members);
  const comp = comparecimento(store.appointments);
  const pico = horariosPico(store.appointments);
  const maxPico = Math.max(...pico.map((p) => p.quantidade), 1);
  const novos = novosClientesPorSemana(store.clients, 8);
  const maxNovos = Math.max(...novos, 1);

  if (plano !== 'premium') {
    return (
      <div className="card empty" style={{ padding: 60 }}>
        <Crown size={42} className="mx-auto" style={{ color: '#8a73df' }} />
        <h2 className="text-xl font-bold mt-4" style={{ color: 'var(--foreground)' }}>Relatórios avançados são do plano Premium</h2>
        <p className="mt-3" style={{ maxWidth: 420, marginInline: 'auto', lineHeight: 1.8 }}>Receita dia a dia, serviços e profissionais que mais faturam, horários de pico e taxa de comparecimento — para você decidir com dados, não com achismo.</p>
        <Button asChild className="mt-5"><Link href="/painel/configuracoes">Conhecer o Premium (R$ 59,90/mês)</Link></Button>
        <div className="grid gap-3 mt-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', opacity: 0.45, pointerEvents: 'none', filter: 'blur(1.5px)' }} aria-hidden="true">
          {[70, 45, 90, 60, 100, 55].map((h, i) => <div key={i} className="card" style={{ height: 90, display: 'flex', alignItems: 'flex-end', padding: 10 }}><div style={{ height: `${h}%`, width: '100%', background: '#8a73df', borderRadius: 6 }} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="card" style={{ padding: 24 }} aria-labelledby="rel-receita">
        <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h2 id="rel-receita" className="section-title row" style={{ gap: 8 }}><TrendingUp size={17} style={{ color: '#8a73df' }} />Receita recebida — últimos 30 dias</h2>
          <strong style={{ fontSize: 20 }}>{moeda(totalReceita)}</strong>
        </div>
        <div role="img" aria-label={`Gráfico de barras: receita total de ${moeda(totalReceita)} nos últimos 30 dias`} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 150, marginTop: 22 }}>
          {receita.map((r) => (
            <div key={r.dia} title={`${r.rotulo}: ${moeda(r.total_centavos)}`} style={{ flex: 1, minWidth: 4, height: `${Math.max((r.total_centavos / maxReceita) * 100, r.total_centavos > 0 ? 4 : 1.5)}%`, background: r.total_centavos ? 'linear-gradient(180deg,#8a73df,#5b4bd6)' : 'var(--border)', borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
        <div className="between muted" style={{ fontSize: 9, marginTop: 6 }}><span>{receita[0]?.rotulo}</span><span>{receita[Math.floor(receita.length / 2)]?.rotulo}</span><span>{receita[receita.length - 1]?.rotulo}</span></div>
      </section>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
        <section className="card" style={{ padding: 22 }} aria-labelledby="rel-servicos">
          <h2 id="rel-servicos" className="section-title" style={{ fontSize: 15 }}>Serviços mais procurados</h2>
          <div className="grid gap-3 mt-4">
            {servicos.map((s, i) => (
              <div key={s.nome} className="between" style={{ fontSize: 12 }}>
                <span><strong style={{ color: '#8a73df' }}>{i + 1}.</strong> {s.nome}<span className="muted"> · {s.quantidade}×</span></span>
                <strong>{moeda(s.receita_centavos)}</strong>
              </div>
            ))}
            {servicos.length === 0 && <p className="muted" style={{ fontSize: 12 }}>Sem atendimentos no período.</p>}
          </div>
        </section>

        <section className="card" style={{ padding: 22 }} aria-labelledby="rel-equipe">
          <h2 id="rel-equipe" className="section-title row" style={{ fontSize: 15, gap: 7 }}><Users size={15} style={{ color: '#8a73df' }} />Receita por profissional</h2>
          <div className="grid gap-3 mt-4">
            {profissionais.map((p) => (
              <div key={p.nome} style={{ fontSize: 12 }}>
                <div className="between"><span>{p.nome}<span className="muted"> · {p.quantidade} atend.</span></span><strong>{moeda(p.receita_centavos)}</strong></div>
                <div className="progress-track mt-1.5"><div style={{ width: `${(p.receita_centavos / Math.max(...profissionais.map((x) => x.receita_centavos), 1)) * 100}%` }} /></div>
              </div>
            ))}
            {profissionais.length === 0 && <p className="muted" style={{ fontSize: 12 }}>Sem atendimentos no período.</p>}
          </div>
        </section>

        <section className="card" style={{ padding: 22 }} aria-labelledby="rel-comp">
          <h2 id="rel-comp" className="section-title row" style={{ fontSize: 15, gap: 7 }}><CalendarCheck2 size={15} style={{ color: '#2f8c5b' }} />Comparecimento</h2>
          <p style={{ fontSize: 34, fontWeight: 800, marginTop: 14 }}>{comp.taxa === null ? '—' : `${String(comp.taxa).replace('.', ',')}%`}</p>
          <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.7 }}>{comp.concluidos} concluídos e {comp.faltas} faltas nos últimos 30 dias.{comp.taxa !== null && comp.taxa >= 90 ? ' Excelente — o sinal e os lembretes estão funcionando! 💜' : ''}</p>
          <h3 className="row mt-6" style={{ fontSize: 12, fontWeight: 700, gap: 6 }}><Users size={13} />Novos clientes por semana</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 52, marginTop: 10 }} role="img" aria-label="Novos clientes nas últimas 8 semanas">
            {novos.map((n, i) => <div key={i} title={`${n} novos`} style={{ flex: 1, height: `${Math.max((n / maxNovos) * 100, 6)}%`, background: '#7fb69a', borderRadius: 4 }} />)}
          </div>
        </section>

        <section className="card" style={{ padding: 22 }} aria-labelledby="rel-pico">
          <h2 id="rel-pico" className="section-title row" style={{ fontSize: 15, gap: 7 }}><Clock3 size={15} style={{ color: '#c99947' }} />Horários de pico</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110, marginTop: 18 }} role="img" aria-label="Quantidade de agendamentos por hora do dia">
            {pico.map((p) => (
              <div key={p.hora} style={{ flex: 1, textAlign: 'center' }}>
                <div title={`${p.hora}h: ${p.quantidade}`} style={{ height: 84, display: 'flex', alignItems: 'flex-end' }}><div style={{ width: '100%', height: `${Math.max((p.quantidade / maxPico) * 100, p.quantidade ? 6 : 2)}%`, background: p.quantidade === maxPico && p.quantidade > 0 ? '#c99947' : '#d8cfeb', borderRadius: 4 }} /></div>
                <span className="muted" style={{ fontSize: 8 }}>{p.hora}h</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Use os horários vazios para promoções-relâmpago no Instagram. 😉</p>
        </section>
      </div>
    </div>
  );
}
