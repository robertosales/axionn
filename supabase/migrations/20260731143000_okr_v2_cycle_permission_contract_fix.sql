-- OKR V2 - alinha aprovação e fechamento à permissão canônica de ciclos.
--
-- O catálogo RBAC possui okr.cycle_management. A chave okr.close_cycle nunca
-- foi cadastrada, mas cinco RPCs ainda a exigiam e negavam até administradores.
-- Esta migração altera somente esse literal nas assinaturas explicitadas.

begin;

do $migration$
declare
  v_signature text;
  v_oid regprocedure;
  v_definition text;
  v_fixed_definition text;
begin
  for v_signature in
    select signature
    from (
      values
        ('public.start_okr_cycle_closing_v1(uuid)'),
        ('public.close_okr_cycle_v1(uuid)'),
        ('public.approve_okr_objective_review_v1(uuid,uuid,boolean,text)'),
        ('public.upsert_okr_cycle_review_v1(uuid,jsonb)'),
        ('public.approve_okr_cycle_review_v1(uuid,boolean)')
    ) as required_functions(signature)
  loop
    v_oid := to_regprocedure(v_signature);

    if v_oid is null then
      raise exception 'OKR_V2_CYCLE_PERMISSION_FUNCTION_NOT_FOUND: %',
        v_signature using errcode = '42883';
    end if;

    v_definition := pg_get_functiondef(v_oid::oid);

    if v_definition ~* '''okr\.close_cycle''' then
      v_fixed_definition := replace(
        v_definition,
        '''okr.close_cycle''',
        '''okr.cycle_management'''
      );

      if v_fixed_definition = v_definition
         or v_fixed_definition ~* '''okr\.close_cycle''' then
        raise exception 'OKR_V2_CYCLE_PERMISSION_PATCH_FAILED: %',
          v_signature;
      end if;

      execute v_fixed_definition;
    elsif v_definition !~* '''okr\.cycle_management''' then
      raise exception 'OKR_V2_CYCLE_PERMISSION_GUARD_NOT_FOUND: %',
        v_signature;
    end if;

    execute format(
      'alter function %s set search_path = public, pg_temp',
      v_oid
    );
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
