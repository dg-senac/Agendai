-- ============================================================================
-- AGENDAÍ — SQL COMPLETO (Fase 1: fundação + base das fases seguintes)
-- ----------------------------------------------------------------------------
-- Como usar: crie um projeto NOVO no Supabase, abra o SQL Editor, cole TODO
-- este arquivo e execute uma única vez. Ele cria extensões, tabelas, índices,
-- constraints, funções (RPC), triggers, RLS em todas as tabelas, bucket de
-- Storage e dados de demonstração (seção final — apague em produção se quiser).
--
-- Convenções:
--  * UUID como PK, created_at/updated_at em tudo, deleted_at (soft delete).
--  * Dinheiro sempre em centavos (inteiro).
--  * Horários de agendamento em timestamptz (UTC); exibição no fuso do tenant.
--  * Acesso público (anon) NUNCA lê tabelas direto: apenas RPCs controladas.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ============================================================================
-- 1) TABELAS
-- ============================================================================

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  descricao text,
  logo_url text,
  cor_primaria text not null default '#4F46E5' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  telefone text,
  endereco text,
  cidade text,
  fuso_horario text not null default 'America/Recife',
  plano text not null default 'pro' check (plano in ('gratis','pro','premium')),
  status text not null default 'trial' check (status in ('trial','ativo','inadimplente','suspenso','cancelado')),
  trial_termina_em timestamptz not null default (now() + interval '14 days'),
  config_sinal_percentual int not null default 30 check (config_sinal_percentual between 0 and 100),
  config_antecedencia_minima_horas int not null default 2 check (config_antecedencia_minima_horas between 0 and 168),
  config_cancelamento_limite_horas int not null default 4 check (config_cancelamento_limite_horas between 0 and 168),
  config_faltas_sinal_obrigatorio int check (config_faltas_sinal_obrigatorio is null or config_faltas_sinal_obrigatorio >= 1),
  config_estorno_cliente_no_prazo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  papel text not null default 'profissional' check (papel in ('dono','profissional')),
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  email text,
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Um usuário pertence a um único negócio (simplificação da Fase 1) e cada
-- negócio tem exatamente um dono ativo.
create unique index membros_user_unico_idx on public.membros(user_id) where user_id is not null and deleted_at is null;
create unique index membros_um_dono_idx on public.membros(negocio_id) where papel = 'dono' and deleted_at is null;

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  descricao text,
  duracao_minutos int not null check (duracao_minutos between 15 and 720),
  preco_centavos int not null check (preco_centavos between 0 and 10000000),
  exige_sinal boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.membro_servicos (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  membro_id uuid not null references public.membros(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  preco_customizado_centavos int check (preco_customizado_centavos is null or preco_customizado_centavos between 0 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (membro_id, servico_id)
);

create table public.horarios_trabalho (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  membro_id uuid not null references public.membros(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=domingo
  inicio time not null,
  fim time not null,
  intervalo_inicio time,
  intervalo_fim time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membro_id, dia_semana),
  check (fim > inicio),
  check ((intervalo_inicio is null and intervalo_fim is null)
      or (intervalo_inicio >= inicio and intervalo_fim <= fim and intervalo_fim > intervalo_inicio))
);

create table public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  membro_id uuid not null references public.membros(id) on delete cascade,
  inicio_ts timestamptz not null,
  fim_ts timestamptz not null,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim_ts > inicio_ts)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  whatsapp text not null check (char_length(whatsapp) between 10 and 20),
  email text,
  observacoes text,
  total_agendamentos int not null default 0,
  total_faltas int not null default 0,
  consentimento_em timestamptz, -- LGPD: aceite registrado no formulário público
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index clientes_negocio_whatsapp_idx on public.clientes(negocio_id, whatsapp) where deleted_at is null;

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  membro_id uuid not null references public.membros(id) on delete restrict,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  inicio_ts timestamptz not null,
  fim_ts timestamptz not null,
  status text not null default 'confirmado' check (status in ('pendente_pagamento','confirmado','concluido','cancelado','faltou')),
  origem text not null default 'pagina_publica' check (origem in ('pagina_publica','painel')),
  preco_centavos int not null check (preco_centavos >= 0),
  sinal_centavos int not null default 0 check (sinal_centavos >= 0 and sinal_centavos <= preco_centavos),
  token_publico text not null unique default encode(gen_random_bytes(18), 'hex'),
  reserva_expira_em timestamptz, -- reserva temporária enquanto o Pix não é pago
  observacoes text,
  cancelado_em timestamptz,
  cancelado_por text check (cancelado_por in ('cliente','negocio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (fim_ts > inicio_ts)
);
-- Proteção contra corrida: dois agendamentos ATIVOS nunca se sobrepõem para o
-- mesmo profissional, mesmo com requisições simultâneas.
alter table public.agendamentos
  add constraint agendamentos_sem_sobreposicao
  exclude using gist (membro_id with =, tstzrange(inicio_ts, fim_ts) with &&)
  where (status in ('pendente_pagamento','confirmado') and deleted_at is null);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  tipo text not null check (tipo in ('sinal','saldo','assinatura')),
  metodo text not null check (metodo in ('pix','dinheiro','cartao')),
  valor_centavos int not null check (valor_centavos > 0),
  status text not null default 'pendente' check (status in ('pendente','pago','expirado','estornado','falhou')),
  provider text,
  provider_id text,
  pix_copia_cola text,
  pix_qr_base64 text,
  expira_em timestamptz,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pagamentos_provider_unico_idx on public.pagamentos(provider, provider_id) where provider_id is not null;

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  plano text not null check (plano in ('gratis','pro','premium')),
  status text not null default 'trial' check (status in ('trial','ativa','inadimplente','cancelada','expirada')),
  provider_subscription_id text,
  proxima_cobranca_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete cascade,
  canal text not null check (canal in ('email','whatsapp_link')),
  tipo text not null check (tipo in ('confirmacao','lembrete_24h','lembrete_2h','cancelamento','pos_atendimento')),
  status text not null default 'pendente' check (status in ('pendente','enviada','falhou','cancelada')),
  destinatario text,
  agendada_para timestamptz not null default now(),
  tentativas int not null default 0,
  enviada_em timestamptz,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  agendamento_id uuid not null unique references public.agendamentos(id) on delete cascade,
  nota int not null check (nota between 1 and 5),
  comentario text,
  publica boolean not null default false,
  resposta text,
  respondida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios(id) on delete cascade,
  user_id uuid,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);

create table public.webhooks_recebidos (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  evento_id text not null,
  payload jsonb not null,
  processado boolean not null default false,
  erro text,
  created_at timestamptz not null default now(),
  unique (provider, evento_id) -- idempotência dos webhooks
);

-- ============================================================================
-- 2) ÍNDICES
-- ============================================================================
create index agendamentos_negocio_inicio_idx on public.agendamentos(negocio_id, inicio_ts);
create index agendamentos_membro_inicio_idx on public.agendamentos(membro_id, inicio_ts);
create index agendamentos_cliente_idx on public.agendamentos(cliente_id);
create index agendamentos_token_idx on public.agendamentos(token_publico);
create index agendamentos_reserva_idx on public.agendamentos(reserva_expira_em) where status = 'pendente_pagamento';
create index negocios_slug_idx on public.negocios(slug);
create index membros_negocio_idx on public.membros(negocio_id);
create index servicos_negocio_idx on public.servicos(negocio_id);
create index clientes_negocio_nome_idx on public.clientes(negocio_id, nome);
create index pagamentos_negocio_status_idx on public.pagamentos(negocio_id, status, created_at desc);
create index notificacoes_fila_idx on public.notificacoes(status, agendada_para);
create index bloqueios_membro_periodo_idx on public.bloqueios(membro_id, inicio_ts, fim_ts);
create index audit_negocio_idx on public.audit_log(negocio_id, created_at desc);

