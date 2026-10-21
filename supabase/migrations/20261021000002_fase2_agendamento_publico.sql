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
