-- OKR V2: corrige erro de runtime no agrupamento do dashboard.
-- PL/pgSQL valida a consulta interna apenas na execucao; updated_at era usado
-- no ORDER BY de objective_focus sem fazer parte do GROUP BY.

begin;

do $migration$
declare
  v_signature regprocedure :=
    to_regprocedure('public.get_okr_dashboard_v1(uuid,uuid,uuid,text)');
  v_definition text;
  v_fixed_definition text;
begin
  if v_signature is null then
    raise exception 'OKR_V2_DASHBOARD_FUNCTION_NOT_FOUND';
  end if;

  v_definition := pg_get_functiondef(v_signature);

  if v_definition ~
    'o\.calculated_progress,[[:space:]]*o\.updated_at[[:space:]]*order by' then
    return;
  end if;

  v_fixed_definition := regexp_replace(
    v_definition,
    '(o\.lifecycle_status,[[:space:]]*o\.calculated_health,[[:space:]]*o\.calculated_progress)([[:space:]]*order by)',
    '\1, o.updated_at\2'
  );

  if v_fixed_definition = v_definition then
    raise exception 'OKR_V2_DASHBOARD_GROUPING_PATCH_TARGET_NOT_FOUND';
  end if;

  execute v_fixed_definition;
end;
$migration$;

comment on function public.get_okr_dashboard_v1(uuid, uuid, uuid, text) is
  'Dashboard OKR V2 agregado, tenant-scoped, protegido e com agrupamento de foco validado.';

notify pgrst, 'reload schema';

commit;
