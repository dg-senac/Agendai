-- ============================================================================
-- AGENDAÍ — Fase 4: automação (notificações, avaliações, ciclo de assinatura)
-- (também anexada ao final de supabase/schema_completo.sql)
-- ============================================================================

-- Novos tipos de notificação (avisos ao dono e ciclo de assinatura).
do $$ declare v_nome text; begin
  select conname into v_nome from pg_constraint
   where conrelid = 'public.notificacoes'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%tipo%confirmacao%';
  if v_nome is not null then execute format('alter table public.notificacoes drop constraint %I', v_nome); end if;
end $$;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('confirmacao','lembrete_24h','lembrete_2h','cancelamento','pos_atendimento','novo_agendamento','trial_acabando','cobranca_falhou'));

alter table public.negocios add column if not exists carencia_termina_em timestamptz;

-- Sem lembretes duplicados: um por (agendamento, tipo, canal).
create unique index if not exists notificacoes_sem_duplicidade_idx
  on public.notificacoes(agendamento_id, tipo, canal) where agendamento_id is not null;
create unique index if not exists notificacoes_trial_unico_idx
  on public.notificacoes(negocio_id) where tipo = 'trial_acabando';

-- Dono pode marcar o lembrete de WhatsApp como enviado.
create policy notif_update on public.notificacoes for update to authenticated
  using (negocio_id = public.auth_negocio_id() and public.eh_dono())
  with check (negocio_id = public.auth_negocio_id() and public.eh_dono());

-- ── Gatilhos: confirmação/cancelamento entram na fila na hora ──────────────
create or replace function public.notificar_mudanca_agendamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text; v_dono_email text;
begin
  select email into v_email from public.clientes where id = new.cliente_id;
  select email into v_dono_email from public.membros where negocio_id = new.negocio_id and papel = 'dono' and deleted_at is null limit 1;

  if new.status = 'confirmado' and (tg_op = 'INSERT' or old.status is distinct from 'confirmado') then
    if v_email is not null then
      insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
      values (new.negocio_id, new.id, 'email', 'confirmacao', v_email, now())
      on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing;
    end if;
    if tg_op = 'INSERT' and v_dono_email is not null then
      insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
      values (new.negocio_id, new.id, 'email', 'novo_agendamento', v_dono_email, now())
      on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    update public.notificacoes set status = 'cancelada'
     where agendamento_id = new.id and status = 'pendente' and tipo in ('lembrete_24h','lembrete_2h','pos_atendimento','confirmacao');
    if v_email is not null then
      insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
      values (new.negocio_id, new.id, 'email', 'cancelamento', v_email, now())
      on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger trg_notificar_agendamento after insert or update of status on public.agendamentos
  for each row execute function public.notificar_mudanca_agendamento();

-- ── Fila: cria lembretes e pós-atendimento que entraram na janela ──────────
create or replace function public.enfileirar_notificacoes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v int; v_total int := 0;
begin
  with novos as (
    insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
    select a.negocio_id, a.id, 'email', 'lembrete_24h', c.email, a.inicio_ts - interval '24 hours'
    from public.agendamentos a join public.clientes c on c.id = a.cliente_id
    where a.status = 'confirmado' and a.deleted_at is null and c.email is not null
      and a.inicio_ts - interval '24 hours' <= now() + interval '1 hour' and a.inicio_ts > now()
    on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing
    returning id)
  select count(*) into v from novos; v_total := v_total + v;

  with novos as (
    insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
    select a.negocio_id, a.id, 'email', 'lembrete_2h', c.email, a.inicio_ts - interval '2 hours'
    from public.agendamentos a join public.clientes c on c.id = a.cliente_id
    where a.status = 'confirmado' and a.deleted_at is null and c.email is not null
      and a.inicio_ts - interval '2 hours' <= now() + interval '1 hour' and a.inicio_ts > now()
    on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing
    returning id)
  select count(*) into v from novos; v_total := v_total + v;

  with novos as (
    insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
    select a.negocio_id, a.id, 'whatsapp_link', 'lembrete_2h', c.whatsapp, a.inicio_ts - interval '2 hours'
    from public.agendamentos a join public.clientes c on c.id = a.cliente_id
    where a.status = 'confirmado' and a.deleted_at is null
      and a.inicio_ts - interval '2 hours' <= now() + interval '1 hour' and a.inicio_ts > now()
    on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing
    returning id)
  select count(*) into v from novos; v_total := v_total + v;

  with novos as (
    insert into public.notificacoes(negocio_id, agendamento_id, canal, tipo, destinatario, agendada_para)
    select a.negocio_id, a.id, 'email', 'pos_atendimento', c.email, a.fim_ts + interval '2 hours'
    from public.agendamentos a join public.clientes c on c.id = a.cliente_id
    where a.status = 'concluido' and a.deleted_at is null and c.email is not null
      and a.fim_ts + interval '2 hours' <= now() + interval '1 hour'
      and a.fim_ts >= now() - interval '7 days'
    on conflict (agendamento_id, tipo, canal) where agendamento_id is not null do nothing
    returning id)
  select count(*) into v from novos; v_total := v_total + v;

  return jsonb_build_object('enfileiradas', v_total);