-- ============================================================================
-- 3) TRIGGERS: updated_at, contadores do cliente e auditoria
-- ============================================================================
create or replace function public.definir_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['negocios','membros','servicos','membro_servicos','horarios_trabalho','bloqueios','clientes','agendamentos','pagamentos','assinaturas','notificacoes','avaliacoes'] loop
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.definir_updated_at()', t);
  end loop;
end $$;

create or replace function public.atualizar_contadores_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.clientes set total_agendamentos = total_agendamentos + 1 where id = new.cliente_id;
  elsif new.status = 'faltou' and old.status is distinct from 'faltou' then
    update public.clientes set total_faltas = total_faltas + 1, total_agendamentos = total_agendamentos + 1 where id = new.cliente_id;
  end if;
  return new;
end $$;
create trigger trg_contadores_cliente after update of status on public.agendamentos
  for each row execute function public.atualizar_contadores_cliente();

-- Auditoria genérica das entidades sensíveis (plano, dinheiro, equipe...).
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
        v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
        v_base jsonb := coalesce(v_new, v_old);
begin
  insert into public.audit_log(negocio_id, user_id, acao, entidade, entidade_id, antes, depois)
  values (
    coalesce((v_base->>'negocio_id')::uuid, (v_base->>'id')::uuid),
    auth.uid(), lower(tg_op), tg_table_name, (v_base->>'id')::uuid, v_old, v_new
  );
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['negocios','membros','servicos','pagamentos','assinaturas'] loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- ============================================================================
-- 4) FUNÇÕES AUXILIARES DE AUTENTICAÇÃO (base do RLS multi-tenant)
-- ============================================================================
create or replace function public.auth_membro_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.membros where user_id = auth.uid() and ativo and deleted_at is null limit 1
$$;
create or replace function public.auth_negocio_id() returns uuid
language sql stable security definer set search_path = public as $$
  select negocio_id from public.membros where user_id = auth.uid() and ativo and deleted_at is null limit 1
