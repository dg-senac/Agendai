-- ============================================================================
-- AGENDAÍ — Fase 3: dinheiro (Pix, limites por plano, assinaturas, integrações)
-- (também anexada ao final de supabase/schema_completo.sql)
-- ============================================================================

-- Credenciais de pagamento por negócio. NENHUMA leitura via Auth/RLS: só o
-- servidor (service_role) lê o token para cobrar; o dono grava via RPC.
create table public.negocio_integracoes (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  mp_access_token text,
  mp_public_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.negocio_integracoes enable row level security;
revoke all on public.negocio_integracoes from anon, authenticated;
grant all on public.negocio_integracoes to service_role;
create trigger trg_updated_at before update on public.negocio_integracoes
  for each row execute function public.definir_updated_at();

alter table public.assinaturas add column if not exists provider text;
alter table public.assinaturas add column if not exists preco_centavos int;

-- ── Planos ─────────────────────────────────────────────────────────────────
create or replace function public.limites_plano(p_plano text) returns jsonb
language sql immutable as $$
  select case p_plano
    when 'premium' then jsonb_build_object('profissionais', null, 'agendamentos_mes', null, 'sinal_pix', true, 'csv', true, 'branding', true, 'preco_centavos', 5990)
    when 'pro'     then jsonb_build_object('profissionais', 3,    'agendamentos_mes', null, 'sinal_pix', true, 'csv', false, 'branding', false, 'preco_centavos', 2990)
    else                jsonb_build_object('profissionais', 1,    'agendamentos_mes', 30,   'sinal_pix', false, 'csv', false, 'branding', false, 'preco_centavos', 0)
  end
$$;

-- Plano que vale AGORA: trial válido = Pro; trial vencido ou conta
-- suspensa/cancelada = Grátis; inadimplente mantém o plano durante a carência
-- (a virada é feita pelo job da Fase 4 ao fim dos 7 dias).
create or replace function public.plano_efetivo(p_negocio uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when n.status in ('suspenso','cancelado') then 'gratis'
    when n.status = 'trial' and n.trial_termina_em > now() then 'pro'
    when n.status = 'trial' then 'gratis'
    else n.plano end
  from public.negocios n where n.id = p_negocio
$$;

-- Limite de profissionais (back-end, via trigger — nunca só no front).
create or replace function public.validar_limite_profissionais() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limite int := (public.limites_plano(public.plano_efetivo(new.negocio_id))->>'profissionais')::int;
begin
  if v_limite is not null and new.ativo and new.deleted_at is null then
    if (select count(*) from public.membros where negocio_id = new.negocio_id and ativo and deleted_at is null and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= v_limite then
      raise exception 'Limite de profissionais do seu plano atingido. Faça upgrade para adicionar mais pessoas à equipe.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_limite_profissionais before insert or update on public.membros
  for each row execute function public.validar_limite_profissionais();

-- Limite mensal de agendamentos + sinal só em plano pago.
create or replace function public.validar_limites_agendamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_plano text := public.plano_efetivo(new.negocio_id);
  v_limites jsonb := public.limites_plano(v_plano);
  v_max int := (v_limites->>'agendamentos_mes')::int;
  v_tz text;
begin
  if not coalesce((v_limites->>'sinal_pix')::boolean, false) then
    new.sinal_centavos := 0;
    if new.status = 'pendente_pagamento' then new.status := 'confirmado'; new.reserva_expira_em := null; end if;
  end if;
  if tg_op = 'INSERT' and v_max is not null and new.status <> 'cancelado' then
    select fuso_horario into v_tz from public.negocios where id = new.negocio_id;
    if (select count(*) from public.agendamentos
        where negocio_id = new.negocio_id and deleted_at is null and status <> 'cancelado'
          and date_trunc('month', inicio_ts at time zone v_tz) = date_trunc('month', new.inicio_ts at time zone v_tz)) >= v_max then
      raise exception 'Limite de agendamentos do mês no plano Grátis atingido. Faça upgrade para continuar agendando.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_limites_agendamento before insert or update on public.agendamentos
  for each row execute function public.validar_limites_agendamento();

-- ── Integração Mercado Pago (gravação só do dono; leitura só do servidor) ──
create or replace function public.salvar_credenciais_mp(p_token text, p_public_key text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.auth_negocio_id();
begin
  if v_neg is null or not public.eh_dono() then raise exception 'Somente o dono pode conectar pagamentos.'; end if;
  insert into public.negocio_integracoes(negocio_id, mp_access_token, mp_public_key)
  values (v_neg, nullif(trim(coalesce(p_token,'')),''), nullif(trim(coalesce(p_public_key,'')),''))
  on conflict (negocio_id) do update set mp_access_token = excluded.mp_access_token, mp_public_key = excluded.mp_public_key;
  insert into public.audit_log(negocio_id, user_id, acao, entidade, entidade_id, depois)
  values (v_neg, auth.uid(), 'integracao_mp_atualizada', 'negocio_integracoes', v_neg, jsonb_build_object('conectado', p_token is not null and trim(p_token) <> ''));
  return jsonb_build_object('conectado', p_token is not null and trim(p_token) <> '');
end $$;

create or replace function public.integracao_mp_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('conectado', exists (
    select 1 from public.negocio_integracoes where negocio_id = public.auth_negocio_id() and mp_access_token is not null))
$$;

-- ── Assinatura do SaaS ─────────────────────────────────────────────────────
create or replace function public.alterar_plano(p_plano text, p_provider text default null, p_provider_subscription_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.auth_negocio_id(); v_preco int;
begin
  if v_neg is null or not public.eh_dono() then raise exception 'Somente o dono pode alterar o plano.'; end if;
  if p_plano not in ('gratis','pro','premium') then raise exception 'Plano inválido.'; end if;
  v_preco := (public.limites_plano(p_plano)->>'preco_centavos')::int;
  update public.assinaturas set status = 'expirada' where negocio_id = v_neg and status in ('trial','ativa','inadimplente');
  insert into public.assinaturas(negocio_id, plano, status, provider, provider_subscription_id, preco_centavos, proxima_cobranca_em)
  values (v_neg, p_plano, 'ativa', p_provider, p_provider_subscription_id, v_preco, case when v_preco > 0 then now() + interval '30 days' else null end);
  update public.negocios set plano = p_plano, status = 'ativo' where id = v_neg;
  return jsonb_build_object('ok', true, 'plano', p_plano);
end $$;

create or replace function public.cancelar_assinatura() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.auth_negocio_id();
begin
  if v_neg is null or not public.eh_dono() then raise exception 'Somente o dono pode cancelar a assinatura.'; end if;
  update public.assinaturas set status = 'cancelada', cancelada_em = now()
   where negocio_id = v_neg and status in ('trial','ativa','inadimplente');
  return jsonb_build_object('ok', true);
end $$;

-- ── Reservas expiradas (chamada pelo job/cron com service_role) ───────────
create or replace function public.expirar_reservas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ag int; v_pg int;
begin
  with vencidos as (
    update public.agendamentos set status = 'cancelado', cancelado_em = now(), cancelado_por = 'negocio'
     where status = 'pendente_pagamento' and reserva_expira_em is not null and reserva_expira_em < now() and deleted_at is null
     returning id)
  select count(*) into v_ag from vencidos;
  with expirados as (
    update public.pagamentos set status = 'expirado'
     where status = 'pendente' and tipo = 'sinal' and expira_em is not null and expira_em < now()
     returning id)
  select count(*) into v_pg from expirados;
  return jsonb_build_object('agendamentos_liberados', v_ag, 'pagamentos_expirados', v_pg);
end $$;

-- ── Resumo financeiro do tenant (dono) ────────────────────────────────────
create or replace function public.resumo_financeiro(p_inicio timestamptz, p_fim timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'recebido_centavos', coalesce(sum(valor_centavos) filter (where status = 'pago'), 0),
    'pendente_centavos', coalesce(sum(valor_centavos) filter (where status = 'pendente'), 0),
    'estornado_centavos', coalesce(sum(valor_centavos) filter (where status = 'estornado'), 0),
    'quantidade', count(*))
  from public.pagamentos
  where negocio_id = public.auth_negocio_id() and public.eh_dono()
    and created_at >= p_inicio and created_at < p_fim and tipo in ('sinal','saldo')
$$;

grant execute on function public.limites_plano(text), public.plano_efetivo(uuid) to authenticated;
grant execute on function public.salvar_credenciais_mp(text, text), public.integracao_mp_status(), public.alterar_plano(text, text, text), public.cancelar_assinatura(), public.resumo_financeiro(timestamptz, timestamptz) to authenticated;
revoke execute on function public.expirar_reservas() from public, anon, authenticated;
grant execute on function public.expirar_reservas() to service_role;
