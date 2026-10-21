// Modelo de dados compartilhado entre o modo demonstração (localStorage) e o
// modo real (Supabase). Os nomes espelham as colunas do banco.
export type Service = { id: string; nome: string; descricao?: string | null; duracao_minutos: number; preco_centavos: number; exige_sinal: boolean; ativo: boolean };
export type Member = { id: string; nome: string; papel: 'dono' | 'profissional'; ativo: boolean; foto_url?: string | null; servico_ids: string[]; email?: string | null };
export type Schedule = { id: string; membro_id: string; dia_semana: number; inicio: string; fim: string; intervalo_inicio: string | null; intervalo_fim: string | null };
export type Business = {
  nome: string; slug: string; telefone: string; cidade: string;
  descricao?: string; endereco?: string; cor_primaria?: string; fuso_horario?: string;
  config_antecedencia_minima_horas?: number; config_cancelamento_limite_horas?: number; config_sinal_percentual?: number;
  config_estorno_cliente_no_prazo?: boolean; config_faltas_sinal_obrigatorio?: number | null;
  plano?: 'gratis' | 'pro' | 'premium'; status?: string;
  assinatura_status?: 'trial' | 'ativa' | 'inadimplente' | 'cancelada';
  trial_termina_em?: string; assinatura_proxima_cobranca?: string | null; carencia_ate?: string | null;
  mp_conectado?: boolean;
};
export type Client = { id: string; nome: string; whatsapp: string; email: string; observacoes: string; total_agendamentos: number; total_faltas: number; created_at: string };
export type AppointmentStatus = 'pendente_pagamento' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou';
export type Appointment = {
  id: string; cliente_id: string; membro_id: string; servico_id: string;
  inicio_ts: string; fim_ts: string; status: AppointmentStatus; origem: 'pagina_publica' | 'painel';
  preco_centavos: number; sinal_centavos: number; token_publico: string; observacoes?: string;
  reserva_expira_em?: string | null;
};
export type Payment = {
  id: string; agendamento_id: string | null; tipo: 'sinal' | 'saldo' | 'assinatura';
  metodo: 'pix' | 'dinheiro' | 'cartao'; valor_centavos: number;
  status: 'pendente' | 'pago' | 'expirado' | 'estornado' | 'falhou';
  provider?: string | null; provider_id?: string | null; pix_copia_cola?: string | null;
  expira_em?: string | null; pago_em?: string | null; created_at: string;
};
export type Block = { id: string; membro_id: string; inicio_ts: string; fim_ts: string; motivo: string };
export type Review = { id: string; nota: number; comentario: string; cliente: string; resposta?: string | null; publica?: boolean; agendamento_id?: string | null; created_at?: string };
export type Notification = {
  id: string; agendamento_id: string | null;
  canal: 'email' | 'whatsapp_link';
  tipo: 'confirmacao' | 'lembrete_24h' | 'lembrete_2h' | 'cancelamento' | 'pos_atendimento' | 'novo_agendamento' | 'trial_acabando' | 'cobranca_falhou';
  status: 'pendente' | 'enviada' | 'falhou' | 'cancelada';
  destinatario: string | null; agendada_para: string; enviada_em?: string | null; erro?: string | null;
};
export type Store = { business: Business; services: Service[]; members: Member[]; schedules: Schedule[]; clients: Client[]; appointments: Appointment[]; blocks: Block[]; reviews: Review[]; payments: Payment[]; notifications: Notification[] };

export const DEMO_KEY = 'agendai-demo-v3';