$$;
create or replace function public.eh_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid() and papel = 'dono' and ativo and deleted_at is null)
$$;
create or replace function public.eh_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'super_admin')::boolean, false)
$$;

-- ============================================================================
-- 5) RLS — ativa em TODAS as tabelas; anon não lê nenhuma tabela diretamente
-- ============================================================================
alter table public.negocios enable row level security;
alter table public.membros enable row level security;
alter table public.servicos enable row level security;
alter table public.membro_servicos enable row level security;
alter table public.horarios_trabalho enable row level security;
alter table public.bloqueios enable row level security;
alter table public.clientes enable row level security;
alter table public.agendamentos enable row level security;
alter table public.pagamentos enable row level security;
alter table public.assinaturas enable row level security;
alter table public.notificacoes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.audit_log enable row level security;
alter table public.webhooks_recebidos enable row level security;

-- Negócios: membros leem o próprio; só o dono altera; criação só via RPC.
create policy negocios_select on public.negocios for select to authenticated
  using (id = public.auth_negocio_id() or public.eh_super_admin());
create policy negocios_update on public.negocios for update to authenticated
  using (id = public.auth_negocio_id() and public.eh_dono())
  with check (id = public.auth_negocio_id() and public.eh_dono());

-- Membros e serviços: leitura do tenant; escrita só do dono.
create policy membros_select on public.membros for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy membros_insert on public.membros for insert to authenticated with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy membros_update on public.membros for update to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy membros_delete on public.membros for delete to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());

create policy servicos_select on public.servicos for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy servicos_insert on public.servicos for insert to authenticated with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy servicos_update on public.servicos for update to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy servicos_delete on public.servicos for delete to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());

create policy membro_servicos_select on public.membro_servicos for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy membro_servicos_write on public.membro_servicos for all to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());

-- Horários e bloqueios: dono gerencia todos; profissional gerencia os próprios.
create policy horarios_select on public.horarios_trabalho for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy horarios_write on public.horarios_trabalho for all to authenticated
  using (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()))
  with check (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()));

create policy bloqueios_select on public.bloqueios for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy bloqueios_write on public.bloqueios for all to authenticated
  using (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()))
  with check (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()));

-- Clientes: dono vê todos; profissional vê apenas quem ele já atendeu.
create policy clientes_select on public.clientes for select to authenticated
  using (negocio_id = public.auth_negocio_id() and (public.eh_dono() or exists (
    select 1 from public.agendamentos a where a.cliente_id = clientes.id and a.membro_id = public.auth_membro_id())));
create policy clientes_insert on public.clientes for insert to authenticated with check (negocio_id = public.auth_negocio_id());
create policy clientes_update on public.clientes for update to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy clientes_delete on public.clientes for delete to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());

-- Agendamentos: dono vê todos do negócio; profissional só os próprios.
create policy ag_select on public.agendamentos for select to authenticated
  using (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()));
create policy ag_insert on public.agendamentos for insert to authenticated
  with check (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()));
