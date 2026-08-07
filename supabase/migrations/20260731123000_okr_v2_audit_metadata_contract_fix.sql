-- OKR V2 - corrige o contrato de auditoria dos RPCs legados.
--
-- A tabela canônica public.okr_audit_log expõe a coluna metadata. Algumas
-- definições de RPC das fases PR4/PR5 ainda tentavam gravar em payload, o que
-- fazia a transação inteira falhar com SQLSTATE 42703.
--
-- A correção é deliberadamente restrita à lista de assinaturas abaixo. Ela
-- preserva a implementação ativa, as assinaturas, os atributos e os grants de
-- cada função, alterando apenas a coluna do INSERT de auditoria.

begin;

do $migration$
declare
  v_signature text;
  v_oid regprocedure;
  v_definition text;
  v_fixed_definition text;
  v_payload_pattern constant text :=
    $regex$(okr_audit_log\s*\([^)]*)\mpayload\M([^)]*\))$regex$;
  v_metadata_pattern constant text :=
    $regex$okr_audit_log\s*\([^)]*\mmetadata\M[^)]*\)$regex$;
begin
  for v_signature in
    select signature
    from (
      values
        ('public.create_okr_objective_v2(uuid,jsonb)'),
        ('public.update_okr_objective_v2(uuid,uuid,jsonb)'),
        ('public.archive_okr_objective_v2(uuid,uuid,text)'),
        ('public.create_okr_alignment_v1(uuid,jsonb)'),
        ('public.archive_okr_alignment_v1(uuid,uuid)'),
        ('public.create_okr_key_result_v2(uuid,uuid,jsonb)'),
        ('public.update_okr_key_result_v2(uuid,uuid,jsonb)'),
        ('public.archive_okr_key_result_v2(uuid,uuid,text)'),
        ('public.publish_okr_objective_v2(uuid,uuid)')
    ) as required_functions(signature)
  loop
    v_oid := to_regprocedure(v_signature);

    if v_oid is null then
      raise exception 'OKR_V2_AUDIT_FUNCTION_NOT_FOUND: %', v_signature
        using errcode = '42883';
    end if;

    v_definition := pg_get_functiondef(v_oid::oid);

    if v_definition ~* v_payload_pattern then
      v_fixed_definition := regexp_replace(
        v_definition,
        v_payload_pattern,
        E'\\1metadata\\2',
        'gi'
      );

      if v_fixed_definition = v_definition
         or v_fixed_definition ~* v_payload_pattern
         or v_fixed_definition !~* v_metadata_pattern then
        raise exception 'OKR_V2_AUDIT_PATCH_FAILED: %', v_signature;
      end if;

      execute v_fixed_definition;
    elsif v_definition !~* v_metadata_pattern then
      raise exception 'OKR_V2_AUDIT_INSERT_NOT_FOUND: %', v_signature;
    end if;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