/** Gera os dados de exemplo com datas relativas a hoje (agenda sempre viva). */
export function buildDemoStore(agora = new Date()): Store {
  const at = (dias: number, hora: number, min = 0) => {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias, hora, min, 0, 0);
    return d.toISOString();
  };
  const services: Service[] = [
    { id: 'demo-corte', nome: 'Corte feminino', descricao: 'Corte personalizado com lavagem e finalização.', duracao_minutos: 60, preco_centavos: 8500, exige_sinal: false, ativo: true },
    { id: 'demo-escova', nome: 'Escova & finalização', descricao: 'Escova modelada para qualquer ocasião.', duracao_minutos: 45, preco_centavos: 6000, exige_sinal: false, ativo: true },
    { id: 'demo-coloracao', nome: 'Coloração completa', descricao: 'Coloração com tratamento pós-química incluso.', duracao_minutos: 120, preco_centavos: 18000, exige_sinal: true, ativo: true },
    { id: 'demo-manicure', nome: 'Manicure & pedicure', descricao: 'Cuidado completo para mãos e pés.', duracao_minutos: 60, preco_centavos: 5500, exige_sinal: false, ativo: true },
  ];
  const members: Member[] = [
    { id: 'demo-ana', nome: 'Ana Souza', papel: 'dono', ativo: true, servico_ids: [] },
    { id: 'demo-camila', nome: 'Camila Santos', papel: 'profissional', ativo: true, servico_ids: ['demo-corte', 'demo-escova', 'demo-coloracao'] },
    { id: 'demo-julia', nome: 'Júlia Lima', papel: 'profissional', ativo: true, servico_ids: ['demo-manicure', 'demo-escova'] },
  ];
  const schedules: Schedule[] = members.flatMap((m) => [1, 2, 3, 4, 5, 6].map((dia) => ({
    id: `horario-${m.id}-${dia}`, membro_id: m.id, dia_semana: dia, inicio: '09:00', fim: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00',
  })));
  const clients: Client[] = [
    { id: 'cli-mariana@example.com', nome: 'Mariana Costa', whatsapp: '5581999991234', email: 'mariana@example.com', observacoes: 'Prefere horários pela manhã.', total_agendamentos: 6, total_faltas: 0, created_at: at(-90, 10) },
    { id: 'cli-beatriz@example.com', nome: 'Beatriz Almeida', whatsapp: '5581988885678', email: 'beatriz@example.com', observacoes: '', total_agendamentos: 1, total_faltas: 0, created_at: at(-12, 14) },
    { id: 'cli-juliana@example.com', nome: 'Juliana Ferreira', whatsapp: '5581977779012', email: 'juliana@example.com', observacoes: 'Alérgica a amônia.', total_agendamentos: 9, total_faltas: 1, created_at: at(-200, 9) },
    { id: 'cli-carolina@example.com', nome: 'Carolina Oliveira', whatsapp: '5581966663456', email: 'carolina@example.com', observacoes: '', total_agendamentos: 3, total_faltas: 0, created_at: at(-40, 16) },
  ];
  const appointments: Appointment[] = [
    { id: 'ag-1', cliente_id: 'cli-mariana@example.com', membro_id: 'demo-ana', servico_id: 'demo-corte', inicio_ts: at(0, 9), fim_ts: at(0, 10), status: 'confirmado', origem: 'pagina_publica', preco_centavos: 8500, sinal_centavos: 0, token_publico: 'demo-token-mariana@example.com' },
    { id: 'ag-2', cliente_id: 'cli-beatriz@example.com', membro_id: 'demo-camila', servico_id: 'demo-coloracao', inicio_ts: at(0, 10), fim_ts: at(0, 12), status: 'confirmado', origem: 'pagina_publica', preco_centavos: 18000, sinal_centavos: 0, token_publico: 'demo-token-beatriz@example.com' },
    { id: 'ag-3', cliente_id: 'cli-juliana@example.com', membro_id: 'demo-julia', servico_id: 'demo-manicure', inicio_ts: at(0, 14), fim_ts: at(0, 15), status: 'confirmado', origem: 'painel', preco_centavos: 5500, sinal_centavos: 0, token_publico: 'demo-token-juliana@example.com' },
    { id: 'ag-4', cliente_id: 'cli-carolina@example.com', membro_id: 'demo-ana', servico_id: 'demo-escova', inicio_ts: at(1, 11), fim_ts: at(1, 11, 45), status: 'confirmado', origem: 'pagina_publica', preco_centavos: 6000, sinal_centavos: 0, token_publico: 'demo-token-carolina@example.com' },
    { id: 'ag-5', cliente_id: 'cli-mariana@example.com', membro_id: 'demo-camila', servico_id: 'demo-escova', inicio_ts: at(-3, 15), fim_ts: at(-3, 15, 45), status: 'concluido', origem: 'pagina_publica', preco_centavos: 6000, sinal_centavos: 0, token_publico: 'demo-token-antigo' },
  ];
  return {
    business: {
      nome: 'Studio Beleza Natural', slug: 'studio-beleza-natural', telefone: '(81) 99999-1234', cidade: 'Recife, PE',
      descricao: 'Cuidado e beleza com atendimento acolhedor, no coração de Recife.', endereco: 'Rua das Flores, 123 — Boa Viagem',
      cor_primaria: '#4F46E5', fuso_horario: 'America/Recife', config_antecedencia_minima_horas: 2, config_cancelamento_limite_horas: 4, config_sinal_percentual: 30,
      config_estorno_cliente_no_prazo: true, config_faltas_sinal_obrigatorio: 3,
      plano: 'pro', status: 'trial', assinatura_status: 'trial',
      trial_termina_em: new Date(agora.getTime() + 14 * 24 * 3600_000).toISOString(),
      assinatura_proxima_cobranca: null, carencia_ate: null, mp_conectado: false,
    },
    services, members, schedules, clients, appointments, blocks: [],
    payments: [
      { id: 'pg-1', agendamento_id: 'ag-5', tipo: 'saldo', metodo: 'pix', valor_centavos: 6000, status: 'pago', provider: 'simulado', created_at: at(-3, 15, 50), pago_em: at(-3, 15, 50) },
      { id: 'pg-2', agendamento_id: 'ag-1', tipo: 'saldo', metodo: 'dinheiro', valor_centavos: 8500, status: 'pago', provider: 'manual', created_at: at(-1, 10, 5), pago_em: at(-1, 10, 5) },
      { id: 'pg-3', agendamento_id: 'ag-2', tipo: 'sinal', metodo: 'pix', valor_centavos: 5400, status: 'pago', provider: 'simulado', created_at: at(-2, 9, 12), pago_em: at(-2, 9, 14) },
      { id: 'pg-4', agendamento_id: null, tipo: 'saldo', metodo: 'cartao', valor_centavos: 12000, status: 'estornado', provider: 'simulado', created_at: at(-6, 11, 0), pago_em: at(-6, 11, 2) },
    ],
    notifications: [
      { id: 'nt-1', agendamento_id: 'ag-5', canal: 'email', tipo: 'confirmacao', status: 'enviada', destinatario: 'mariana@example.com', agendada_para: at(-4, 9, 2), enviada_em: at(-4, 9, 2) },
      { id: 'nt-2', agendamento_id: 'ag-5', canal: 'email', tipo: 'pos_atendimento', status: 'enviada', destinatario: 'mariana@example.com', agendada_para: at(-3, 17, 45), enviada_em: at(-3, 17, 45) },
    ],
    reviews: [
      { id: 'av-1', nota: 5, comentario: 'Atendimento impecável, saí renovada! O agendamento online facilitou tudo.', cliente: 'Mariana Costa.', publica: true, agendamento_id: 'ag-5' },
      { id: 'av-2', nota: 5, comentario: 'A Camila Santos entendeu exatamente a cor que eu queria. Recomendo demais.', cliente: 'Beatriz Almeida.', publica: true },
      { id: 'av-3', nota: 4, comentario: 'Ambiente lindo e pontualidade rara de ver. Já virei cliente fiel.', cliente: 'Juliana Ferreira.', publica: true },
      { id: 'av-4', nota: 3, comentario: 'Gostei do corte, mas a espera foi um pouquinho longa.', cliente: 'Carolina Oliveira.', publica: false, resposta: null },
    ],
  };
}

export const initialStore: Store = buildDemoStore();

export const novoToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};
export const apenasDigitos = (v: string) => v.replace(/\D/g, '');
export const iniciais = (nome: string) => nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