create policy ag_update on public.agendamentos for update to authenticated
  using (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()))
  with check (negocio_id = public.auth_negocio_id() and (public.eh_dono() or membro_id = public.auth_membro_id()));
create policy ag_delete on public.agendamentos for delete to authenticated
  using (negocio_id = public.auth_negocio_id() and public.eh_dono());

-- Dinheiro e assinatura: somente o dono.
create policy pag_select on public.pagamentos for select to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy pag_insert on public.pagamentos for insert to authenticated with check (negocio_id = public.auth_negocio_id() and public.eh_dono());
create policy pag_update on public.pagamentos for update to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());

create policy ass_select on public.assinaturas for select to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());

create policy notif_select on public.notificacoes for select to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());

-- Avaliações: tenant lê; dono responde/publica.
create policy av_select on public.avaliacoes for select to authenticated using (negocio_id = public.auth_negocio_id());
create policy av_update on public.avaliacoes for update to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono()) with check (negocio_id = public.auth_negocio_id() and public.eh_dono());

create policy audit_select on public.audit_log for select to authenticated using (negocio_id = public.auth_negocio_id() and public.eh_dono());
-- webhooks_recebidos: sem policies de propósito (só service_role acessa).

-- ============================================================================
-- 6) RPCs PÚBLICAS E DE NEGÓCIO
-- ============================================================================

-- Disponibilidade do endereço público (usada no onboarding em tempo real).
create or replace function public.slug_disponivel(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and char_length(p_slug) between 3 and 60
     and p_slug not in ('painel','admin','api','entrar','cadastro','onboarding','agendamento','privacidade','termos')
     and not exists (select 1 from public.negocios where slug = p_slug)
$$;

-- Criação atômica do negócio + dono + trial Pro de 14 dias.
create or replace function public.criar_negocio(p_nome text, p_slug text, p_nome_dono text, p_telefone text default null, p_cidade text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_negocio uuid;
begin
  if v_user is null then raise exception 'É necessário entrar na sua conta.'; end if;
  if exists (select 1 from public.membros where user_id = v_user and deleted_at is null) then
    raise exception 'Sua conta já está vinculada a um negócio.';
  end if;
  if not public.slug_disponivel(p_slug) then raise exception 'Este endereço não está disponível.'; end if;
  insert into public.negocios(nome, slug, telefone, cidade, plano, status, trial_termina_em)
  values (trim(p_nome), p_slug, nullif(trim(coalesce(p_telefone,'')),''), nullif(trim(coalesce(p_cidade,'')),''), 'pro', 'trial', now() + interval '14 days')
  returning id into v_negocio;
  insert into public.membros(negocio_id, user_id, papel, nome, email)
  values (v_negocio, v_user, 'dono', trim(p_nome_dono), (select email from auth.users where id = v_user));
  insert into public.assinaturas(negocio_id, plano, status, proxima_cobranca_em)
  values (v_negocio, 'pro', 'trial', now() + interval '14 days');
  return v_negocio;
exception when unique_violation then
  raise exception 'Este endereço não está disponível.';
end $$;

-- Dados seguros da página pública (sem expor tabelas ao anon).
create or replace function public.negocio_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when n.id is null then null else jsonb_build_object(
    'id', n.id, 'nome', n.nome, 'slug', n.slug, 'descricao', n.descricao,
    'logo_url', n.logo_url, 'cor_primaria', n.cor_primaria, 'telefone', n.telefone,
    'endereco', n.endereco, 'cidade', n.cidade, 'fuso_horario', n.fuso_horario,
    'servicos', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'nome',s.nome,'descricao',s.descricao,'duracao_minutos',s.duracao_minutos,'preco_centavos',s.preco_centavos,'exige_sinal',s.exige_sinal) order by s.nome)
      from public.servicos s where s.negocio_id = n.id and s.ativo and s.deleted_at is null), '[]'::jsonb),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome,'foto_url',m.foto_url) order by m.nome)
      from public.membros m where m.negocio_id = n.id and m.ativo and m.deleted_at is null), '[]'::jsonb),
    'avaliacoes', coalesce((select jsonb_agg(jsonb_build_object('nota',a.nota,'comentario',a.comentario,'resposta',a.resposta) order by a.created_at desc)
      from public.avaliacoes a where a.negocio_id = n.id and a.publica limit 20), '[]'::jsonb)
  ) end
  from (select * from public.negocios where slug = p_slug and deleted_at is null and status not in ('suspenso','cancelado')) n