end $$;

-- ── Ciclo de vida: trial, inadimplência, carência de 7 dias, downgrade ─────
create or replace function public.processar_ciclo_assinaturas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  -- Aviso: trial terminando em até 3 dias.
  insert into public.notificacoes(negocio_id, canal, tipo, destinatario, agendada_para)
  select n.id, 'email', 'trial_acabando', m.email, now()
  from public.negocios n join public.membros m on m.negocio_id = n.id and m.papel = 'dono' and m.deleted_at is null
  where n.status = 'trial' and n.deleted_at is null and m.email is not null
    and n.trial_termina_em between now() and now() + interval '3 days'
  on conflict (negocio_id) where tipo = 'trial_acabando' do nothing;

  -- Trial vencido sem assinatura: volta ao Grátis.
  for r in select id from public.negocios where status = 'trial' and trial_termina_em < now() and deleted_at is null loop
    update public.assinaturas set status = 'expirada' where negocio_id = r.id and status = 'trial';
    insert into public.assinaturas(negocio_id, plano, status, preco_centavos) values (r.id, 'gratis', 'ativa', 0);
    update public.negocios set plano = 'gratis', status = 'ativo' where id = r.id;
    v := v + 1;
  end loop;

  -- Cobrança vencida: inadimplente + carência de 7 dias.
  for r in select a.id as assinatura_id, a.negocio_id from public.assinaturas a
           join public.negocios n on n.id = a.negocio_id
           where a.status = 'ativa' and a.preco_centavos > 0 and a.proxima_cobranca_em < now() and n.status = 'ativo' loop
    update public.assinaturas set status = 'inadimplente' where id = r.assinatura_id;
    update public.negocios set status = 'inadimplente', carencia_termina_em = now() + interval '7 days' where id = r.negocio_id;
    insert into public.notificacoes(negocio_id, canal, tipo, destinatario, agendada_para)
    select r.negocio_id, 'email', 'cobranca_falhou', m.email, now()
    from public.membros m where m.negocio_id = r.negocio_id and m.papel = 'dono' and m.email is not null and m.deleted_at is null
    limit 1;
    v := v + 1;
  end loop;

  -- Carência terminou sem pagar: downgrade ao Grátis (recursos pagos pausam).
  for r in select id from public.negocios where status = 'inadimplente' and carencia_termina_em < now() and deleted_at is null loop
    update public.assinaturas set status = 'expirada' where negocio_id = r.id and status = 'inadimplente';
    insert into public.assinaturas(negocio_id, plano, status, preco_centavos) values (r.id, 'gratis', 'ativa', 0);
    update public.negocios set plano = 'gratis', status = 'ativo', carencia_termina_em = null where id = r.id;
    v := v + 1;
  end loop;

  return jsonb_build_object('negocios_processados', v);
end $$;

-- ── Avaliação do cliente pelo token (pós-atendimento) ──────────────────────
create or replace function public.avaliar_agendamento(p_token text, p_nota int, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ag public.agendamentos%rowtype;
begin
  if p_nota is null or p_nota < 1 or p_nota > 5 then raise exception 'Escolha uma nota de 1 a 5 estrelas.'; end if;
  select * into v_ag from public.agendamentos where token_publico = p_token and deleted_at is null;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_ag.status <> 'concluido' then raise exception 'A avaliação fica disponível depois do atendimento.'; end if;
  insert into public.avaliacoes(negocio_id, agendamento_id, nota, comentario, publica)
  values (v_ag.negocio_id, v_ag.id, p_nota, nullif(trim(coalesce(p_comentario,'')),''), false);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'Você já avaliou este atendimento. Obrigado!';
end $$;

revoke execute on function public.enfileirar_notificacoes(), public.processar_ciclo_assinaturas() from public, anon, authenticated;
grant execute on function public.enfileirar_notificacoes(), public.processar_ciclo_assinaturas() to service_role;
grant execute on function public.avaliar_agendamento(text, int, text) to anon, authenticated;

-- ── pg_cron (opcional e seguro: se a extensão não estiver ativa, só avisa) ─
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname like 'agendai-%';
  perform cron.schedule('agendai-expirar-reservas', '* * * * *', 'select public.expirar_reservas()');
  perform cron.schedule('agendai-enfileirar-notificacoes', '* * * * *', 'select public.enfileirar_notificacoes()');
  perform cron.schedule('agendai-ciclo-assinaturas', '15 * * * *', 'select public.processar_ciclo_assinaturas()');
  raise notice 'pg_cron configurado. O envio dos e-mails roda na rota /api/cron/jobs (agende com pg_net ou um cron externo).';
exception when others then
  raise notice 'pg_cron indisponível neste projeto (%). Os jobs SQL podem ser chamados pela rota /api/cron/jobs.', sqlerrm;
end $$;
