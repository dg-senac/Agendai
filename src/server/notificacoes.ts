import 'server-only';
import { EmailConfirmacao, EmailLembrete, EmailCancelamento, EmailPosAtendimento, type DadosEmailAgendamento } from '../../emails/agendamento';
import { EmailNovoAgendamentoDono, EmailTrialAcabando, EmailCobrancaFalhou } from '../../emails/avisos';
import { enviarEmail } from '@/lib/email';
import { gerarIcs } from '@/lib/disponibilidade';
import { proximaTentativa } from '@/lib/automacao';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;
type Notificacao = {
  id: string; negocio_id: string; agendamento_id: string | null; canal: string; tipo: string;
  destinatario: string | null; tentativas: number;
};

const formatarQuando = (inicio: string) =>
  new Date(inicio).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const moedaFmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

async function montarEEnviar(admin: Admin, n: Notificacao, baseUrl: string): Promise<void> {
  const { data: negocio } = await admin.from('negocios')
    .select('nome, slug, endereco, cidade, cor_primaria, trial_termina_em').eq('id', n.negocio_id).single();
  if (!negocio || !n.destinatario) throw new Error('Negócio ou destinatário não encontrado.');
  const linkPlanos = `${baseUrl}/painel/configuracoes`;
  const linkPainel = `${baseUrl}/painel/agenda`;

  if (n.tipo === 'trial_acabando') {
    const dias = negocio.trial_termina_em ? Math.max(0, Math.ceil((new Date(negocio.trial_termina_em).getTime() - Date.now()) / 86400_000)) : 0;
    await enviarEmail({ para: n.destinatario, assunto: `Seu trial Pro termina em ${dias} ${dias === 1 ? 'dia' : 'dias'} ⏳`, react: EmailTrialAcabando({ negocio: negocio.nome, dias, linkPlanos }) });
    return;
  }
  if (n.tipo === 'cobranca_falhou') {
    await enviarEmail({ para: n.destinatario, assunto: 'Não conseguimos cobrar sua assinatura', react: EmailCobrancaFalhou({ negocio: negocio.nome, linkPlanos }) });
    return;
  }
  if (!n.agendamento_id) throw new Error('Notificação sem agendamento.');

  const { data: ag } = await admin.from('agendamentos')
    .select('inicio_ts, fim_ts, preco_centavos, token_publico, clientes(nome), servicos(nome), membros(nome)')
    .eq('id', n.agendamento_id).single();
  if (!ag) throw new Error('Agendamento não encontrado.');
  const rel = ag as unknown as {
    inicio_ts: string; fim_ts: string; preco_centavos: number; token_publico: string;
    clientes: { nome: string } | null; servicos: { nome: string } | null; membros: { nome: string } | null;
  };
  const dados: DadosEmailAgendamento = {
    negocio: negocio.nome, cor: negocio.cor_primaria ?? undefined,
    cliente: rel.clientes?.nome ?? 'Cliente', servico: rel.servicos?.nome ?? 'Serviço',
    profissional: rel.membros?.nome ?? 'Equipe', quando: formatarQuando(rel.inicio_ts),
    endereco: [negocio.endereco, negocio.cidade].filter(Boolean).join(' · ') || null,
    linkGerenciar: `${baseUrl}/agendamento/${rel.token_publico}`,
    precoFormatado: moedaFmt(rel.preco_centavos),
  };

  switch (n.tipo) {
    case 'confirmacao': {
      const ics = gerarIcs({ titulo: `${dados.servico} — ${dados.negocio}`, inicio: new Date(rel.inicio_ts), fim: new Date(rel.fim_ts), descricao: `Gerencie seu horário: ${dados.linkGerenciar}`, local: dados.endereco ?? '', uid: rel.token_publico });
      await enviarEmail({ para: n.destinatario, assunto: `Horário confirmado: ${dados.servico}, ${dados.quando}`, react: EmailConfirmacao(dados), anexos: [{ filename: 'meu-agendamento.ics', content: ics }] });
      break;
    }
    case 'lembrete_24h':
    case 'lembrete_2h': {
      const amanha = new Date(rel.inicio_ts).toDateString() === new Date(Date.now() + 86400_000).toDateString();
      const falta = n.tipo === 'lembrete_24h' ? (amanha ? 'amanhã' : 'em 24 horas') : 'em 2 horas';
      await enviarEmail({ para: n.destinatario, assunto: `Lembrete: ${dados.servico} ${falta}`, react: EmailLembrete({ ...dados, falta }) });
      break;
    }
    case 'cancelamento':
      await enviarEmail({ para: n.destinatario, assunto: `Agendamento cancelado: ${dados.servico}`, react: EmailCancelamento(dados) });
      break;
    case 'pos_atendimento':
      await enviarEmail({ para: n.destinatario, assunto: `Como foi seu atendimento no ${dados.negocio}?`, react: EmailPosAtendimento(dados) });
      break;
    case 'novo_agendamento':
      await enviarEmail({ para: n.destinatario, assunto: `Novo agendamento: ${dados.cliente}, ${dados.quando}`, react: EmailNovoAgendamentoDono({ negocio: dados.negocio, cliente: dados.cliente, servico: dados.servico, profissional: dados.profissional, quando: dados.quando, linkPainel }) });
      break;
    default:
      throw new Error(`Tipo de notificação desconhecido: ${n.tipo}`);
  }
}

/** Processa a fila de e-mails vencidos (retry com backoff 5/15/45 min). */
export async function processarFilaNotificacoes(limite = 25): Promise<{ enviadas: number; falhas: number }> {
  const admin = supabaseAdmin();
  if (!admin) return { enviadas: 0, falhas: 0 };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agendai.app';
  const { data } = await admin.from('notificacoes')
    .select('id, negocio_id, agendamento_id, canal, tipo, destinatario, tentativas')
    .eq('status', 'pendente').eq('canal', 'email').lte('agendada_para', new Date().toISOString())
    .order('agendada_para').limit(limite);
  let enviadas = 0;
  let falhas = 0;
  for (const n of (data ?? []) as Notificacao[]) {
    try {
      await montarEEnviar(admin, n, baseUrl);
      await admin.from('notificacoes').update({ status: 'enviada', enviada_em: new Date().toISOString(), erro: null }).eq('id', n.id);
      enviadas++;
    } catch (e) {
      falhas++;
      const tentativas = (n.tentativas ?? 0) + 1;
      const { quando } = proximaTentativa(tentativas - 1);
      await admin.from('notificacoes').update({
        tentativas,
        erro: e instanceof Error ? e.message.slice(0, 500) : 'Erro ao enviar.',
        status: quando ? 'pendente' : 'falhou',
        ...(quando ? { agendada_para: quando.toISOString() } : {}),
      }).eq('id', n.id);
      console.error(JSON.stringify({ nivel: 'erro', evento: 'notificacao_falhou', id: n.id, tipo: n.tipo, tentativas }));
    }
  }
  return { enviadas, falhas };
}