$$;

-- Horários livres: slots de 15 min no fuso do negócio, sem intervalo, sem
-- bloqueio, sem conflito, respeitando antecedência mínima e duração do serviço.
-- Regra de vínculo: se o profissional não tiver nenhum serviço vinculado, ele
-- atende todos (facilita negócios de uma pessoa só); senão, só os vinculados.
create or replace function public.horarios_disponiveis(p_slug text, p_servico_id uuid, p_membro_id uuid, p_data date)
returns table(membro_id uuid, membro_nome text, inicio_ts timestamptz, fim_ts timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_neg public.negocios%rowtype; v_dur int; v_dow int := extract(dow from p_data)::int;
begin
  select * into v_neg from public.negocios where slug = p_slug and deleted_at is null and status not in ('suspenso','cancelado');
  if not found then return; end if;
  select duracao_minutos into v_dur from public.servicos
    where id = p_servico_id and negocio_id = v_neg.id and ativo and deleted_at is null;
  if v_dur is null then return; end if;
  return query
  select h.membro_id, m.nome, s.slot, s.slot + make_interval(mins => v_dur)
  from public.horarios_trabalho h
  join public.membros m on m.id = h.membro_id and m.ativo and m.deleted_at is null
  cross join lateral generate_series(
      (p_data + h.inicio) at time zone v_neg.fuso_horario,
      (p_data + h.fim) at time zone v_neg.fuso_horario - make_interval(mins => v_dur),
      interval '15 minutes') as s(slot)
  where h.negocio_id = v_neg.id and h.dia_semana = v_dow
    and (p_membro_id is null or h.membro_id = p_membro_id)
    and (not exists (select 1 from public.membro_servicos x where x.membro_id = m.id)
         or exists (select 1 from public.membro_servicos x where x.membro_id = m.id and x.servico_id = p_servico_id))
    and s.slot >= now() + make_interval(hours => v_neg.config_antecedencia_minima_horas)
    and not (h.intervalo_inicio is not null and tstzrange(s.slot, s.slot + make_interval(mins => v_dur)) &&
             tstzrange((p_data + h.intervalo_inicio) at time zone v_neg.fuso_horario, (p_data + h.intervalo_fim) at time zone v_neg.fuso_horario))
    and not exists (select 1 from public.bloqueios b where b.membro_id = h.membro_id
             and tstzrange(b.inicio_ts, b.fim_ts) && tstzrange(s.slot, s.slot + make_interval(mins => v_dur)))
    and not exists (select 1 from public.agendamentos a where a.membro_id = h.membro_id and a.deleted_at is null
             and (a.status = 'confirmado' or (a.status = 'pendente_pagamento' and coalesce(a.reserva_expira_em, a.created_at + interval '10 minutes') > now()))
             and tstzrange(a.inicio_ts, a.fim_ts) && tstzrange(s.slot, s.slot + make_interval(mins => v_dur)))
  order by s.slot, m.nome;
end $$;

-- Métricas do dashboard do tenant autenticado.
create or replace function public.metricas_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.auth_negocio_id(); v_tz text;
begin
  if v_neg is null then return '{}'::jsonb; end if;
  select fuso_horario into v_tz from public.negocios where id = v_neg;
  return jsonb_build_object(
    'faturamento_mes_centavos', coalesce((select sum(valor_centavos) from public.pagamentos
      where negocio_id = v_neg and status = 'pago' and tipo in ('sinal','saldo')
        and pago_em >= date_trunc('month', now() at time zone v_tz) at time zone v_tz), 0),
    'agendamentos_hoje', (select count(*) from public.agendamentos
      where negocio_id = v_neg and deleted_at is null and status in ('confirmado','pendente_pagamento')
        and (inicio_ts at time zone v_tz)::date = (now() at time zone v_tz)::date),
    'novos_clientes_30d', (select count(*) from public.clientes
      where negocio_id = v_neg and deleted_at is null and created_at >= now() - interval '30 days'),
    'taxa_comparecimento', (select case when count(*) = 0 then null
      else round(100.0 * count(*) filter (where status = 'concluido') / count(*), 1) end
      from public.agendamentos where negocio_id = v_neg and deleted_at is null and status in ('concluido','faltou')
        and inicio_ts >= now() - interval '30 days')
  );
end $$;

-- ============================================================================
-- 7) PERMISSÕES (RLS continua sendo a barreira real; anon só executa RPCs)
-- ============================================================================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke execute on all functions in schema public from public;
grant execute on function public.auth_membro_id(), public.auth_negocio_id(), public.eh_dono(), public.eh_super_admin() to authenticated;
grant execute on function public.slug_disponivel(text), public.negocio_publico(text), public.horarios_disponiveis(text, uuid, uuid, date) to anon, authenticated;
grant execute on function public.criar_negocio(text, text, text, text, text), public.metricas_dashboard() to authenticated;

