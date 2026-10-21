-- ============================================================================
-- AGENDAÍ — Fase 5: crescimento (SEO, super admin, relatórios)
-- (também anexada ao final de supabase/schema_completo.sql)
-- ============================================================================

-- Slugs públicos para o sitemap (apenas metadados de descoberta).
create or replace function public.slugs_publicos()
returns table(slug text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select slug, updated_at from public.negocios
  where deleted_at is null and status not in ('suspenso','cancelado')
$$;
grant execute on function public.slugs_publicos() to anon, authenticated;

-- ── Super admin (app_metadata.super_admin no JWT) ───────────────────────────
create or replace function public.admin_visao_geral() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_super_admin() then raise exception 'Acesso restrito ao super admin.'; end if;
  return jsonb_build_object(
    'metricas', jsonb_build_object(
      'total_negocios', (select count(*) from public.negocios where deleted_at is null),
      'em_trial', (select count(*) from public.negocios where status = 'trial' and deleted_at is null),
      'ativos', (select count(*) from public.negocios where status = 'ativo' and deleted_at is null),
      'inadimplentes', (select count(*) from public.negocios where status = 'inadimplente' and deleted_at is null),
      'suspensos', (select count(*) from public.negocios where status = 'suspenso' and deleted_at is null),
      'novos_30d', (select count(*) from public.negocios where deleted_at is null and created_at >= now() - interval '30 days'),
      'cancelamentos_30d', (select count(*) from public.assinaturas where cancelada_em >= now() - interval '30 days'),
      'agendamentos_total', (select count(*) from public.agendamentos where deleted_at is null),
      'mrr_centavos', coalesce((select sum(preco_centavos) from public.assinaturas where status in ('ativa','inadimplente')), 0)),
    'negocios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'nome', n.nome, 'slug', n.slug, 'plano', n.plano, 'status', n.status,
        'criado_em', n.created_at,
        'membros', (select count(*) from public.membros m where m.negocio_id = n.id and m.deleted_at is null),
        'agendamentos', (select count(*) from public.agendamentos a where a.negocio_id = n.id and a.deleted_at is null)) order by n.created_at desc)
      from public.negocios n where n.deleted_at is null), '[]'::jsonb));
end $$;

create or replace function public.admin_definir_suspensao(p_negocio uuid, p_suspender boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_super_admin() then raise exception 'Acesso restrito ao super admin.'; end if;
  update public.negocios
     set status = case when p_suspender then 'suspenso' else 'ativo' end
   where id = p_negocio
     and status = case when p_suspender then status else 'suspenso' end;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_visao_geral(), public.admin_definir_suspensao(uuid, boolean) from public, anon;
grant execute on function public.admin_visao_geral(), public.admin_definir_suspensao(uuid, boolean) to authenticated;

-- ── Relatório avançado do tenant (Premium; dono) ───────────────────────────
create or replace function public.relatorio_negocio(p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.auth_negocio_id(); v_ini timestamptz := now() - make_interval(days => greatest(1, least(p_dias, 365)));
begin
  if v_neg is null or not public.eh_dono() then raise exception 'Somente o dono acessa os relatórios.'; end if;
  return jsonb_build_object(
    'receita_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'total_centavos', coalesce(sum(p.valor_centavos), 0)) order by d)
      from generate_series(date_trunc('day', v_ini), date_trunc('day', now()), interval '1 day') d
      left join public.pagamentos p on p.negocio_id = v_neg and p.status = 'pago' and p.tipo in ('sinal','saldo')
        and date_trunc('day', coalesce(p.pago_em, p.created_at)) = d
      group by d), '[]'::jsonb),
    'top_servicos', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select s.nome, count(*)::int as quantidade, coalesce(sum(a.preco_centavos), 0)::bigint as receita_centavos
        from public.agendamentos a join public.servicos s on s.id = a.servico_id
        where a.negocio_id = v_neg and a.deleted_at is null and a.status in ('concluido','confirmado') and a.inicio_ts >= v_ini
        group by s.nome order by quantidade desc limit 5) t), '[]'::jsonb),
    'top_profissionais', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select m.nome, count(*)::int as atendimentos, coalesce(sum(a.preco_centavos), 0)::bigint as receita_centavos
        from public.agendamentos a join public.membros m on m.id = a.membro_id
        where a.negocio_id = v_neg and a.deleted_at is null and a.status in ('concluido','confirmado') and a.inicio_ts >= v_ini
        group by m.nome order by receita_centavos desc limit 5) t), '[]'::jsonb),
    'comparecimento', jsonb_build_object(
      'concluidos', (select count(*) from public.agendamentos where negocio_id = v_neg and deleted_at is null and status = 'concluido' and inicio_ts >= v_ini),
      'faltas', (select count(*) from public.agendamentos where negocio_id = v_neg and deleted_at is null and status = 'faltou' and inicio_ts >= v_ini)),
    'novos_clientes', (select count(*) from public.clientes where negocio_id = v_neg and deleted_at is null and created_at >= v_ini));
end $$;
grant execute on function public.relatorio_negocio(int) to authenticated;