-- ============================================================================
-- 8) STORAGE — bucket público de branding (logo e fotos)
-- ============================================================================
insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;
drop policy if exists "branding leitura publica" on storage.objects;
create policy "branding leitura publica" on storage.objects for select using (bucket_id = 'branding');
drop policy if exists "branding escrita do dono" on storage.objects;
create policy "branding escrita do dono" on storage.objects for all to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_negocio_id()::text and public.eh_dono())
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_negocio_id()::text and public.eh_dono());

-- ============================================================================
-- 9) SEEDS DE DEMONSTRAÇÃO (negócio público de exemplo; apague em produção:
--    delete from public.negocios where slug = 'studio-beleza-natural';)
-- ============================================================================
insert into public.negocios(id, nome, slug, descricao, telefone, cidade, plano, status)
values ('11111111-1111-1111-1111-111111111111','Studio Beleza Natural','studio-beleza-natural',
        'Cuidado e beleza com atendimento acolhedor em Recife.','(81) 99999-1234','Recife, PE','pro','trial')
on conflict (id) do nothing;

insert into public.membros(id, negocio_id, papel, nome) values
  ('22222222-2222-2222-2222-22222222222a','11111111-1111-1111-1111-111111111111','dono','Ana Souza'),
  ('22222222-2222-2222-2222-22222222222b','11111111-1111-1111-1111-111111111111','profissional','Camila Santos'),
  ('22222222-2222-2222-2222-22222222222c','11111111-1111-1111-1111-111111111111','profissional','Júlia Lima')
on conflict (id) do nothing;

insert into public.servicos(id, negocio_id, nome, duracao_minutos, preco_centavos) values
  ('33333333-3333-3333-3333-33333333333a','11111111-1111-1111-1111-111111111111','Corte feminino',60,8500),
  ('33333333-3333-3333-3333-33333333333b','11111111-1111-1111-1111-111111111111','Escova & finalização',45,6000),
  ('33333333-3333-3333-3333-33333333333c','11111111-1111-1111-1111-111111111111','Coloração completa',120,18000),
  ('33333333-3333-3333-3333-33333333333d','11111111-1111-1111-1111-111111111111','Manicure & pedicure',60,5500)
on conflict (id) do nothing;

insert into public.horarios_trabalho(negocio_id, membro_id, dia_semana, inicio, fim, intervalo_inicio, intervalo_fim)
select '11111111-1111-1111-1111-111111111111', m.id, d.dia, '09:00', '18:00', '12:00', '13:00'
from public.membros m cross join (values (1),(2),(3),(4),(5),(6)) as d(dia)
where m.negocio_id = '11111111-1111-1111-1111-111111111111'
on conflict (membro_id, dia_semana) do nothing;

insert into public.clientes(id, negocio_id, nome, whatsapp, email, consentimento_em)
values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Mariana Costa','5581999991234','mariana@example.com', now())
on conflict (id) do nothing;

insert into public.agendamentos(id, negocio_id, cliente_id, membro_id, servico_id, inicio_ts, fim_ts, status, preco_centavos)
values ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-22222222222a','33333333-3333-3333-3333-33333333333a', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'concluido', 8500)
on conflict (id) do nothing;

insert into public.avaliacoes(id, negocio_id, agendamento_id, nota, comentario, publica)
values ('66666666-6666-6666-6666-666666666666','11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555',5,'Atendimento impecável, saí renovada!', true)
on conflict (id) do nothing;

-- Fim. Próximos passos: configure o .env.local (veja .env.example) e rode o app.
-- Para virar super admin: no Supabase Auth, edite seu usuário e defina
-- app_metadata = {"super_admin": true}.

-- ============================================================================
-- FASE 2 (migration 20261021000002) — anexada para o arquivo único continuar
-- executável do zero.
-- ============================================================================
-- ============================================================================
-- AGENDAÍ — Fase 2: agendamento público atômico + gestão por token
-- (também anexado ao final de supabase/schema_completo.sql)
-- ============================================================================

-- Cria agendamento da página pública de forma atômica:
-- valida o slot contra horarios_disponiveis, faz upsert do cliente por
-- (negocio_id, whatsapp), aplica rate limit por WhatsApp e depende do
-- EXCLUDE constraint para barrar corridas (exclusion_violation → mensagem PT).
create or replace function public.criar_agendamento_publico(
  p_slug text, p_servico_id uuid, p_membro_id uuid, p_inicio timestamptz,
  p_nome text, p_whatsapp text, p_email text, p_observacoes text, p_consentimento boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_neg public.negocios%rowtype;
  v_serv public.servicos%rowtype;
  v_membro uuid;
  v_cliente public.clientes%rowtype;
  v_preco int; v_sinal int := 0; v_status text;
  v_ag public.agendamentos%rowtype;
  v_data date;
  v_whats text := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
begin
  if p_consentimento is not true then raise exception 'É necessário autorizar o uso dos seus dados para agendar (LGPD).'; end if;
  if char_length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Informe seu nome.'; end if;
  if char_length(v_whats) < 10 or char_length(v_whats) > 13 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  if p_inicio is null or p_inicio < now() then raise exception 'Escolha um horário no futuro.'; end if;

  select * into v_neg from public.negocios where slug = p_slug and deleted_at is null and status not in ('suspenso','cancelado');
  if not found then raise exception 'Negócio não encontrado.'; end if;
  select * into v_serv from public.servicos where id = p_servico_id and negocio_id = v_neg.id and ativo and deleted_at is null;
  if not found then raise exception 'Serviço não encontrado.'; end if;

  -- Rate limit anti-spam: no máximo 5 agendamentos por WhatsApp por hora.
  if (select count(*) from public.agendamentos a join public.clientes c on c.id = a.cliente_id
      where a.negocio_id = v_neg.id and c.whatsapp = v_whats and a.created_at >= now() - interval '1 hour') >= 5 then
    raise exception 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.';
  end if;

  v_data := (p_inicio at time zone v_neg.fuso_horario)::date;

  -- Profissional específico ou "qualquer": precisa existir slot livre exato.
  select h.membro_id into v_membro
  from public.horarios_disponiveis(p_slug, p_servico_id, p_membro_id, v_data) h
  where h.inicio_ts = p_inicio
  order by h.membro_nome
  limit 1;
  if v_membro is null then raise exception 'Este horário não está mais disponível. Escolha outro, por favor.'; end if;

  insert into public.clientes(negocio_id, nome, whatsapp, email, consentimento_em)
  values (v_neg.id, trim(p_nome), v_whats, nullif(trim(coalesce(p_email,'')),''), now())
  on conflict (negocio_id, whatsapp) where deleted_at is null
  do update set nome = excluded.nome, email = coalesce(excluded.email, public.clientes.email), consentimento_em = now()
  returning * into v_cliente;

  select coalesce(ms.preco_customizado_centavos, v_serv.preco_centavos) into v_preco
  from (select 1) t left join public.membro_servicos ms on ms.membro_id = v_membro and ms.servico_id = v_serv.id;

  if v_serv.exige_sinal or (v_neg.config_faltas_sinal_obrigatorio is not null and v_cliente.total_faltas >= v_neg.config_faltas_sinal_obrigatorio) then
    v_sinal := round(v_preco * v_neg.config_sinal_percentual / 100.0)::int;
  end if;
  v_status := case when v_sinal > 0 then 'pendente_pagamento' else 'confirmado' end;

  insert into public.agendamentos(negocio_id, cliente_id, membro_id, servico_id, inicio_ts, fim_ts, status, origem, preco_centavos, sinal_centavos, reserva_expira_em, observacoes)
  values (v_neg.id, v_cliente.id, v_membro, v_serv.id, p_inicio, p_inicio + make_interval(mins => v_serv.duracao_minutos),
          v_status, 'pagina_publica', v_preco, v_sinal,
          case when v_sinal > 0 then now() + interval '10 minutes' else null end,
          nullif(trim(coalesce(p_observacoes,'')),''))
  returning * into v_ag;

  return jsonb_build_object('id', v_ag.id, 'token', v_ag.token_publico, 'inicio', v_ag.inicio_ts, 'fim', v_ag.fim_ts,
    'membro_id', v_ag.membro_id, 'status', v_ag.status, 'preco_centavos', v_ag.preco_centavos, 'sinal_centavos', v_ag.sinal_centavos);
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
end $$;

-- Detalhes seguros de um agendamento pelo token público (link mágico).
create or replace function public.agendamento_por_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when a.id is null then null else jsonb_build_object(
    'id', a.id, 'status', a.status, 'inicio', a.inicio_ts, 'fim', a.fim_ts,
    'preco_centavos', a.preco_centavos, 'sinal_centavos', a.sinal_centavos,
    'negocio', jsonb_build_object('nome', n.nome, 'slug', n.slug, 'telefone', n.telefone, 'endereco', n.endereco, 'cidade', n.cidade,
      'cor_primaria', n.cor_primaria, 'fuso_horario', n.fuso_horario, 'cancelamento_limite_horas', n.config_cancelamento_limite_horas),
    'servico', jsonb_build_object('id', s.id, 'nome', s.nome, 'duracao_minutos', s.duracao_minutos),
    'profissional', jsonb_build_object('id', m.id, 'nome', m.nome),
    'cliente', jsonb_build_object('nome', c.nome)) end
  from public.agendamentos a
  join public.negocios n on n.id = a.negocio_id
  join public.servicos s on s.id = a.servico_id
  join public.membros m on m.id = a.membro_id
  join public.clientes c on c.id = a.cliente_id
  where a.token_publico = p_token and a.deleted_at is null
$$;

-- Cliente cancela pelo token respeitando o limite de horas do negócio.
create or replace function public.cancelar_agendamento_publico(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ag public.agendamentos%rowtype; v_limite int;
begin
  select * into v_ag from public.agendamentos where token_publico = p_token and deleted_at is null for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_ag.status not in ('confirmado','pendente_pagamento') then raise exception 'Este agendamento não pode mais ser cancelado.'; end if;
  select config_cancelamento_limite_horas into v_limite from public.negocios where id = v_ag.negocio_id;
  if v_ag.inicio_ts - now() < make_interval(hours => v_limite) then
    raise exception 'O prazo para cancelar online já passou. Fale com o negócio pelo WhatsApp.';
  end if;
  update public.agendamentos set status = 'cancelado', cancelado_em = now(), cancelado_por = 'cliente' where id = v_ag.id;
  return jsonb_build_object('ok', true, 'status', 'cancelado');
end $$;

-- Cliente remarca pelo token (mesma regra de prazo; novo slot precisa estar livre).
create or replace function public.remarcar_agendamento_publico(p_token text, p_novo_inicio timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ag public.agendamentos%rowtype; v_neg public.negocios%rowtype; v_data date;
begin
  select * into v_ag from public.agendamentos where token_publico = p_token and deleted_at is null for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_ag.status not in ('confirmado','pendente_pagamento') then raise exception 'Este agendamento não pode mais ser remarcado.'; end if;
  select * into v_neg from public.negocios where id = v_ag.negocio_id;
  if v_ag.inicio_ts - now() < make_interval(hours => v_neg.config_cancelamento_limite_horas) then
    raise exception 'O prazo para remarcar online já passou. Fale com o negócio pelo WhatsApp.';
  end if;
  v_data := (p_novo_inicio at time zone v_neg.fuso_horario)::date;
  if not exists (select 1 from public.horarios_disponiveis(v_neg.slug, v_ag.servico_id, v_ag.membro_id, v_data) h where h.inicio_ts = p_novo_inicio) then
    raise exception 'Este horário não está mais disponível. Escolha outro, por favor.';
  end if;
  update public.agendamentos
     set inicio_ts = p_novo_inicio, fim_ts = p_novo_inicio + (fim_ts - inicio_ts)
   where id = v_ag.id;
  return jsonb_build_object('ok', true, 'inicio', p_novo_inicio);
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
end $$;

grant execute on function public.criar_agendamento_publico(text, uuid, uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.agendamento_por_token(text), public.cancelar_agendamento_publico(text), public.remarcar_agendamento_publico(text, timestamptz) to anon, authenticated;
